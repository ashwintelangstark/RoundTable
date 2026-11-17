import type { PanelAgentName } from "@/game/interview/team";

export interface InterviewRecordingRow {
  id: number;
  interview_id: number;
  attempt_number: number;
  round_type: string;
  approach: string;
  recording_url: string;
  file_size: number;
  duration_seconds: number;
  created_at: string;
}

export interface InterviewSession {
  id: number;
  parent_interview_id?: number | null;
  candidate_name: string;
  email: string;
  company_name: string;
  role: string;
  company_desc: string;
  job_description: string;
  resume_filename: string;
  resume_text: string;
  duration_minutes: number;
  difficulty: string;
  round_type?: string;
  approach: string;
  experience_level: string;
  status: string;
  overall_score: number | null;
  recording_url?: string | null;
  recordings_count?: number;
  created_at: string;
  updated_at: string;
}

export interface InterviewMessage {
  id?: number;
  interview_id?: number;
  speaker: PanelAgentName | "You" | string;
  role: "user" | "assistant" | "system";
  content: string;
  phase: string;
  created_at?: string;
}

export interface CvAnalysis {
  face_detected: boolean;
  expression: string;
  eye_contact_score: number;
  smile_score: number;
  composure_score: number;
  engagement_score: number;
  head_offset_x: number;
  head_offset_y: number;
  face_box: { x: number; y: number; w: number; h: number } | null;
  eyes: Array<{ x: number; y: number; w: number; h: number }>;
  smile_detected: boolean;
  lighting_ok: boolean;
  opencv_version?: string;
}

export interface AgentDomainReportRow {
  id: number;
  interview_id: number;
  agent: string;
  domain_title: string;
  score: number;
  verdict: string;
  summary: string;
  strengths_json: string;
  improvements_json: string;
  question_reviews_json: string;
  metrics_json: string;
  created_at: string;
  candidate_name?: string;
  company_name?: string;
  role?: string;
  round_type?: string;
  approach?: string;
  difficulty?: string;
  duration_minutes?: number;
  recording_url?: string | null;
  recordings?: InterviewRecordingRow[];
}

export interface AssessmentReportRow {
  id: number;
  interview_id: number;
  overall_score: number;
  verdict: string;
  summary: string;
  breakdown_json: string;
  cv_summary_json: string;
  panel_notes_json: string;
  roadmap_json: string;
  created_at: string;
  candidate_name?: string;
  company_name?: string;
  role?: string;
  round_type?: string;
  approach?: string;
  difficulty?: string;
  duration_minutes?: number;
  recording_url?: string | null;
  recordings?: InterviewRecordingRow[];
}

export interface PanelStreamChunkEvent {
  type: "turn_chunk";
  index: number;
  speaker: PanelAgentName;
  phase: string;
  text: string;
  questionNumber: number;
  totalQuestions: number;
  agentQuestionIndex: number;
  isFinalInterviewQuestion: boolean;
  isInterviewComplete: boolean;
  wavBase64?: string | null;
}

export interface PanelStreamDoneEvent {
  type: "turn_done";
  speaker: PanelAgentName;
  phase: string;
  reply: string;
  questionNumber: number;
  totalQuestions: number;
  agentQuestionIndex: number;
  isFinalInterviewQuestion: boolean;
  isInterviewComplete: boolean;
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || `Request failed (${res.status})`);
  }
  if (!res.ok) {
    const errMsg = (parsed as { error?: string }).error ?? `Request failed (${res.status})`;
    throw new Error(errMsg);
  }
  return parsed as T;
}

