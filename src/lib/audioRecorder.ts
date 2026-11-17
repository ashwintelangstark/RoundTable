// ---------------------------------------------------------------------------
// Cross-Browser 16kHz Mono PCM WAV Mic Recorder (Zero-ffmpeg, Brave/Safari/Chrome safe)
// ---------------------------------------------------------------------------

function downsampleTo16k(chunks: Float32Array[], sourceSampleRate: number): Float32Array {
  let totalLength = 0;
  for (const chunk of chunks) {
    totalLength += chunk.length;
  }
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  if (sourceSampleRate === 16000) {
    return merged;
  }

  const targetLength = Math.max(1, Math.floor((merged.length * 16000) / sourceSampleRate));
  const resampled = new Float32Array(targetLength);
  const ratio = sourceSampleRate / 16000;
  for (let i = 0; i < targetLength; i += 1) {
    const pos = i * ratio;
    const idx0 = Math.floor(pos);
    const idx1 = Math.min(merged.length - 1, idx0 + 1);
    const frac = pos - idx0;
    resampled[i] = (merged[idx0] ?? 0) * (1 - frac) + (merged[idx1] ?? 0) * frac;
  }
  return resampled;
}

function encodeFloat32AsWavBlob(samples: Float32Array, sampleRate = 16000): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export class MicWavRecorder {
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private silentGain: GainNode | null = null;
  private chunks: Float32Array[] = [];
  private sampleRate = 48000;
  private startedAt = 0;
  private active = false;
  private ownsStream = false;
  private stream: MediaStream | null = null;

  public isRecording() {
    return this.active;
  }

  public async start(existingStream?: MediaStream | null): Promise<void> {
    this.cleanup();

    let media = existingStream ?? null;
    if (!media || media.getAudioTracks().length === 0) {
      media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.ownsStream = true;
    } else {
      media.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });
      this.ownsStream = false;
    }

    this.stream = media;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    this.ctx = ctx;
    this.sampleRate = ctx.sampleRate || 48000;
    this.chunks = [];
    this.startedAt = Date.now();
    this.active = true;

    const src = ctx.createMediaStreamSource(media);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const silent = ctx.createGain();
    silent.gain.value = 0;

    proc.onaudioprocess = (ev) => {
      if (!this.active) return;
      const inputData = ev.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(inputData));
    };

    src.connect(proc);
    proc.connect(silent);
    silent.connect(ctx.destination);

    this.source = src;
    this.processor = proc;
    this.silentGain = silent;
  }

  public async stop(): Promise<{ wavBlob: Blob; durationSec: number }> {
    const durationSec = this.startedAt > 0 ? (Date.now() - this.startedAt) / 1000 : 0;
    const capturedChunks = this.chunks.slice();
    const sr = this.sampleRate;
    this.cleanup();

    const mono16k = downsampleTo16k(capturedChunks, sr);
    const wavBlob = encodeFloat32AsWavBlob(mono16k, 16000);
    return { wavBlob, durationSec };
  }

  public cancel() {
    this.cleanup();
  }

  private cleanup() {
    this.active = false;
    try {
      this.processor?.disconnect();
    } catch {
      // Ignore disconnect error
    }
    try {
      this.source?.disconnect();
    } catch {
      // Ignore disconnect error
    }
    try {
      this.silentGain?.disconnect();
    } catch {
      // Ignore disconnect error
    }
    if (this.ctx && this.ctx.state !== "closed") {
      void this.ctx.close();
    }
    if (this.ownsStream && this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }
    this.processor = null;
    this.source = null;
    this.silentGain = null;
    this.ctx = null;
    this.stream = null;
    this.chunks = [];
    this.ownsStream = false;
  }
}
