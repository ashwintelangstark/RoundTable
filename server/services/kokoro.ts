import fs from "node:fs";
import type { KokoroTTS } from "kokoro-js";
import { config } from "../config.js";

export type AgentVoiceProfile = {
  agent: "Nikhil" | "ananya" | "Daniel" | "sarah" | "Marcus";
  voiceId: string;
  speed: number;
  label: string;
};

// Five distinct, natural neural voices from Kokoro-82M (no robotic/mechanical fallback).
export const AGENT_VOICES: Record<AgentVoiceProfile["agent"], AgentVoiceProfile> = {
  Nikhil: {
    agent: "Nikhil",
    voiceId: "am_puck",
    speed: 1.02,
    label: "Kokoro Neural · Puck (Strategist)",
  },
  ananya: {
    agent: "ananya",
    voiceId: "af_heart",
    speed: 1.0,
    label: "Kokoro Neural · Heart (Grade-A Analyst)",
  },
  Daniel: {
    agent: "Daniel",
    voiceId: "bm_daniel",
    speed: 0.98,
    label: "Kokoro Neural · Daniel (British Systems Lead)",
  },
  sarah: {
    agent: "sarah",
    voiceId: "af_sarah",
    speed: 1.0,
    label: "Kokoro Neural · Sarah (Warm People Lead)",
  },
  Marcus: {
    agent: "Marcus",
    voiceId: "bm_george",
    speed: 0.94,
    label: "Kokoro Neural · George (Executive Bar Raiser)",
  },
};

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

function encodeFloat32ToWav(samples: Float32Array, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataLength = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataLength);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataLength, 40);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    buffer.writeInt16LE(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, offset);
    offset += 2;
  }

  return buffer;
}