export const api = {
  health: () =>
    apiJson<{
      ok: boolean;
      database: string;
      kokoro: { ready: boolean; loading: boolean; error: string | null };
      opencv: { ready: boolean; opencvVersion: string };
      openrouterConfigured: boolean;
    }>("/api/health"),

  dashboard: () =>
    apiJson<{
      stats: {
        completedCount: number;
        totalCount: number;
        avgReadiness: number;
        resumeStrength: number;
        practiceCount: number;
      };
      recentInterviews: InterviewSession[];
    }>("/api/dashboard"),

  listInterviews: () => apiJson<{ interviews: InterviewSession[] }>("/api/interviews"),

  getInterview: (id: number) =>
    apiJson<{
      interview: InterviewSession;
      messages: InterviewMessage[];
      report: AssessmentReportRow | null;
      agentReports?: AgentDomainReportRow[];
      recordings?: InterviewRecordingRow[];
      cvSummary?: {
        sample_count: number;
        avg_eye_contact: number;
        avg_composure: number;
        avg_engagement: number;
        dominant_expression: string;
      };
    }>(`/api/interviews/${id}`),

  getGreeting: (id: number) =>
    apiJson<{
      speaker: PanelAgentName;
      role: "assistant";
      phase: string;
      content: string;
    }>(`/api/interviews/${id}/greeting`),

  uploadRecording: (id: number, blob: Blob, durationSeconds = 0) => {
    const fd = new FormData();
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    fd.append("recording", blob, `recording_${id}.${ext}`);
    fd.append("duration_seconds", String(Math.max(0, Math.round(durationSeconds))));
    return apiJson<{
      ok: boolean;
      recordingUrl: string;
      recording?: InterviewRecordingRow;
      recordings?: InterviewRecordingRow[];
    }>(`/api/interviews/${id}/recording`, {
      method: "POST",
      body: fd,
    });
  },

  transcribeAudio: async (wavBlob: Blob): Promise<{ text: string; elapsedMs: number }> => {
    const res = await fetch("/api/stt/transcribe", {
      method: "POST",
      headers: { "Content-Type": "audio/wav" },
      body: wavBlob,
    });
    const text = await res.text();
    let parsed: { text?: string; elapsedMs?: number; error?: string } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(text || `Speech recognition error (${res.status})`);
    }
    if (!res.ok) {
      throw new Error(parsed.error ?? `Speech recognition error (${res.status})`);
    }
    return { text: parsed.text ?? "", elapsedMs: parsed.elapsedMs ?? 0 };
  },

  createInterview: (formData: FormData) =>
    apiJson<{ interview: InterviewSession }>("/api/interviews", {
      method: "POST",
      body: formData,
    }),

  updateInterview: (id: number, formData: FormData) =>
    apiJson<{ interview: InterviewSession }>(`/api/interviews/${id}`, {
      method: "PUT",
      body: formData,
    }),

  repeatInterview: (
    id: number,
    payload: {
      round_type?: string;
      approach: string;
      duration_minutes?: number;
      difficulty?: string;
    },
  ) =>
    apiJson<{ interview: InterviewSession }>(`/api/interviews/${id}/repeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  deleteInterview: (id: number) =>
    apiJson<{ ok: boolean }>(`/api/interviews/${id}`, { method: "DELETE" }),

  startInterview: (id: number) =>
    apiJson<{
      speaker: PanelAgentName;
      phase: string;
      reply: string;
      model?: string;
      questionNumber?: number;
      totalQuestions?: number;
      agentQuestionIndex?: number;
    }>(`/api/interviews/${id}/start`, { method: "POST" }),

  respondInterview: (
    id: number,
    payload: { message: string; elapsedRatio: number; requestedAgent?: string | undefined },
  ) =>
    apiJson<{
      speaker: PanelAgentName;
      phase: string;
      reply: string;
      model?: string;
      questionNumber?: number;
      totalQuestions?: number;
      agentQuestionIndex?: number;
      isFinalInterviewQuestion?: boolean;
      isInterviewComplete?: boolean;
    }>(`/api/interviews/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  respondInterviewStream: async (
    id: number,
    payload: {
      message: string;
      elapsedRatio: number;
      requestedAgent?: string | undefined;
      withVoice?: boolean;
    },
    handlers: {
      onChunk: (ev: PanelStreamChunkEvent) => void;
      onDone: (ev: PanelStreamDoneEvent) => void;
    },
    signal?: AbortSignal,
  ): Promise<void> => {
    const res = await fetch(`/api/interviews/${id}/respond-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: signal ?? null,
    });
    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || `Panel stream failed (${res.status})`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        const parsed = JSON.parse(line) as
          PanelStreamChunkEvent | PanelStreamDoneEvent | { type: "error"; error?: string };
        if (parsed.type === "error") {
          throw new Error(parsed.error ?? "Panel response stream failed");
        } else if (parsed.type === "turn_chunk") {
          handlers.onChunk(parsed);
        } else if (parsed.type === "turn_done") {
          handlers.onDone(parsed);
        }
      }
    }
    if (buffer.trim()) {
      const parsed = JSON.parse(buffer.trim()) as
        PanelStreamChunkEvent | PanelStreamDoneEvent | { type: "error"; error?: string };
      if (parsed.type === "turn_chunk") handlers.onChunk(parsed);
      else if (parsed.type === "turn_done") handlers.onDone(parsed);
      else if (parsed.type === "error") throw new Error(parsed.error ?? "Stream error");
    }
  },

  completeInterview: (id: number) =>
    apiJson<{ report: AssessmentReportRow; agentReports?: AgentDomainReportRow[] }>(
      `/api/interviews/${id}/complete`,
      { method: "POST" },
    ),

  analyzeCvFrame: (payload: { image: string; interviewId?: number }) =>
    apiJson<CvAnalysis>("/api/cv/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  analyzeCareer: (payload: {
    companyName: string;
    role: string;
    companyDesc: string;
    jobDescription: string;
    interviewId?: number;
  }) =>
    apiJson<{
      analysis: {
        summary: string;
        company_signals: string[];
        competencies: Array<{ name: string; weight: number; expectation: string }>;
        hidden_expectations: string[];
        interview_themes: string[];
        prep_strategy: string[];
      };
      model: string;
    }>("/api/agents/career", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  careerHistory: () =>
    apiJson<{
      history: Array<{
        id: number;
        company_name: string;
        role: string;
        analysis_json: string;
        created_at: string;
      }>;
    }>("/api/agents/career/history"),

  analyzeResume: (formData: FormData) =>
    apiJson<{
      overall_score: number;
      filename: string;
      extractedPreview: string;
      model: string;
      analysis: {
        overall_score: number;
        subscores: {
          structure_readability: number;
          achievement_clarity: number;
          role_alignment: number;
          quantified_impact: number;
        };
        executive_summary: string;
        strengths: Array<{ title: string; detail: string }>;
        gaps: Array<{ title: string; severity: string; fix: string }>;
        bullet_rewrites: Array<{ original: string; improved: string; reason: string }>;
        missing_keywords: string[];
      };
    }>("/api/agents/resume", { method: "POST", body: formData }),

  resumeHistory: () =>
    apiJson<{
      history: Array<{
        id: number;
        filename: string;
        overall_score: number;
        analysis_json: string;
        created_at: string;
      }>;
    }>("/api/agents/resume/history"),

  generateTechQuestion: (payload: {
    domain: string;
    difficulty: string;
    format: string;
    role?: string;
    company?: string;
  }) =>
    apiJson<{
      data: { question: string; hints: string[]; rubric: string[] };
      model: string;
    }>("/api/agents/technical/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  evaluateTechAnswer: (payload: {
    domain: string;
    difficulty: string;
    format: string;
    question: string;
    answer: string;
  }) =>
    apiJson<{
      score: number;
      model: string;
      evaluation: {
        score: number;
        verdict: string;
        summary: string;
        strengths: string[];
        gaps: string[];
        follow_up_question: string;
        ideal_outline: string;
      };
    }>("/api/agents/technical/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  generateBehavioralQuestion: (payload: { category: string; role?: string; company?: string }) =>
    apiJson<{
      data: { question: string; signal_sought: string; star_tip: string };
      model: string;
    }>("/api/agents/behavioral/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  evaluateBehavioralAnswer: (payload: { category: string; question: string; answer: string }) =>
    apiJson<{
      score: number;
      model: string;
      evaluation: {
        score: number;
        star_scores: { situation: number; task: number; action: number; result: number };
        strengths: string[];
        coaching_feedback: string;
        polished_star_example: string;
      };
    }>("/api/agents/behavioral/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  practiceHistory: (agent?: "Daniel" | "sarah") =>
    apiJson<{
      history: Array<{
        id: number;
        agent: string;
        category: string;
        difficulty: string;
        format: string;
        question: string;
        user_answer: string;
        evaluation_json: string;
        score: number;
        created_at: string;
      }>;
    }>(`/api/agents/practice/history${agent ? `?agent=${agent}` : ""}`),

  listReports: () => apiJson<{ reports: AssessmentReportRow[] }>("/api/reports"),

  listAgentDomainReports: (agent: string) =>
    apiJson<{ reports: AgentDomainReportRow[] }>(`/api/reports/agent/${encodeURIComponent(agent)}`),

  getInterviewAgentReports: (interviewId: number) =>
    apiJson<{ agentReports: AgentDomainReportRow[] }>(
      `/api/interviews/${interviewId}/agent-reports`,
    ),
};

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ---------------------------------------------------------------------------
// Neural Voice Audio Controller (Streaming sentence chunks, zero double-queuing)
// ---------------------------------------------------------------------------
export interface SpeakCallbacks {
  onAmplitude?: (amp: number) => void;
  onStart?: () => void;
  onChunkStart?: (chunkText: string, chunkIndex: number) => void;
  onEnd?: () => void;
}

interface CachedAudioChunk {
  decoded: AudioBuffer;
  text: string;
}

export class StreamAudioQueue {
  private ctx: AudioContext;
  private analyser: AnalyserNode;
  private nextStartTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();
  private chunkTimers = new Set<number>();
  private started = false;
  private finished = false;
  private closed = false;
  private rafId: number | null = null;
  private callbacks: SpeakCallbacks;
  private onDoneResolve?: () => void;
  private decodeChain: Promise<void> = Promise.resolve();

  constructor(ctx: AudioContext, callbacks: SpeakCallbacks) {
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.connect(ctx.destination);
    this.nextStartTime = ctx.currentTime;
  }

  private startRmsLoop() {
    if (this.rafId !== null) return;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    const tick = () => {
      if (this.closed) return;
      this.analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const v = ((data[i] ?? 128) - 128) / 128;
        sum += v * v;
      }
      const rms = Math.min(1, Math.sqrt(sum / data.length) * 3.4);
      this.callbacks.onAmplitude?.(rms);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public enqueueBuffer(decoded: AudioBuffer, onChunkPlay?: () => void) {
    if (this.closed) return;
    const src = this.ctx.createBufferSource();
    src.buffer = decoded;
    src.connect(this.analyser);

    const startAt = Math.max(this.ctx.currentTime + 0.015, this.nextStartTime);
    const delayMs = Math.max(0, Math.round((startAt - this.ctx.currentTime) * 1000));
    this.nextStartTime = startAt + decoded.duration;
    this.activeSources.add(src);

    const fireStartCallbacks = () => {
      if (this.closed) return;
      if (!this.started) {
        this.started = true;
        this.callbacks.onStart?.();
        this.startRmsLoop();
      }
      onChunkPlay?.();
    };

    if (delayMs <= 20) {
      fireStartCallbacks();
    } else {
      const timerId = window.setTimeout(() => {
        this.chunkTimers.delete(timerId);
        fireStartCallbacks();
      }, delayMs);
      this.chunkTimers.add(timerId);
    }

    src.onended = () => {
      this.activeSources.delete(src);
      src.disconnect();
      if (this.finished && this.activeSources.size === 0 && !this.closed) {
        this.teardown();
        this.onDoneResolve?.();
      }
    };

    src.start(startAt);
  }

  public enqueueBase64Wav(wavBase64: string, onChunkPlay?: () => void) {
    if (this.closed || !wavBase64) return;
    this.decodeChain = this.decodeChain.then(async () => {
      if (this.closed) return;
      try {
        if (this.ctx.state === "suspended") await this.ctx.resume();
        const decoded = await this.ctx.decodeAudioData(base64ToArrayBuffer(wavBase64));
        this.enqueueBuffer(decoded, onChunkPlay);
      } catch {
        onChunkPlay?.();
      }
    });
  }

  public async finish(): Promise<void> {
    await this.decodeChain;
    if (this.closed) return;
    this.finished = true;
    if (this.activeSources.size === 0) {
      this.teardown();
      return;
    }
    await new Promise<void>((resolve) => {
      this.onDoneResolve = resolve;
    });
  }

  public stop() {
    this.teardown();
    this.onDoneResolve?.();
  }

  private teardown() {
    if (this.closed) return;
    this.closed = true;
    for (const tid of this.chunkTimers) {
      window.clearTimeout(tid);
    }
    this.chunkTimers.clear();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    for (const s of this.activeSources) {
      try {
        s.stop();
      } catch {
        // Ignore already-stopped source
      }
      s.disconnect();
    }
    this.activeSources.clear();
    try {
      this.analyser.disconnect();
    } catch {
      // Ignore disconnect error
    }
    this.callbacks.onAmplitude?.(0);
    if (this.started) {
      this.callbacks.onEnd?.();
    }
  }
}

class KokoroAudioController {
  private ctx: AudioContext | null = null;
  private activeQueue: StreamAudioQueue | null = null;
  private abortController: AbortController | null = null;
  private chunkCache = new Map<string, CachedAudioChunk[]>();
  private inFlight = new Map<string, Promise<CachedAudioChunk[] | null>>();

  private async ensureContext(): Promise<AudioContext> {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!this.ctx) this.ctx = new AudioCtx();
    if (this.ctx.state === "suspended") {
      await this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isCached(text: string, agent: string): boolean {
    const clean = text.trim();
    if (!clean) return false;
    return this.chunkCache.has(`${agent}::${clean}`);
  }

  public async prefetch(text: string, agent: string): Promise<CachedAudioChunk[] | null> {
    const clean = text.trim();
    if (!clean) return null;
    const key = `${agent}::${clean}`;
    if (this.chunkCache.has(key)) return this.chunkCache.get(key)!;
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const task = (async (): Promise<CachedAudioChunk[] | null> => {
      try {
        const ctx = await this.ensureContext();
        const response = await fetch("/api/tts/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: clean, agent }),
        });
        if (!response.ok || !response.body) return null;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const chunks: CachedAudioChunk[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            const parsed = JSON.parse(line) as { text?: string; wavBase64?: string };
            if (parsed.wavBase64) {
              const decoded = await ctx.decodeAudioData(base64ToArrayBuffer(parsed.wavBase64));
              chunks.push({ decoded, text: parsed.text ?? "" });
            }
          }
        }
        if (chunks.length > 0) {
          this.chunkCache.set(key, chunks);
          return chunks;
        }
        return null;
      } catch {
        return null;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, task);
    return task;
  }

  public stop() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.activeQueue) {
      this.activeQueue.stop();
      this.activeQueue = null;
    }
  }

  public async createStreamSession(callbacks: SpeakCallbacks = {}): Promise<StreamAudioQueue> {
    this.stop();
    const ctx = await this.ensureContext();
    const queue = new StreamAudioQueue(ctx, callbacks);
    this.activeQueue = queue;
    return queue;
  }

  public async speak(text: string, agent: string, options: SpeakCallbacks = {}): Promise<void> {
    const clean = text.trim();
    if (!clean) return;

    this.stop();
    const controller = new AbortController();
    this.abortController = controller;

    try {
      const ctx = await this.ensureContext();
      const key = `${agent}::${clean}`;

      // Reuse already-cached chunks immediately or await in-flight prefetch without duplicate synthesis!
      let cachedChunks = this.chunkCache.get(key);
      if (!cachedChunks && this.inFlight.has(key)) {
        cachedChunks = (await this.inFlight.get(key)) ?? undefined;
      }

      if (controller.signal.aborted) return;

      const queue = new StreamAudioQueue(ctx, options);
      this.activeQueue = queue;

      if (cachedChunks && cachedChunks.length > 0) {
        cachedChunks.forEach((item, idx) => {
          queue.enqueueBuffer(item.decoded, () => options.onChunkStart?.(item.text, idx));
        });
        await queue.finish();
        return;
      }

      const response = await fetch("/api/tts/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, agent }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Voice synthesis error (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      const collected: CachedAudioChunk[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (controller.signal.aborted) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;
          const parsed = JSON.parse(line) as {
            index?: number;
            text?: string;
            wavBase64?: string;
            error?: string;
          };
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.wavBase64 && !controller.signal.aborted) {
            const decoded = await ctx.decodeAudioData(base64ToArrayBuffer(parsed.wavBase64));
            const chunkText = parsed.text ?? "";
            const chunkIdx = parsed.index ?? collected.length;
            collected.push({ decoded, text: chunkText });
            queue.enqueueBuffer(decoded, () => options.onChunkStart?.(chunkText, chunkIdx));
          }
        }
      }

      if (collected.length > 0 && !controller.signal.aborted) {
        this.chunkCache.set(key, collected);
      }

      await queue.finish();
    } catch (err) {
      this.activeQueue?.stop();
      options.onAmplitude?.(0);
      options.onEnd?.();
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        throw err;
      }
    }
  }
}

export const kokoroPlayer = new KokoroAudioController();
