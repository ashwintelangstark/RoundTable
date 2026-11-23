import dns from "node:dns";
import { config } from "../config.js";

dns.setDefaultResultOrder("ipv4first");

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const STREAM_MODEL_CASCADE = [
  "cohere/north-mini-code:free",
  "openrouter/free",
  "inclusionai/ling-3.2-flash:free",
  "nvidia/nemotron-3.5-lightning:free",
  config.openrouterModel,
  config.openrouterFallbackModel,
].filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i);

const STRUCTURED_MODEL_CASCADE = [
  "nvidia/nemotron-3.5-lightning:free",
  "inclusionai/ling-3.2-flash:free",
  "openrouter/free",
  config.openrouterFallbackModel,
  config.openrouterModel,
  "cohere/north-mini-code:free",
].filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i);

export async function callOpenRouter(
  messages: ChatMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    timeoutMs?: number;
  } = {},
): Promise<{ content: string; model: string }> {
  if (!config.openrouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured in .env");
  }

  const errors: string[] = [];
  const timeoutMs = options.timeoutMs ?? 12000;
  const cascade = options.jsonMode ? STRUCTURED_MODEL_CASCADE : STREAM_MODEL_CASCADE;

  for (const model of cascade) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.openrouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "RoundTable Career Intelligence",
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.65,
          max_tokens: options.maxTokens ?? 1600,
          reasoning: { effort: "none" },
          ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        errors.push(`${model} (${response.status}): ${errBody.slice(0, 180)}`);
        continue;
      }

      const data = (await response.json()) as {
        model?: string;
        choices?: Array<{
          message?: {
            content?: string | null;
            reasoning?: string | null;
          };
        }>;
      };

      const msg = data.choices?.[0]?.message;
      const rawContent = (msg?.content || msg?.reasoning || "").trim();
      if (!rawContent) {
        errors.push(`${model}: empty message content`);
        continue;
      }

      const cleaned = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

      return { content: cleaned || rawContent, model: data.model ?? model };
    } catch (err) {
      errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(`All OpenRouter models failed: ${errors.join(" | ")}`);
}

export async function callOpenRouterStream(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number; timeoutMs?: number } = {},
  onSentence: (sentence: string) => void | Promise<void>,
): Promise<{ content: string; model: string }> {
  if (!config.openrouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured in .env");
  }

  const errors: string[] = [];
  const timeoutMs = options.timeoutMs ?? 10000;

  for (const model of STREAM_MODEL_CASCADE) {
    let emittedAny = false;
    let emittedText = "";
    let usedModel = model;
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.openrouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "RoundTable Career Intelligence",
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.65,
          max_tokens: options.maxTokens ?? 90,
          reasoning: { effort: "none" },
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        const errBody = await response.text().catch(() => "");
        errors.push(`${model} (${response.status}): ${errBody.slice(0, 140)}`);
        continue;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";
      let fullText = "";
      let sentenceBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") break;

          try {
            const parsed = JSON.parse(payload) as {
              model?: string;
              choices?: Array<{ delta?: { content?: string | null; reasoning?: string | null } }>;
            };
            if (parsed.model) usedModel = parsed.model;
            const delta = parsed.choices?.[0]?.delta?.content ?? "";
            if (!delta) continue;

            fullText += delta;
            sentenceBuffer += delta;

            // Emit the opening clause early (>= 18 chars & 3+ words at clause punctuation) so TTS starts fast,
            // then split remaining chunks cleanly on full sentence terminators.
            const sentenceMatch = sentenceBuffer.match(/^([\s\S]*?[.!?])\s+([\s\S]*)$/);
            const clauseMatch =
              !emittedAny && !sentenceMatch
                ? sentenceBuffer.match(/^([\s\S]{18,}?[,;:\u2014])\s+([\s\S]*)$/)
                : null;
            const match = sentenceMatch ?? clauseMatch;
            if (match?.[1]) {
              const readySentence = match[1]
                .replace(/<think>[\s\S]*?<\/think>/gi, "")
                .replace(/[*_`#]/g, "")
                .trim();
              const wordCount = readySentence.split(/\s+/).filter(Boolean).length;
              if (readySentence.length >= 4 && (sentenceMatch || wordCount >= 3)) {
                sentenceBuffer = match[2] ?? "";
                emittedAny = true;
                emittedText = emittedText ? `${emittedText} ${readySentence}` : readySentence;
                await onSentence(readySentence);
              }
            }
          } catch {
            // Skip partial JSON frames
          }
        }
      }

      const cleanedRemaining = sentenceBuffer
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/[*_`#]/g, "")
        .trim();
      if (cleanedRemaining.length >= 2) {
        emittedAny = true;
        emittedText = emittedText ? `${emittedText} ${cleanedRemaining}` : cleanedRemaining;
        await onSentence(cleanedRemaining);
      }

      const finalClean = fullText
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/[*_`#]/g, "")
        .trim();

      if (!finalClean) {
        if (!emittedAny) {
          errors.push(`${model}: empty stream content`);
          continue;
        }
      }

      return { content: finalClean || emittedText, model: usedModel };
    } catch (err) {
      if (emittedAny && emittedText.trim()) {
        return { content: emittedText.trim(), model: usedModel };
      }
      errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(`All OpenRouter streaming models failed: ${errors.join(" | ")}`);
}

function tryParseRelaxedJson<T>(snippet: string): T {
  try {
    return JSON.parse(snippet) as T;
  } catch {
    const cleaned = snippet
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    return JSON.parse(cleaned) as T;
  }
}

export async function callOpenRouterJson<T>(
  messages: ChatMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  } = {},
): Promise<{ data: T; model: string }> {
  if (!config.openrouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured in .env");
  }

  const errors: string[] = [];
  const timeoutMs = options.timeoutMs ?? 14000;

  for (const model of STRUCTURED_MODEL_CASCADE) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.openrouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "RoundTable Career Intelligence",
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.45,
          max_tokens: options.maxTokens ?? 1600,
          reasoning: { effort: "none" },
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        errors.push(`${model} (${response.status}): ${errBody.slice(0, 140)}`);
        continue;
      }

      const payload = (await response.json()) as {
        model?: string;
        choices?: Array<{ message?: { content?: string | null; reasoning?: string | null } }>;
      };
      const rawContent = (
        payload.choices?.[0]?.message?.content ||
        payload.choices?.[0]?.message?.reasoning ||
        ""
      ).trim();
      if (!rawContent) {
        errors.push(`${model}: empty JSON response`);
        continue;
      }

      const data = extractJsonFromLlm<T>(rawContent);
      return { data, model: payload.model ?? model };
    } catch (err) {
      errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(`All OpenRouter JSON models failed: ${errors.join(" | ")}`);
}

export function extractJsonFromLlm<T>(raw: string): T {
  const withoutThink = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fencedMatch = withoutThink.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fencedMatch?.[1] ?? withoutThink).trim();

  try {
    return tryParseRelaxedJson<T>(candidate);
  } catch {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return tryParseRelaxedJson<T>(candidate.slice(firstBrace, lastBrace + 1));
    }
    const firstBracket = candidate.indexOf("[");
    const lastBracket = candidate.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      return tryParseRelaxedJson<T>(candidate.slice(firstBracket, lastBracket + 1));
    }
    throw new Error("Could not parse JSON from LLM output");
  }
}