export function splitSpeechChunks(rawText: string): string[] {
  const clean = rawText
    .replace(/[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
  if (!clean) return [];

  // Split by sentence boundaries first
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const s of sentences) {
    // Keep the very first chunk ultra-short (<= 48 chars at natural comma/clause break) so voice starts fast
    const maxLen = chunks.length === 0 ? 48 : 88;
    if (s.length <= maxLen) {
      chunks.push(s);
    } else {
      // Split long sentences cleanly at punctuation boundaries for low time-to-first-audio
      const subParts = s
        .split(/(?<=[,;:\u2014])\s+/)
        .map((p) => p.trim())
        .filter(Boolean);
      let acc = "";
      for (const part of subParts) {
        if (!acc) {
          acc = part;
        } else if (acc.length + part.length < maxLen) {
          acc = `${acc} ${part}`;
        } else {
          chunks.push(acc);
          acc = part;
        }
      }
      if (acc) chunks.push(acc);
    }
  }
  return chunks.length > 0 ? chunks : [clean];
}

class KokoroService {
  private ttsPromise: Promise<KokoroTTS> | null = null;
  private ready = false;
  private loading = false;
  private lastError: string | null = null;
  private cache = new Map<string, Buffer>();
  private inFlight = new Map<string, Promise<Buffer>>();
  private queue: Promise<void> = Promise.resolve();

  private async loadModel(): Promise<KokoroTTS> {
    if (!this.ttsPromise) {
      this.loading = true;
      this.lastError = null;
      this.ttsPromise = (async () => {
        if (config.hfCacheDir) {
          fs.mkdirSync(config.hfCacheDir, { recursive: true });
          const { env } = await import("@huggingface/transformers");
          env.cacheDir = config.hfCacheDir;
        }
        const { KokoroTTS: KokoroTTSClass } = await import("kokoro-js");
        return KokoroTTSClass.from_pretrained(MODEL_ID, {
          dtype: config.kokoroDtype,
          device: "cpu",
        });
      })()
        .then((instance) => {
          this.ready = true;
          this.loading = false;
          console.log(`[Kokoro TTS] Ready (${MODEL_ID}, dtype=${config.kokoroDtype})`);
          return instance;
        })
        .catch((err) => {
          this.loading = false;
          this.ttsPromise = null;
          this.lastError = err instanceof Error ? err.message : String(err);
          throw err;
        });
    }
    return this.ttsPromise;
  }

  public warmup() {
    this.loadModel().catch((err) => {
      console.warn(
        "[Kokoro TTS] Warmup deferred/failed:",
        err instanceof Error ? err.message : err,
      );
    });
  }

  public getStatus() {
    return {
      ready: this.ready,
      loading: this.loading,
      error: this.lastError,
      model: MODEL_ID,
      voices: AGENT_VOICES,
    };
  }

  public resolveProfile(agentName: string = "Nikhil"): AgentVoiceProfile {
    const normalizedAgent =
      (Object.keys(AGENT_VOICES).find((k) => k.toLowerCase() === agentName.toLowerCase()) as
        AgentVoiceProfile["agent"] | undefined) ?? "Nikhil";
    return AGENT_VOICES[normalizedAgent];
  }

  private synthesizeSingleInternal(cleanText: string, profile: AgentVoiceProfile): Promise<Buffer> {
    const cacheKey = `${profile.voiceId}:${profile.speed}:${cleanText}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return Promise.resolve(cached);
    }

    const existing = this.inFlight.get(cacheKey);
    if (existing) {
      return existing;
    }

    // Serialize ONNX synthesis calls so concurrent turns don't thrash CPU threads
    const resultPromise = new Promise<Buffer>((resolve, reject) => {
      this.queue = this.queue
        .then(async () => {
          const againCached = this.cache.get(cacheKey);
          if (againCached) {
            resolve(againCached);
            return;
          }
          try {
            const tts = await this.loadModel();
            const audio = await tts.generate(cleanText, {
              voice: profile.voiceId as never,
              speed: profile.speed,
            });

            let wavBuffer: Buffer;
            const maybeToWav = (audio as { toWav?: () => Uint8Array | ArrayBuffer }).toWav;
            if (typeof maybeToWav === "function") {
              const raw = maybeToWav.call(audio);
              wavBuffer = Buffer.from(raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw);
            } else {
              const audioObj = audio as { audio: Float32Array; sampling_rate?: number };
              wavBuffer = encodeFloat32ToWav(audioObj.audio, audioObj.sampling_rate ?? 24000);
            }

            if (this.cache.size >= 140) {
              const oldestKey = this.cache.keys().next().value;
              if (oldestKey) this.cache.delete(oldestKey);
            }
            this.cache.set(cacheKey, wavBuffer);
            resolve(wavBuffer);
          } catch (err) {
            reject(err);
          }
        })
        .catch(() => {
          // Keep serial queue alive after individual errors
        });
    }).finally(() => {
      this.inFlight.delete(cacheKey);
    });

    this.inFlight.set(cacheKey, resultPromise);
    return resultPromise;
  }

  public async synthesize(
    text: string,
    agentName: string = "Nikhil",
  ): Promise<{ wav: Buffer; voice: AgentVoiceProfile }> {
    const profile = this.resolveProfile(agentName);
    const cleanText = text
      .replace(/[*_`#]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 900);

    if (!cleanText) {
      throw new Error("Empty text provided for synthesis");
    }

    const wav = await this.synthesizeSingleInternal(cleanText, profile);
    return { wav, voice: profile };
  }

  public async streamSentences(
    text: string,
    agentName: string = "Nikhil",
    onChunk: (chunk: {
      index: number;
      total: number;
      text: string;
      wav: Buffer;
    }) => Promise<void> | void,
    signal?: AbortSignal,
  ): Promise<AgentVoiceProfile> {
    const profile = this.resolveProfile(agentName);
    const parts = splitSpeechChunks(text);
    if (parts.length === 0) {
      throw new Error("Empty text provided for synthesis");
    }

    for (let i = 0; i < parts.length; i += 1) {
      if (signal?.aborted) break;
      const chunkText = parts[i]!;
      const wav = await this.synthesizeSingleInternal(chunkText, profile);
      if (signal?.aborted) break;
      await onChunk({ index: i, total: parts.length, text: chunkText, wav });
    }
    return profile;
  }
}

export const kokoroService = new KokoroService();
