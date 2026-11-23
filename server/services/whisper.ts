import { config } from "../config";

const WHISPER_MODEL_ID = "Xenova/whisper-tiny.en";

type AsrPipeline = (
  audio: Float32Array,
  options?: { chunk_length_s?: number; stride_length_s?: number },
) => Promise<{ text?: string } | Array<{ text?: string }>>;

function decodeWavToMono16k(wavBuffer: Buffer): Float32Array {
  if (wavBuffer.length < 44 || wavBuffer.toString("ascii", 0, 4) !== "RIFF") {
    throw new Error("Invalid WAV audio payload");
  }

  let audioFormat = 1; // 1 = PCM, 3 = IEEE float
  let numChannels = 1;
  let sampleRate = 16000;
  let bitsPerSample = 16;
  let dataOffset = 44;
  let dataLength = Math.max(0, wavBuffer.length - 44);

  let offset = 12;
  while (offset + 8 <= wavBuffer.length) {
    const chunkId = wavBuffer.toString("ascii", offset, offset + 4);
    const chunkSize = wavBuffer.readUInt32LE(offset + 4);
    const bodyStart = offset + 8;

    if (chunkId === "fmt " && bodyStart + 16 <= wavBuffer.length) {
      audioFormat = wavBuffer.readUInt16LE(bodyStart);
      numChannels = Math.max(1, wavBuffer.readUInt16LE(bodyStart + 2));
      sampleRate = wavBuffer.readUInt32LE(bodyStart + 4);
      bitsPerSample = wavBuffer.readUInt16LE(bodyStart + 14);
    } else if (chunkId === "data") {
      dataOffset = bodyStart;
      dataLength = Math.min(chunkSize, wavBuffer.length - bodyStart);
      break;
    }

    offset = bodyStart + chunkSize + (chunkSize % 2);
  }

  const bytesPerSample = Math.max(1, bitsPerSample / 8);
  const totalFrames = Math.floor(dataLength / (bytesPerSample * numChannels));
  const mono = new Float32Array(totalFrames);

  for (let i = 0; i < totalFrames; i += 1) {
    let sum = 0;
    for (let ch = 0; ch < numChannels; ch += 1) {
      const sampleOffset = dataOffset + (i * numChannels + ch) * bytesPerSample;
      let val = 0;
      if (audioFormat === 3 && bitsPerSample === 32 && sampleOffset + 4 <= wavBuffer.length) {
        val = wavBuffer.readFloatLE(sampleOffset);
      } else if (bitsPerSample === 16 && sampleOffset + 2 <= wavBuffer.length) {
        val = wavBuffer.readInt16LE(sampleOffset) / 32768;
      } else if (bitsPerSample === 32 && sampleOffset + 4 <= wavBuffer.length) {
        val = wavBuffer.readInt32LE(sampleOffset) / 2147483648;
      }
      sum += val;
    }
    mono[i] = sum / numChannels;
  }

  if (sampleRate === 16000) {
    return mono;
  }

  const targetLen = Math.max(1, Math.floor((mono.length * 16000) / sampleRate));
  const resampled = new Float32Array(targetLen);
  const ratio = sampleRate / 16000;
  for (let i = 0; i < targetLen; i += 1) {
    const srcPos = i * ratio;
    const idx0 = Math.floor(srcPos);
    const idx1 = Math.min(mono.length - 1, idx0 + 1);
    const frac = srcPos - idx0;
    resampled[i] = (mono[idx0] ?? 0) * (1 - frac) + (mono[idx1] ?? 0) * frac;
  }
  return resampled;
}

class WhisperService {
  private asrPromise: Promise<AsrPipeline> | null = null;
  private ready = false;
  private loading = false;
  private lastError: string | null = null;
  private queue: Promise<void> = Promise.resolve();

  private async loadModel(): Promise<AsrPipeline> {
    if (!this.asrPromise) {
      this.loading = true;
      this.lastError = null;
      this.asrPromise = (async () => {
        const { env, pipeline } = await import("@huggingface/transformers");
        if (config.hfCacheDir) {
          env.cacheDir = config.hfCacheDir;
        }
        return pipeline("automatic-speech-recognition", WHISPER_MODEL_ID, {
          dtype: "q8",
          device: "cpu",
        });
      })()
        .then((instance) => {
          this.ready = true;
          this.loading = false;
          console.log(`[Whisper STT] Ready (${WHISPER_MODEL_ID}, dtype=q8)`);
          return instance as unknown as AsrPipeline;
        })
        .catch((err) => {
          this.loading = false;
          this.asrPromise = null;
          this.lastError = err instanceof Error ? err.message : String(err);
          throw err;
        });
    }
    return this.asrPromise;
  }

  public warmup() {
    this.loadModel().catch((err) => {
      console.warn(
        "[Whisper STT] Warmup deferred/failed:",
        err instanceof Error ? err.message : err,
      );
    });
  }

  public getStatus() {
    return {
      ready: this.ready,
      loading: this.loading,
      error: this.lastError,
      model: WHISPER_MODEL_ID,
    };
  }

  public async transcribeWav(wavBuffer: Buffer): Promise<{ text: string; elapsedMs: number }> {
    const t0 = Date.now();
    const pcm16k = decodeWavToMono16k(wavBuffer);

    // Quick energy check to avoid hallucinating text on pure silence
    let energy = 0;
    for (let i = 0; i < pcm16k.length; i += 4) {
      const s = pcm16k[i] ?? 0;
      energy += s * s;
    }
    const rms = Math.sqrt(energy / Math.max(1, pcm16k.length / 4));
    if (pcm16k.length < 2400 || rms < 0.0025) {
      return { text: "", elapsedMs: Date.now() - t0 };
    }

    const text = await new Promise<string>((resolve, reject) => {
      this.queue = this.queue.then(async () => {
        try {
          const asr = await this.loadModel();
          const result = await asr(pcm16k, { chunk_length_s: 25, stride_length_s: 4 });
          const rawText = Array.isArray(result)
            ? result.map((r) => r.text ?? "").join(" ")
            : (result.text ?? "");
          const cleaned = rawText
            .replace(/\[(?:BLANK_AUDIO|INAUDIBLE|MUSIC|APPLAUSE|LAUGHTER|SILENCE)\]/gi, "")
            .replace(/\((?:upbeat music|music|silence|inaudible|applause|laughter)\)/gi, "")
            .replace(/\s+/g, " ")
            .trim();
          resolve(cleaned);
        } catch (err) {
          reject(err);
        }
      });
    });

    return { text, elapsedMs: Date.now() - t0 };
  }
}

export const whisperService = new WhisperService();
