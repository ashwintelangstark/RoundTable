import dns from "node:dns";
import { config, getOpenRouterApiKey } from "../config.js";

dns.setDefaultResultOrder("ipv4first");

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

class OpenRouterAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterAuthError";
  }
}

const STREAM_MODEL_CASCADE = [
  "nvidia/nemotron-3.5-super-vl:free",
  config.openrouterModel,
  "nvidia/nemotron-3.5-lightning:free",
  "openrouter/free",
  "google/gemma-4-31b-it:free",
  "baidu/ernie-5.5-flash-preview:free",
  config.openrouterFallbackModel,
].filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i);

const STRUCTURED_MODEL_CASCADE = [
  config.openrouterModel,
  "nvidia/nemotron-3.5-lightning:free",
  "google/gemma-4-31b-it:free",
  "openrouter/free",
  "nvidia/nemotron-3.5-super-vl:free",
  "baidu/ernie-5.5-flash-preview:free",
  config.openrouterFallbackModel,
].filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i);

function requireOpenRouterKey(): string {
  const key = getOpenRouterApiKey() || config.openrouterApiKey;
  if (!key) {
    throw new OpenRouterAuthError(
      "OPENROUTER_API_KEY is not configured. Set OPENROUTER_API_KEY in Vercel Project Settings → Environment Variables (Production) and redeploy.",
    );
  }
  return key;
}

function openRouterHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": config.appUrl,
    "X-Title": "RoundTable Career Intelligence",
  };
}

function buildAuthError(status: number, errBody: string): OpenRouterAuthError {
  return new OpenRouterAuthError(
    `OpenRouter authentication failed (${status}): ${errBody.slice(0, 160)}. Ensure OPENROUTER_API_KEY in Vercel Environment Variables is set to your valid sk-or-v1-... key (without quotes or "Bearer ") and redeploy.`,
  );
}

async function postOpenRouter(
  apiKey: string,
  requestBody: Record<string, unknown>,
  timeoutMs: number,
): Promise<Response> {
  const attempt = (body: Record<string, unknown>) =>
    fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: openRouterHeaders(apiKey),
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify(body),
    });

  let currentBody: Record<string, unknown> = { ...requestBody };
  let response = await attempt(currentBody);

  // Some providers reject `response_format` with HTTP 400; retry keeping `reasoning` first
  if (response.status === 400 && "response_format" in currentBody) {
    const withoutFormat = { ...currentBody };
    delete withoutFormat["response_format"];
    currentBody = withoutFormat;
    response = await attempt(currentBody);
  }

  // Some providers reject `reasoning` parameter with HTTP 400; retry without it
  if (response.status === 400 && "reasoning" in currentBody) {
    const withoutReasoning = { ...currentBody };
    delete withoutReasoning["reasoning"];
    currentBody = withoutReasoning;
    response = await attempt(currentBody);
  }

  return response;
}

export async function callOpenRouter(
  messages: ChatMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    timeoutMs?: number;
  } = {},
): Promise<{ content: string; model: string }> {
  const apiKey = requireOpenRouterKey();
  const errors: string[] = [];
  const timeoutMs = options.timeoutMs ?? 15000;
  const cascade = options.jsonMode ? STRUCTURED_MODEL_CASCADE : STREAM_MODEL_CASCADE;

  for (const model of cascade) {
    try {
      const requestBody: Record<string, unknown> = {
        model,
        messages,
        temperature: options.temperature ?? 0.65,
        max_tokens: options.maxTokens ?? 1600,
        reasoning: { effort: "none" },
        ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
      };

      const response = await postOpenRouter(apiKey, requestBody, timeoutMs);

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        if (response.status === 401 || response.status === 403) {
          throw buildAuthError(response.status, errBody);
        }
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
      const primaryContent = (msg?.content ?? "").trim();
      const rawContent = primaryContent || (msg?.reasoning ?? "").trim();
      if (!rawContent) {
        errors.push(`${model}: empty message content`);
        continue;
      }

      const cleaned = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      return { content: cleaned || rawContent, model: data.model ?? model };
    } catch (err) {
      if (err instanceof OpenRouterAuthError) {
        throw err;
      }
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
  const apiKey = requireOpenRouterKey();
  const errors: string[] = [];
  const timeoutMs = options.timeoutMs ?? 12000;
  const maxTokens = options.maxTokens ?? 120;

  for (const model of STREAM_MODEL_CASCADE) {
    let emittedAny = false;
    let emittedText = "";
    let usedModel = model;
    try {
      const response = await postOpenRouter(
        apiKey,
        {
          model,
          messages,
          temperature: options.temperature ?? 0.65,
          max_tokens: maxTokens,
          reasoning: { effort: "none" },
          stream: true,
        },
        timeoutMs,
      );

      if (!response.ok || !response.body) {
        const errBody = await response.text().catch(() => "");
        if (response.status === 401 || response.status === 403) {
          throw buildAuthError(response.status, errBody);
        }
        errors.push(`${model} (${response.status}): ${errBody.slice(0, 140)}`);
        continue;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";
      let fullText = "";
      let sentenceBuffer = "";

      const processLine = async (rawLine: string): Promise<boolean> => {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) return false;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return true;

        try {
          const parsed = JSON.parse(payload) as {
            model?: string;
            choices?: Array<{ delta?: { content?: string | null; reasoning?: string | null } }>;
          };
          if (parsed.model) usedModel = parsed.model;
          const delta = parsed.choices?.[0]?.delta?.content ?? "";
          if (!delta) return false;

          fullText += delta;
          sentenceBuffer += delta;

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
        return false;
      };

      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          if (await processLine(rawLine)) {
            streamDone = true;
            break;
          }
        }
      }

      if (!streamDone && sseBuffer.trim()) {
        await processLine(sseBuffer);
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

      if (!finalClean && !emittedAny) {
        errors.push(`${model}: empty stream content`);
        continue;
      }

      return { content: finalClean || emittedText, model: usedModel };
    } catch (err) {
      if (err instanceof OpenRouterAuthError) {
        throw err;
      }
      if (emittedAny && emittedText.trim()) {
        return { content: emittedText.trim(), model: usedModel };
      }
      errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Fallback to non-streaming completion and emit sentences so live panel streaming never fails
  try {
    const fallback = await callOpenRouter(messages, {
      temperature: options.temperature ?? 0.65,
      maxTokens: Math.max(120, maxTokens),
      timeoutMs: Math.max(12000, timeoutMs),
    });
    const clean = fallback.content
      .replace(/[*_`#]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const parts = clean
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const part of parts.length > 0 ? parts : [clean]) {
      if (part) await onSentence(part);
    }
    return { content: clean, model: fallback.model };
  } catch (fallbackErr) {
    if (fallbackErr instanceof OpenRouterAuthError) {
      throw fallbackErr;
    }
    throw new Error(`All OpenRouter streaming models failed: ${errors.join(" | ")}`);
  }
}

function tryParseRelaxedJson<T>(snippet: string): T {
  try {
    return JSON.parse(snippet) as T;
  } catch {
    const withoutTrailingCommas = snippet.replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(withoutTrailingCommas) as T;
    } catch {
      const quotedKeys = withoutTrailingCommas.replace(
        /([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
        '$1"$2":',
      );
      return JSON.parse(quotedKeys) as T;
    }
  }
}

function scanBalancedJsonBlocks(text: string, openChar: "{" | "[", closeChar: "}" | "]"): string[] {
  const blocks: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === openChar) {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === closeChar && depth > 0) {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        blocks.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return blocks.sort((a, b) => b.length - a.length);
}

export function extractJsonFromLlm<T>(raw: string, options: { expectObject?: boolean } = {}): T {
  const expectObject = options.expectObject ?? true;
  const withoutThink = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  const candidates: string[] = [];
  for (const match of withoutThink.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    if (match[1]?.trim()) candidates.push(match[1].trim());
  }
  candidates.push(withoutThink);
  candidates.push(...scanBalancedJsonBlocks(withoutThink, "{", "}"));
  if (!expectObject) {
    candidates.push(...scanBalancedJsonBlocks(withoutThink, "[", "]"));
  }

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    try {
      const parsed = tryParseRelaxedJson<T>(candidate);
      if (
        expectObject &&
        (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
      ) {
        continue;
      }
      return parsed;
    } catch {
      // Try next candidate block
    }
  }

  throw new Error("Could not parse JSON from LLM output");
}

export async function callOpenRouterJson<T>(
  messages: ChatMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
    expectObject?: boolean;
    validate?: (data: T) => boolean;
  } = {},
): Promise<{ data: T; model: string }> {
  const apiKey = requireOpenRouterKey();
  const errors: string[] = [];
  const timeoutMs = options.timeoutMs ?? 18000;
  const expectObject = options.expectObject ?? true;

  for (const model of STRUCTURED_MODEL_CASCADE) {
    try {
      const requestBody: Record<string, unknown> = {
        model,
        messages,
        temperature: options.temperature ?? 0.45,
        max_tokens: options.maxTokens ?? 1600,
        reasoning: { effort: "none" },
        response_format: { type: "json_object" },
      };

      const response = await postOpenRouter(apiKey, requestBody, timeoutMs);

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        if (response.status === 401 || response.status === 403) {
          throw buildAuthError(response.status, errBody);
        }
        errors.push(`${model} (${response.status}): ${errBody.slice(0, 140)}`);
        continue;
      }

      const payload = (await response.json()) as {
        model?: string;
        choices?: Array<{ message?: { content?: string | null; reasoning?: string | null } }>;
      };
      const primaryContent = (payload.choices?.[0]?.message?.content ?? "").trim();
      const rawContent = primaryContent || (payload.choices?.[0]?.message?.reasoning ?? "").trim();
      if (!rawContent) {
        errors.push(`${model}: empty JSON response`);
        continue;
      }

      const data = extractJsonFromLlm<T>(rawContent, { expectObject });
      if (options.validate && !options.validate(data)) {
        errors.push(`${model}: JSON response missing required fields`);
        continue;
      }
      return { data, model: payload.model ?? model };
    } catch (err) {
      if (err instanceof OpenRouterAuthError) {
        throw err;
      }
      errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(`All OpenRouter JSON models failed: ${errors.join(" | ")}`);
}
