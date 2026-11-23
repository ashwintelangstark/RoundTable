import { Canvas } from "@react-three/fiber";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Cloud,
  CloudRain,
  CloudSun,
  FileCheck2,
  Keyboard,
  Mic,
  MicOff,
  Moon,
  Play,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  UploadCloud,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ModalDialog } from "@/components/ModalDialog";
import { useToast } from "@/components/ToastContext";
import { InterviewRoom } from "@/game/interview/room";
import { INTERVIEW_PANEL, type PanelAgentName } from "@/game/interview/team";
import { useEnvironment, type WeatherPresetMode } from "@/hooks/useEnvironment";
import { MicWavRecorder } from "@/lib/audioRecorder";
import {
  api,
  kokoroPlayer,
  type CvAnalysis,
  type InterviewMessage,
  type InterviewSession,
} from "@/lib/api";

function buildLocalGreeting(session: InterviewSession): string {
  const roundRaw = `${session.round_type ?? ""} ${session.approach ?? ""}`.toLowerCase();
  const isHr =
    roundRaw.includes("hr round") || roundRaw === "hr" || roundRaw.includes("behavioral heavy");
  if (isHr) {
    return `Welcome ${session.candidate_name}! I'm Nikhil for your ${session.company_name} HR Round. Question one: why does this ${session.role} role excite you right now?`;
  }
  return `Welcome ${session.candidate_name}! I'm Nikhil for your ${session.company_name} Technical Round. Question one: walk me through the hardest system you engineered and its key trade-offs.`;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart?: (() => void) | null;
  onresult:
    | ((ev: {
        resultIndex?: number;
        results: ArrayLike<{ isFinal: boolean; 0?: { transcript?: string } }>;
      }) => void)
    | null;
  onerror: ((ev?: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const AGENT_SEQUENCE: PanelAgentName[] = ["Nikhil", "ananya", "Daniel", "sarah", "Marcus"];
const QUESTIONS_PER_AGENT = 6;
const TOTAL_PANEL_QUESTIONS = AGENT_SEQUENCE.length * QUESTIONS_PER_AGENT; // 30

function computePanelProgress(completedUserTurns: number) {
  const boundedTurn = Math.max(0, Math.min(TOTAL_PANEL_QUESTIONS - 1, completedUserTurns));
  const agentIndex = Math.floor(boundedTurn / QUESTIONS_PER_AGENT);
  const currentAgent = AGENT_SEQUENCE[agentIndex] ?? "Marcus";
  const questionInTurn = (boundedTurn % QUESTIONS_PER_AGENT) + 1;
  const overallQuestion = boundedTurn + 1;
  return {
    currentAgent,
    agentIndex,
    questionInTurn,
    overallQuestion,
    totalQuestions: TOTAL_PANEL_QUESTIONS,
    isFinal: overallQuestion >= TOTAL_PANEL_QUESTIONS,
  };
}

export function InterviewRoomPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useToast();

  // Environment and dynamic weather engine
  const { environment, preset, setPreset } = useEnvironment();
  const [showPresetMenu, setShowPresetMenu] = useState(false);

  // Active interview session state
  const [activeSession, setActiveSession] = useState<InterviewSession | null>(null);
  const [messages, setMessages] = useState<InterviewMessage[]>([
    {
      speaker: "Nikhil",
      role: "assistant",
      phase: "Standby",
      content:
        "Welcome to RoundTable. Click the conference table in front of you to drop your resume and brief, or load a registered session to begin.",
    },
  ]);
  const [activeSpeaker, setActiveSpeaker] = useState<PanelAgentName>("Nikhil");
  const [targetAgentOverride, setTargetAgentOverride] = useState<PanelAgentName | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const speakingAmplitudeRef = useRef(0);

  // Pre-cached instant opening greeting
  const cachedGreetingRef = useRef<string | null>(null);

  // Interview live run state
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);
  const [totalSeconds, setTotalSeconds] = useState(15 * 60);
  const [answerText, setAnswerText] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [showTextComposer, setShowTextComposer] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [isRecordingAnswer, setIsRecordingAnswer] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isStreamingAgent, setIsStreamingAgent] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const micRecorderRef = useRef(new MicWavRecorder());
  const committedWebSpeechRef = useRef("");
  const webSpeechFailedRef = useRef(false);
  const streamAbortRef = useRef<AbortController | null>(null);

  // Google Meet Pre-Interview Green Room / Permissions Check
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [greenRoomTestedVoice, setGreenRoomTestedVoice] = useState(false);
  const [micVolumeMeter, setMicVolumeMeter] = useState(0);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micRafRef = useRef<number | null>(null);

  // Table Click Modal (Drop Resume + Candidate Setup)
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formCompanyDesc, setFormCompanyDesc] = useState("");
  const [formJd, setFormJd] = useState("");
  const [formDuration, setFormDuration] = useState("15");
  const [formRoundType, setFormRoundType] = useState("Technical Round");
  const [formApproach, setFormApproach] = useState("Standard Panel");
  const [formDifficulty, setFormDifficulty] = useState("Intermediate");
  const [formResume, setFormResume] = useState<File | null>(null);
  const [draggingResume, setDraggingResume] = useState(false);

  // Webcam, Vision Telemetry & Media Recording
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cvStats, setCvStats] = useState<CvAnalysis | null>(null);
  const [cvWindowMinimized, setCvWindowMinimized] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const greenRoomVideoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // MediaRecorder for storing every session attempt video recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartMsRef = useRef<number>(0);
  const recordingMimeRef = useRef<string>("video/webm");

  const { data: listData } = useQuery({
    queryKey: ["interviews"],
    queryFn: api.listInterviews,
  });

  const loadSessionIntoRoom = useCallback((session: InterviewSession) => {
    setActiveSession(session);
    const secs = (session.duration_minutes || 15) * 60;
    setTotalSeconds(secs);
    setSecondsLeft(secs);
    setFormName(session.candidate_name);
    setFormEmail(session.email);
    setFormCompany(session.company_name);
    setFormRole(session.role);
    setFormCompanyDesc(session.company_desc);
    setFormJd(session.job_description);
    setFormDuration(String(session.duration_minutes));
    setFormRoundType(session.round_type ?? "Technical Round");
    setFormApproach(session.approach);
    setFormDifficulty(session.difficulty);

    // Pre-cache opening greeting chunks in background (deduplicated, never double-queues)
    const instantGreeting = buildLocalGreeting(session);
    cachedGreetingRef.current = instantGreeting;
    void kokoroPlayer.prefetch(instantGreeting, "Nikhil");
  }, []);

  // Load session from URL ?session=<id>
  const urlSessionId = Number(searchParams.get("session"));
  useEffect(() => {
    if (!urlSessionId || !listData?.interviews) return;
    const found = listData.interviews.find((s) => s.id === urlSessionId);
    if (found && activeSession?.id !== found.id) {
      loadSessionIntoRoom(found);
    }
  }, [urlSessionId, listData, activeSession?.id, loadSessionIntoRoom]);

  // Recording elapsed timer while user holds/speaks mic answer
  useEffect(() => {
    if (!isRecordingAnswer) return;
    const id = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [isRecordingAnswer]);

  // Helper to reliably attach media streams to HTML5 video elements without playback interrupts
  const attachStreamToVideo = useCallback(
    (videoEl: HTMLVideoElement | null, mediaStream: MediaStream | null) => {
      if (!videoEl || !mediaStream) return;
      if (videoEl.srcObject !== mediaStream) {
        videoEl.srcObject = mediaStream;
      }
      videoEl.play().catch(() => {
        // Handled: Browser autoplay policy / play interrupt
      });
    },
    [],
  );

  // Synchronize stream across active video elements whenever stream or view states update
  useEffect(() => {
    if (stream) {
      attachStreamToVideo(videoRef.current, stream);
      attachStreamToVideo(greenRoomVideoRef.current, stream);
    }
  }, [stream, permissionsModalOpen, cvWindowMinimized, attachStreamToVideo]);

  // Cleanup audio, mic, camera, and recording ON COMPONENT UNMOUNT ONLY
  useEffect(() => {
    const recorder = micRecorderRef.current;
    return () => {
      kokoroPlayer.stop();
      streamAbortRef.current?.abort();
      recorder.cancel();
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore speech recognition cleanup error
      }
      if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
      if (micAudioCtxRef.current && micAudioCtxRef.current.state !== "closed") {
        void micAudioCtxRef.current.close();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      // Safely close media tracks only when unmounting the interview room
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Real-time audio meter for microphone activity (both in Green Room and live panel)
  useEffect(() => {
    if (!stream) {
      if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
      setMicVolumeMeter(0);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      setMicVolumeMeter(0);
      return;
    }

    let isCancelled = false;
    let ctx: AudioContext | null = null;
    let srcNode: MediaStreamAudioSourceNode | null = null;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AudioCtx();
      micAudioCtxRef.current = ctx;

      // Resume suspended AudioContext so audio meter operates immediately
      if (ctx.state === "suspended") {
        void ctx.resume();
      }

      srcNode = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.4;
      srcNode.connect(analyser);
      micAnalyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        if (isCancelled) return;
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          sum += data[i] ?? 0;
        }
        const avg = sum / data.length;
        const normalized = Math.min(100, Math.round((avg / 96) * 100));
        setMicVolumeMeter(normalized);
        micRafRef.current = requestAnimationFrame(loop);
      };
      micRafRef.current = requestAnimationFrame(loop);
    } catch {
      // Audio meter fallback
    }

    return () => {
      isCancelled = true;
      if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
      if (srcNode) {
        try {
          srcNode.disconnect();
        } catch {
          // Source disconnection fallback
        }
      }
      if (ctx && ctx.state !== "closed") {
        void ctx.close();
      }
    };
  }, [stream]);

  // Real-time Frame Sampling Loop for Vision Analysis (900ms)
  useEffect(() => {
    if (!stream) {
      setCvStats(null);
      return;
    }

    if (!captureCanvasRef.current) {
      const c = document.createElement("canvas");
      c.width = 320;
      c.height = 240;
      captureCanvasRef.current = c;
    }

    let cancelled = false;
    let busy = false;

    const interval = setInterval(async () => {
      if (cancelled || busy || !videoRef.current || videoRef.current.readyState < 2) return;
      const cap = captureCanvasRef.current;
      if (!cap) return;
      const ctx = cap.getContext("2d");
      if (!ctx) return;

      busy = true;
      try {
        ctx.drawImage(videoRef.current, 0, 0, cap.width, cap.height);
        const frameDataUrl = cap.toDataURL("image/jpeg", 0.72);
        const res = await api.analyzeCvFrame({
          image: frameDataUrl,
          ...(activeSession?.id && running ? { interviewId: activeSession.id } : {}),
        });
        if (!cancelled) {
          setCvStats(res);
          drawCvOverlay(res);
        }
      } catch {
        // Ignore transient frame drop
      } finally {
        busy = false;
      }
    }, 900);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [stream, activeSession?.id, running]);

  function drawCvOverlay(stats: CvAnalysis) {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!stats.face_detected || !stats.face_box) return;

    // Mirrored video means x -> 1 - x - w
    const mx = (1 - stats.face_box.x - stats.face_box.w) * canvas.width;
    const my = stats.face_box.y * canvas.height;
    const mw = stats.face_box.w * canvas.width;
    const mh = stats.face_box.h * canvas.height;

    ctx.strokeStyle = "#d2a957";
    ctx.lineWidth = 2;
    ctx.strokeRect(mx, my, mw, mh);

    ctx.strokeStyle = "#8df0a4";
    ctx.lineWidth = 1.5;
    for (const eye of stats.eyes) {
      const ex = (1 - eye.x - eye.w) * canvas.width;
      const ey = eye.y * canvas.height;
      ctx.strokeRect(ex, ey, eye.w * canvas.width, eye.h * canvas.height);
    }
  }

  // Request camera and microphone permissions with multiple device fallbacks
  async function requestAvPermissions(): Promise<MediaStream | null> {
    setCameraError(null);

    // If existing stream has live tracks, keep and enable
    if (stream && stream.getTracks().some((t) => t.readyState === "live")) {
      stream.getVideoTracks().forEach((t) => {
        t.enabled = true;
      });
      stream.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });
      setCameraEnabled(true);
      setMicEnabled(true);
      attachStreamToVideo(videoRef.current, stream);
      attachStreamToVideo(greenRoomVideoRef.current, stream);
      return stream;
    }

    let media: MediaStream | null = null;
    try {
      media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err1) {
      console.warn("Primary getUserMedia attempt failed, trying fallback constraints:", err1);
      try {
        media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err2) {
        console.warn("Dual getUserMedia failed, attempting single-device recovery:", err2);
        let videoStream: MediaStream | null = null;
        let audioStream: MediaStream | null = null;
        try {
          videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (eVideo) {
          console.warn("Video-only attempt failed:", eVideo);
        }
        try {
          audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (eAudio) {
          console.warn("Audio-only attempt failed:", eAudio);
        }

        if (videoStream && audioStream) {
          media = new MediaStream([
            ...videoStream.getVideoTracks(),
            ...audioStream.getAudioTracks(),
          ]);
        } else if (videoStream) {
          media = videoStream;
          notify("Microphone was not detected; video camera connected.", "error");
        } else if (audioStream) {
          media = audioStream;
          setCameraError("Camera device was not detected or access was denied.");
        } else {
          setCameraError(
            "Camera & microphone access was denied or unavailable. Please enable permissions in your browser address bar.",
          );
          return null;
        }
      }
    }

    if (media) {
      streamRef.current = media;
      setStream(media);
      const hasVideo = media.getVideoTracks().length > 0;
      const hasAudio = media.getAudioTracks().length > 0;
      setCameraEnabled(hasVideo);
      setMicEnabled(hasAudio);
      attachStreamToVideo(videoRef.current, media);
      attachStreamToVideo(greenRoomVideoRef.current, media);
      return media;
    }
    return null;
  }

  function toggleCamera() {
    if (!stream) {
      void requestAvPermissions();
      return;
    }
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      void requestAvPermissions();
      return;
    }
    const nextState = !cameraEnabled;
    videoTracks.forEach((t) => {
      t.enabled = nextState;
    });
    setCameraEnabled(nextState);
    if (nextState) {
      attachStreamToVideo(videoRef.current, stream);
      attachStreamToVideo(greenRoomVideoRef.current, stream);
    }
  }

  function startWebSpeechPreview() {
    if (webSpeechFailedRef.current) return;
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
        .webkitSpeechRecognition;
    if (!SpeechRec) return;

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore prior stop
        }
      }
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = navigator.language || "en-US";

      rec.onresult = (event) => {
        let finalChunk = "";
        let interimChunk = "";
        const startIndex = event.resultIndex ?? 0;
        for (let i = startIndex; i < event.results.length; i += 1) {
          const res = event.results[i];
          if (res?.isFinal) {
            finalChunk += (res[0]?.transcript ?? "") + " ";
          } else if (res) {
            interimChunk += res[0]?.transcript ?? "";
          }
        }
        if (finalChunk.trim()) {
          const prev = committedWebSpeechRef.current.trim();
          committedWebSpeechRef.current = prev ? `${prev} ${finalChunk.trim()}` : finalChunk.trim();
          setLiveTranscript(interimChunk.trim());
        } else {
          setLiveTranscript(interimChunk.trim());
        }
      };

      rec.onerror = (event?: { error?: string }) => {
        const err = event?.error;
        if (err === "network" || err === "service-not-allowed" || err === "audio-capture") {
          // Brave / privacy browsers block cloud WebSpeech; Whisper STT handles transcription locally!
          webSpeechFailedRef.current = true;
        }
      };

      rec.start();
      recognitionRef.current = rec;
    } catch {
      webSpeechFailedRef.current = true;
    }
  }

  async function startAnswerCapture() {
    if (isRecordingAnswer || isTranscribing || isStreamingAgent) return;

    // Stop any playing agent audio immediately so user can speak
    kokoroPlayer.stop();
    setIsSpeaking(false);
    speakingAmplitudeRef.current = 0;

    let activeStream = stream;
    if (!activeStream || activeStream.getAudioTracks().length === 0) {
      activeStream = await requestAvPermissions();
    }
    if (!activeStream || activeStream.getAudioTracks().length === 0) {
      notify("Microphone permission is required to record your spoken answer.", "error");
      return;
    }

    activeStream.getAudioTracks().forEach((t) => {
      t.enabled = true;
    });
    setMicEnabled(true);
    setMicActive(true);

    committedWebSpeechRef.current = "";
    setLiveTranscript("");
    setRecordingSeconds(0);

    try {
      await micRecorderRef.current.start(activeStream);
      setIsRecordingAnswer(true);
      startWebSpeechPreview();
    } catch (err) {
      setIsRecordingAnswer(false);
      notify(err instanceof Error ? err.message : "Could not start microphone recording.", "error");
    }
  }

  async function finishCaptureToTranscript(): Promise<string> {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop error
      }
      recognitionRef.current = null;
    }

    const browserLive = `${committedWebSpeechRef.current} ${liveTranscript}`.trim();
    committedWebSpeechRef.current = "";
    setLiveTranscript("");
    setIsRecordingAnswer(false);

    if (!micRecorderRef.current.isRecording()) {
      return browserLive;
    }

    setIsTranscribing(true);
    try {
      const { wavBlob, durationSec } = await micRecorderRef.current.stop();
      if (durationSec < 0.25 && browserLive.length < 3) {
        return "";
      }
      // Prefer instant WebSpeech if healthy and substantial, otherwise transcribe locally via cached Whisper (~0.5s)
      if (!webSpeechFailedRef.current && browserLive.split(/\s+/).length >= 3) {
        return browserLive;
      }
      const { text } = await api.transcribeAudio(wavBlob);
      return (text || browserLive).trim();
    } catch (err) {
      if (browserLive) return browserLive;
      notify(
        err instanceof Error ? err.message : "Could not convert speech to text cleanly.",
        "error",
      );
      return "";
    } finally {
      setIsTranscribing(false);
    }
  }

  function cancelAnswerCapture() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop error
      }
      recognitionRef.current = null;
    }
    micRecorderRef.current.cancel();
    committedWebSpeechRef.current = "";
    setLiveTranscript("");
    setIsRecordingAnswer(false);
    setRecordingSeconds(0);
  }

  function toggleMic() {
    if (isRecordingAnswer) {
      void handleMicSendNow();
      return;
    }
    if (running) {
      void startAnswerCapture();
      return;
    }

    // Outside live session: toggle hardware mute cleanly
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextMicState = !micEnabled;
        audioTracks.forEach((t) => {
          t.enabled = nextMicState;
        });
        setMicEnabled(nextMicState);
        setMicActive(nextMicState);
        notify(nextMicState ? "Microphone enabled." : "Microphone muted.");
        return;
      }
    }
    void requestAvPermissions();
  }

  const speakAgentLine = useCallback(
    async (
      text: string,
      speaker: PanelAgentName,
      onChunkStart?: (chunkText: string, chunkIndex: number) => void,
    ) => {
      if (!voiceEnabled) return;
      try {
        await kokoroPlayer.speak(text, speaker, {
          onAmplitude: (amp) => {
            speakingAmplitudeRef.current = amp;
          },
          onStart: () => setIsSpeaking(true),
          ...(onChunkStart ? { onChunkStart } : {}),
          onEnd: () => {
            setIsSpeaking(false);
            speakingAmplitudeRef.current = 0;
          },
        });
      } catch {
        setIsSpeaking(false);
        speakingAmplitudeRef.current = 0;
      }
    },
    [voiceEnabled],
  );

  // Countdown timer during live interview
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const saveTableSetupMutation = useMutation({
    mutationFn: (payload: { fd: FormData; updateId?: number }) =>
      payload.updateId
        ? api.updateInterview(payload.updateId, payload.fd)
        : api.createInterview(payload.fd),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      loadSessionIntoRoom(res.interview);
      setSearchParams({ session: String(res.interview.id) });
      setTableModalOpen(false);
      setFormResume(null);
      notify(`Desk folio updated for ${res.interview.role} at ${res.interview.company_name}.`);
    },
    onError: (err) => notify(err instanceof Error ? err.message : "Failed to save brief", "error"),
  });

  const startMutation = useMutation({
    mutationFn: (id: number) => api.startInterview(id),
    onSuccess: (res) => {
      setRunning(true);
      setActiveSpeaker(res.speaker);
    },
    onError: (err) =>
      notify(err instanceof Error ? err.message : "Failed to start interview", "error"),
  });

  async function stopAndCollectRecording(): Promise<{ blob: Blob; durationSec: number } | null> {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(resolve, 1500);
        const prevOnStop = recorder.onstop;
        recorder.onstop = (ev) => {
          window.clearTimeout(timeout);
          if (typeof prevOnStop === "function") prevOnStop.call(recorder, ev);
          resolve();
        };
        try {
          recorder.stop();
        } catch {
          window.clearTimeout(timeout);
          resolve();
        }
      });
    }
    mediaRecorderRef.current = null;
    if (recordedChunksRef.current.length === 0) return null;
    const blob = new Blob(recordedChunksRef.current, {
      type: recordingMimeRef.current || "video/webm",
    });
    recordedChunksRef.current = [];
    const durationSec = recordingStartMsRef.current
      ? Math.max(1, Math.round((Date.now() - recordingStartMsRef.current) / 1000))
      : 0;
    return blob.size > 0 ? { blob, durationSec } : null;
  }

  const completeMutation = useMutation({
    mutationFn: async (id: number) => {
      kokoroPlayer.stop();
      streamAbortRef.current?.abort();
      micRecorderRef.current.cancel();
      setRunning(false);
      setIsRecordingAnswer(false);

      const recorded = await stopAndCollectRecording();
      if (recorded) {
        try {
          await api.uploadRecording(id, recorded.blob, recorded.durationSec);
        } catch {
          // Recording upload fallback if storage is unavailable
        }
      }

      return api.completeInterview(id);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["interview"] });
      queryClient.invalidateQueries({ queryKey: ["interview-detail"] });
      queryClient.invalidateQueries({ queryKey: ["agent-report"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      notify("Interview complete! All 5 agent domain reports have been generated.");
      navigate(`/readiness?interviewId=${res.report.interview_id}`);
    },
    onError: (err) =>
      notify(err instanceof Error ? err.message : "Report generation failed", "error"),
  });

  // Auto-complete when countdown hits 00:00
  useEffect(() => {
    if (running && secondsLeft === 0 && activeSession && !completeMutation.isPending) {
      completeMutation.mutate(activeSession.id);
    }
  }, [running, secondsLeft, activeSession, completeMutation]);

  // Clicked Start Interview: Opens Google Meet Permissions Check first!
  function handleStartInterviewClick() {
    if (!activeSession) {
      setTableModalOpen(true);
      notify("Drop your resume and enter your interview details on the table first.");
      return;
    }
    setPermissionsModalOpen(true);
    if (!stream) {
      void requestAvPermissions();
    }
    if (cachedGreetingRef.current) {
      void kokoroPlayer.prefetch(cachedGreetingRef.current, "Nikhil");
    }
  }

  // Confirmed in Google Meet Dialog: Nikhil immediately briefs & speaks Q1 with zero lag!
  async function handleJoinConfirmed() {
    if (!activeSession) return;
    setPermissionsModalOpen(false);

    // Start video recording with MediaRecorder (optimized bitrate for fast serverless upload)
    if (stream) {
      recordedChunksRef.current = [];
      recordingStartMsRef.current = Date.now();
      try {
        const mimeTypes = [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
          "video/mp4;codecs=avc1,mp4a",
          "video/mp4",
        ];
        const selectedType =
          typeof MediaRecorder !== "undefined"
            ? mimeTypes.find((t) => MediaRecorder.isTypeSupported(t)) || ""
            : "";
        recordingMimeRef.current = selectedType || "video/webm";
        const recorder = selectedType
          ? new MediaRecorder(stream, {
              mimeType: selectedType,
              videoBitsPerSecond: 180_000,
              audioBitsPerSecond: 32_000,
            })
          : new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
      } catch (err) {
        console.warn("MediaRecorder start notice:", err);
      }
    }

    if (stream && videoRef.current) {
      attachStreamToVideo(videoRef.current, stream);
    }

    const secs = (activeSession.duration_minutes || 15) * 60;
    setTotalSeconds(secs);
    setSecondsLeft(secs);
    setRunning(true);
    setIsRecordingAnswer(false);
    setAnswerText("");
    setLiveTranscript("");

    const greetingText = cachedGreetingRef.current || buildLocalGreeting(activeSession);
    const phaseLabel = "JD & Role Fit (Nikhil · Q1/6)";

    setActiveSpeaker("Nikhil");
    startMutation.mutate(activeSession.id);

    if (!voiceEnabled) {
      setMessages([
        {
          speaker: "Nikhil",
          role: "assistant",
          phase: phaseLabel,
          content: greetingText,
        },
      ]);
      notify("Nikhil opened your interview panel. Click Mic when ready to answer!");
      return;
    }

    // Hold displaying the spoken question until Nikhil's neural voice begins speaking it aloud
    setMessages([
      {
        speaker: "Nikhil",
        role: "assistant",
        phase: phaseLabel,
        content: "Nikhil is joining the table…",
      },
    ]);

    let firstChunkStarted = false;
    void speakAgentLine(greetingText, "Nikhil", (chunkText, idx) => {
      if (!firstChunkStarted || idx === 0) {
        firstChunkStarted = true;
        setMessages([
          {
            speaker: "Nikhil",
            role: "assistant",
            phase: phaseLabel,
            content: chunkText || greetingText,
          },
        ]);
      } else {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: `${last.content} ${chunkText}`.trim(),
            };
          }
          return updated;
        });
      }
    }).then(() => {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant" && last.content === "Nikhil is joining the table…") {
          updated[updated.length - 1] = { ...last, content: greetingText };
        }
        return updated;
      });
    });

    notify("Nikhil opened your interview panel. Click Mic when ready to answer!");
  }

  async function submitCandidateAnswerStream(rawAnswer: string) {
    const trimmed = rawAnswer.trim();
    if (!trimmed || !activeSession) return;
    if (!running) {
      notify("Click Start interview to enter the panel session.");
      return;
    }
    if (isStreamingAgent) return;

    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;

    kokoroPlayer.stop();
    setMessages((prev) => [
      ...prev,
      { speaker: "You", role: "user", phase: "Candidate Response", content: trimmed },
    ]);
    setAnswerText("");
    setLiveTranscript("");
    setShowTextComposer(false);
    setIsStreamingAgent(true);

    const elapsedRatio = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0.25;
    let streamQueue: Awaited<ReturnType<typeof kokoroPlayer.createStreamSession>> | null = null;
    let addedAssistantBubble = false;
    let shouldCompleteAfterSpeech = false;
    let finalDoneReply: { speaker: PanelAgentName; phase: string; reply: string } | null = null;

    const revealChunk = (speaker: PanelAgentName, phase: string, text: string) => {
      setActiveSpeaker(speaker);
      if (!addedAssistantBubble) {
        addedAssistantBubble = true;
        setMessages((prev) => [...prev, { speaker, role: "assistant", phase, content: text }]);
      } else {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: `${last.content} ${text}`.trim(),
            };
          }
          return updated;
        });
      }
    };

    try {
      if (voiceEnabled) {
        streamQueue = await kokoroPlayer.createStreamSession({
          onAmplitude: (amp) => {
            speakingAmplitudeRef.current = amp;
          },
          onStart: () => setIsSpeaking(true),
          onEnd: () => {
            setIsSpeaking(false);
            speakingAmplitudeRef.current = 0;
          },
        });
      }

      await api.respondInterviewStream(
        activeSession.id,
        {
          message: trimmed,
          elapsedRatio,
          ...(targetAgentOverride ? { requestedAgent: targetAgentOverride } : {}),
          withVoice: voiceEnabled,
        },
        {
          onChunk: (ev) => {
            setActiveSpeaker(ev.speaker);
            setTargetAgentOverride(null);
            if (ev.wavBase64 && streamQueue && voiceEnabled) {
              // Synchronize displaying the question text strictly when audio begins playing it aloud
              streamQueue.enqueueBase64Wav(ev.wavBase64, () => {
                revealChunk(ev.speaker, ev.phase, ev.text);
              });
            } else {
              revealChunk(ev.speaker, ev.phase, ev.text);
            }
          },
          onDone: (ev) => {
            setActiveSpeaker(ev.speaker);
            shouldCompleteAfterSpeech = Boolean(ev.isInterviewComplete);
            finalDoneReply = { speaker: ev.speaker, phase: ev.phase, reply: ev.reply };
            if (!voiceEnabled || !streamQueue) {
              if (!addedAssistantBubble) {
                revealChunk(ev.speaker, ev.phase, ev.reply);
              } else {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === "assistant") {
                    updated[updated.length - 1] = { ...last, content: ev.reply };
                  }
                  return updated;
                });
              }
            }
          },
        },
        controller.signal,
      );

      setIsStreamingAgent(false);

      if (streamQueue) {
        await streamQueue.finish();
      }

      if (finalDoneReply) {
        const resolved = finalDoneReply as {
          speaker: PanelAgentName;
          phase: string;
          reply: string;
        };
        if (!addedAssistantBubble) {
          revealChunk(resolved.speaker, resolved.phase, resolved.reply);
        } else {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === "assistant") {
              updated[updated.length - 1] = { ...last, content: resolved.reply };
            }
            return updated;
          });
        }
      }

      if (shouldCompleteAfterSpeech && activeSession && !completeMutation.isPending) {
        notify("All 30 panel questions answered! Generating your 5 domain reports now…");
        completeMutation.mutate(activeSession.id);
      }
    } catch (err) {
      setIsStreamingAgent(false);
      streamQueue?.stop();
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        // Fallback to non-streaming turn endpoint if streaming failed cleanly
        try {
          const res = await api.respondInterview(activeSession.id, {
            message: trimmed,
            elapsedRatio,
            ...(targetAgentOverride ? { requestedAgent: targetAgentOverride } : {}),
          });
          setActiveSpeaker(res.speaker);
          setTargetAgentOverride(null);
          if (!voiceEnabled) {
            revealChunk(res.speaker, res.phase, res.reply);
          } else {
            let chunkShown = false;
            await speakAgentLine(res.reply, res.speaker, (chunkText) => {
              chunkShown = true;
              revealChunk(res.speaker, res.phase, chunkText);
            });
            if (!chunkShown) {
              revealChunk(res.speaker, res.phase, res.reply);
            }
          }
          if (res.isInterviewComplete && activeSession && !completeMutation.isPending) {
            completeMutation.mutate(activeSession.id);
          }
        } catch (fallbackErr) {
          notify(fallbackErr instanceof Error ? fallbackErr.message : "Panel turn failed", "error");
        }
      }
    }
  }

  async function handleMicSendNow() {
    if (isTranscribing || isStreamingAgent) return;
    const transcript = await finishCaptureToTranscript();
    if (!transcript.trim()) {
      notify("Could not detect clear voice — click Mic to speak again or use Keyboard fallback.");
      return;
    }
    await submitCandidateAnswerStream(transcript);
  }

  async function handleMicStopAndReview() {
    if (isTranscribing || isStreamingAgent) return;
    const transcript = await finishCaptureToTranscript();
    if (transcript.trim()) {
      setAnswerText(transcript);
      setShowTextComposer(true);
    } else {
      notify("Didn't hear any words — click Mic to try again or type below.");
      setShowTextComposer(true);
    }
  }

  function handleSendAnswer() {
    const fullAnswer = (answerText + " " + liveTranscript).trim();
    if (!fullAnswer) return;
    void submitCandidateAnswerStream(fullAnswer);
  }

  function handleAnswerKeyDown(e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendAnswer();
    }
  }

  function handleTableFormSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("candidate_name", formName.trim());
    fd.append("email", formEmail.trim());
    fd.append("company_name", formCompany.trim());
    fd.append("role", formRole.trim());
    fd.append("company_desc", formCompanyDesc.trim());
    fd.append("job_description", formJd.trim());
    fd.append("duration_minutes", formDuration);
    fd.append("difficulty", formDifficulty);
    fd.append("round_type", formRoundType);
    fd.append("approach", formApproach);
    fd.append("experience_level", "1–3 years");
    if (formResume) fd.append("resume", formResume);
    const canUpdateExisting = activeSession && activeSession.status === "Registered";
    saveTableSetupMutation.mutate(canUpdateExisting ? { fd, updateId: activeSession.id } : { fd });
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const activeMeta = INTERVIEW_PANEL.find((p) => p.name === activeSpeaker) ?? INTERVIEW_PANEL[0];

  const latestAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const userTurnCount = messages.filter((m) => m.role === "user").length;
  const currentProgress = computePanelProgress(userTurnCount);

  const WeatherIcon =
    environment.timeOfDay === "night"
      ? Moon
      : environment.weather === "rain" || environment.weather === "storm"
        ? CloudRain
        : environment.weather === "cloudy" || environment.weather === "fog"
          ? Cloud
          : environment.timeOfDay === "sunset" || environment.timeOfDay === "dawn"
            ? CloudSun
            : Sun;

  return (
    <div className="space-y-3">
      {/* Top Session Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#697466] m-0">
          First-person boardroom perspective facing your 5 AI panel agents. Click the walnut table
          anytime to inspect your folio.{" "}
          <span className="text-[#384a34] font-semibold">
            Drag anywhere to look around the boardroom.
          </span>
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          {activeSession ? (
            <span className="rt-tag">
              <FileCheck2 size={12} aria-hidden="true" />
              {activeSession.company_name} · {activeSession.role} (
              {activeSession.round_type ?? "Technical Round"})
            </span>
          ) : (
            <button
              type="button"
              className="rt-btn secondary small"
              onClick={() => setTableModalOpen(true)}
            >
              Drop resume on table
            </button>
          )}
        </div>
      </div>

      {/* FULL-SCREEN 3D VIRTUAL INTERVIEW ROOM (Far-view perspective) */}
      <div className="relative w-full rounded-[20px] sm:rounded-[24px] overflow-hidden border border-[#cdd7c2] bg-[#1a231d] shadow-2xl h-[74dvh] min-h-[440px] sm:h-[calc(100dvh-150px)] sm:min-h-[560px] 2xl:min-h-[680px]">
        <Canvas
          className="absolute inset-0"
          shadows
          dpr={[1, 1.5]}
          gl={{ antialias: true }}
          camera={{ position: [0, 2.34, 8.2], fov: 44, near: 0.1, far: 140 }}
          aria-label="Interactive first-person 3D interview boardroom with five Roblox panelists seated across a walnut conference table"
        >
          <InterviewRoom
            activeSpeaker={activeSpeaker}
            isSpeaking={isSpeaking}
            speakingAmplitudeRef={speakingAmplitudeRef}
            hasCandidateSetup={Boolean(activeSession)}
            environment={environment}
            onTableClick={() => setTableModalOpen(true)}
            onSelectAgent={(agent) => {
              setActiveSpeaker(agent);
              setTargetAgentOverride(agent);
              notify(`Focused on ${agent}. Your next answer will be addressed to ${agent}.`);
            }}
          />
        </Canvas>

        {/* TOP HUD: Speaker Info, Timer, and Real-Time Weather & Location */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 sm:p-4 flex-wrap">
          {/* Active Panelist Indicator */}
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-[#fffef8]/80 backdrop-blur-xl px-3 py-2 text-[11px] border border-white/90 shadow-[0_10px_25px_-5px_rgba(38,51,40,0.12),_inset_0_1px_1.5px_rgba(255,255,255,0.95)]">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{
                background: running ? "#b45349" : "#526e50",
                boxShadow: isSpeaking ? "0 0 8px #526e50" : "none",
              }}
            />
            <strong className="tracking-wide">{running ? "LIVE PANEL" : "READY"}</strong>
            <span className="text-[#697466]">·</span>
            <span className="font-medium text-[#263328]">
              {activeMeta.name} ({activeMeta.voiceLabel})
            </span>
            {isSpeaking && (
              <span className="rt-tag !py-0.5 !px-2 text-[10px] bg-[#e4ede1] text-[#345131]">
                Speaking
              </span>
            )}
          </div>

          {/* Center Timer OR 5-Agent Progression Bar */}
          {running ? (
            <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 rounded-2xl bg-[#fffef8]/90 backdrop-blur-xl px-2.5 py-1.5 border border-white/90 shadow-[0_12px_32px_-6px_rgba(38,51,40,0.18)] text-xs">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums text-[#263328] pr-1.5 border-r border-[#d2dcce]">
                <Circle size={7} fill="#b45349" color="transparent" />
                {mm}:{ss}
              </span>
              {AGENT_SEQUENCE.map((agentName, idx) => {
                const isCurrent = agentName === currentProgress.currentAgent;
                const isPassed = idx < currentProgress.agentIndex;
                return (
                  <div
                    key={agentName}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium transition-all ${
                      isCurrent
                        ? "bg-[#233a24] text-white shadow font-semibold ring-2 ring-[#70ab6b]/50"
                        : isPassed
                          ? "bg-[#e5ede0] text-[#344d32]"
                          : "bg-black/5 text-[#7c8d79] opacity-75"
                    }`}
                  >
                    <span>{agentName}</span>
                    <span className="text-[10px] opacity-85">
                      {isPassed ? "✓" : isCurrent ? `Q${currentProgress.questionInTurn}/6` : "6Q"}
                    </span>
                  </div>
                );
              })}
              <span className="text-[11px] font-bold text-[#203322] pl-1 border-l border-[#d2dcce]">
                {currentProgress.overallQuestion}/30
              </span>
            </div>
          ) : (
            <div className="pointer-events-auto hidden md:flex items-center gap-1.5 rounded-xl bg-[#fffef8]/80 backdrop-blur-xl px-3.5 py-2 text-xs font-semibold tabular-nums border border-white/90 shadow-[0_10px_25px_-5px_rgba(38,51,40,0.12),_inset_0_1px_1.5px_rgba(255,255,255,0.95)] text-[#263328]">
              <Circle size={8} fill="#526e50" color="transparent" />
              <span>
                {mm}:{ss}
              </span>
              <span className="text-[10px] text-[#697466] font-normal">Scheduled</span>
            </div>
          )}

          {/* Right: Dynamic System Weather & Location Badge */}
          <div className="pointer-events-auto relative">
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl bg-[#fffef8]/80 backdrop-blur-xl px-3 py-2 text-[11px] border border-white/90 shadow-[0_10px_25px_-5px_rgba(38,51,40,0.12),_inset_0_1px_1.5px_rgba(255,255,255,0.95)] hover:bg-white text-[#263328] transition-all"
              onClick={() => setShowPresetMenu((v) => !v)}
              title="Atmospheric scenery synchronized with user system time, location and weather"
              aria-label="Weather and time atmosphere settings"
            >
              <WeatherIcon size={14} className="text-[#c8a35f]" aria-hidden="true" />
              <span className="font-semibold">{environment.locationName}</span>
              <span className="text-[#697466]">·</span>
              <span className="tabular-nums font-medium">{environment.timeString}</span>
              <span className="text-[#697466]">·</span>
              <span className="capitalize">{environment.weather}</span>
              <span className="font-semibold text-[#526e50]">{environment.temperature}</span>
              <ChevronDown size={12} className="text-[#697466]" aria-hidden="true" />
            </button>

            {/* Atmosphere Presets Dropdown */}
            {showPresetMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-60 rounded-2xl bg-[#fffef8]/90 backdrop-blur-xl p-2 border border-white/90 shadow-[0_20px_50px_-10px_rgba(38,51,40,0.22),_inset_0_1px_1.5px_rgba(255,255,255,0.95)] z-30 text-xs space-y-1">
                <div className="text-[10px] font-bold text-[#697466] px-2 py-1 uppercase tracking-wider">
                  Sky & Atmosphere
                </div>
                {[
                  { id: "auto", label: "Auto (System Time & Local Weather)", icon: CloudSun },
                  { id: "day", label: "Crisp Midday Sunlight", icon: Sun },
                  { id: "sunset", label: "Warm Golden Sunset", icon: CloudSun },
                  { id: "night", label: "Moonlit Night Vista", icon: Moon },
                  { id: "rain", label: "Cozy Boardroom Rain", icon: CloudRain },
                ].map((item) => {
                  const ItemIcon = item.icon;
                  const active = preset === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors ${
                        active
                          ? "bg-[#edf2e7] font-semibold text-[#263328]"
                          : "hover:bg-[#f6f7ee] text-[#485645]"
                      }`}
                      onClick={() => {
                        setPreset(item.id as WeatherPresetMode);
                        setShowPresetMenu(false);
                        notify(`Scenery updated to ${item.label}.`);
                      }}
                    >
                      <ItemIcon size={14} className="text-[#c8a35f] shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* FLOATING SUBTITLE PROMPTER OVERLAY */}
        {latestAssistantMessage && (
          <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex justify-center px-4">
            <div className="pointer-events-auto max-w-2xl w-full rounded-2xl bg-[#1b261d]/85 backdrop-blur-xl border border-white/20 p-3 text-[#fbfaf0] shadow-[0_24px_60px_-10px_rgba(0,0,0,0.4),_inset_0_1px_1.5px_rgba(255,255,255,0.2)] flex items-start gap-3">
              <div
                className="grid h-8 w-8 place-items-center rounded-lg text-white text-xs font-bold shrink-0 mt-0.5"
                style={{
                  backgroundColor:
                    INTERVIEW_PANEL.find((p) => p.name === latestAssistantMessage.speaker)
                      ?.jacketColor ?? "#3b4f40",
                }}
              >
                {latestAssistantMessage.speaker.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-[#fedbb0]">
                      {latestAssistantMessage.speaker}
                    </span>
                    <span className="text-[10px] text-[#9eb299] opacity-80">
                      {latestAssistantMessage.phase}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Replay ${latestAssistantMessage.speaker} line`}
                    className="text-[#d2a957] hover:text-white p-0.5 bg-transparent border-0 inline-flex items-center gap-1 text-[10px]"
                    onClick={() =>
                      void speakAgentLine(
                        latestAssistantMessage.content,
                        (latestAssistantMessage.speaker as PanelAgentName) || "Nikhil",
                      )
                    }
                  >
                    <Volume2 size={12} />
                    <span>Replay</span>
                  </button>
                </div>
                <p className="text-xs leading-relaxed m-0 text-[#f5f4e6]">
                  {latestAssistantMessage.content}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* FLOATING VOICE INTERACTION POD & MIC-TO-TEXT ORB */}
        {running && (
          <div className="pointer-events-none absolute inset-x-0 bottom-20 z-20 flex flex-col items-center justify-center px-4 gap-2.5">
            {/* Active Recording Card: Speak cleanly & Send (works across Brave, Chrome, Safari) */}
            {isRecordingAnswer && (
              <div className="pointer-events-auto max-w-xl w-full rounded-2xl bg-[#18231a]/92 text-white backdrop-blur-xl border border-[#88e878]/35 p-3.5 shadow-[0_24px_60px_rgba(0,0,0,0.45),_inset_0_1px_1px_rgba(255,255,255,0.2)] animate-in fade-in slide-in-from-bottom-2 duration-150">
                <div className="flex items-center justify-between gap-2 mb-2 text-[11px]">
                  <span className="flex items-center gap-1.5 text-[#88e878] font-semibold">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#88e878] animate-ping" />
                    Mic Recording ({String(Math.floor(recordingSeconds / 60))}:
                    {String(recordingSeconds % 60).padStart(2, "0")})
                  </span>
                  <div className="flex items-center gap-2">
                    {/* Live Waveform Meter */}
                    <span className="inline-flex items-end gap-0.5 h-3">
                      {[0.4, 0.8, 1, 0.7, 0.5].map((scale, i) => (
                        <span
                          key={i}
                          className="w-1 bg-[#88e878] rounded-full transition-all duration-75"
                          style={{
                            height: `${Math.max(20, Math.min(100, micVolumeMeter * scale + 15))}%`,
                          }}
                        />
                      ))}
                    </span>
                    <button
                      type="button"
                      onClick={cancelAnswerCapture}
                      className="text-white/60 hover:text-white bg-transparent border-0 p-0.5"
                      title="Discard recording"
                      aria-label="Discard recording"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-[#f6f9f2] font-normal leading-relaxed m-0 italic">
                  {committedWebSpeechRef.current || liveTranscript
                    ? `"${`${committedWebSpeechRef.current} ${liveTranscript}`.trim()}"`
                    : `Speak your answer to ${activeSpeaker} naturally — speech will convert to text cleanly when you send.`}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    className="rt-btn secondary small !py-1 !px-2.5 text-[11px] !bg-white/10 !text-white !border-white/20 hover:!bg-white/20"
                    onClick={() => void handleMicStopAndReview()}
                    disabled={isTranscribing || isStreamingAgent}
                  >
                    Stop & Review Text
                  </button>
                  <button
                    type="button"
                    className="rt-btn small !py-1.5 !px-3.5 text-xs bg-[#4b8050] hover:bg-[#3f6f44] text-white"
                    onClick={() => void handleMicSendNow()}
                    disabled={isTranscribing || isStreamingAgent}
                  >
                    <Send size={12} />
                    <span>Send Answer to {activeSpeaker} →</span>
                  </button>
                </div>
              </div>
            )}

            {/* Central Mic / Voice Action Orb */}
            <div className="pointer-events-auto flex items-center gap-3 bg-[#fffef8]/92 backdrop-blur-xl px-4 py-2 rounded-full border border-white/95 shadow-[0_16px_40px_-8px_rgba(30,45,32,0.28),_inset_0_1px_2px_rgba(255,255,255,0.95)]">
              <button
                type="button"
                className={`relative group grid place-items-center w-12 h-12 rounded-full transition-all duration-200 shadow-md ${
                  isTranscribing || isStreamingAgent
                    ? "bg-[#314a33] text-white animate-pulse"
                    : isRecordingAnswer
                      ? "bg-[#225829] text-white hover:bg-[#19441f] ring-4 ring-[#88e878]/45"
                      : isSpeaking
                        ? "bg-[#d4993a] text-white hover:bg-[#bf872e]"
                        : "bg-[#29452b] text-white hover:bg-[#1e3420]"
                }`}
                disabled={isTranscribing || isStreamingAgent}
                onClick={() => {
                  if (isRecordingAnswer) {
                    void handleMicSendNow();
                  } else {
                    void startAnswerCapture();
                  }
                }}
                title={
                  isRecordingAnswer
                    ? `Click to convert speech & send answer to ${activeSpeaker}`
                    : `Click Mic to speak your answer to ${activeSpeaker}`
                }
                aria-label="Microphone answer control"
              >
                {isRecordingAnswer && (
                  <span
                    className="absolute inset-0 rounded-full border-2 border-[#88e878] animate-ping opacity-60 pointer-events-none"
                    style={{ animationDuration: "1.6s" }}
                  />
                )}
                {isRecordingAnswer ? (
                  <Send size={18} className="translate-x-0.5 text-[#88e878]" />
                ) : isSpeaking ? (
                  <Volume2 size={20} className="animate-pulse" />
                ) : (
                  <Mic size={20} className="text-[#a5f396]" />
                )}
              </button>

              <div className="text-left select-none pr-1">
                <div className="text-xs font-semibold text-[#1c2e1e] flex items-center gap-1.5">
                  {isTranscribing ? (
                    <>
                      <Mic size={12} className="text-[#43793f] animate-pulse" />
                      <span>Converting speech to text…</span>
                    </>
                  ) : isStreamingAgent ? (
                    <>
                      <Sparkles size={12} className="text-[#c88d2f] animate-spin" />
                      <span>{activeSpeaker} is analyzing & replying…</span>
                    </>
                  ) : isRecordingAnswer ? (
                    <>
                      <Mic size={12} className="text-[#2f7c2b]" />
                      <span>Listening… click Send when done</span>
                    </>
                  ) : isSpeaking ? (
                    <>
                      <Volume2 size={12} className="text-[#c88d2f]" />
                      <span>{activeSpeaker} speaking… click Mic to answer</span>
                    </>
                  ) : (
                    <>
                      <Mic size={12} className="text-[#526e50]" />
                      <span>Click Mic to answer {activeSpeaker}</span>
                    </>
                  )}
                </div>
                <div className="text-[10px] text-[#5e705c]">
                  {`Question ${currentProgress.questionInTurn} of 6 for ${currentProgress.currentAgent} · Overall ${currentProgress.overallQuestion}/30`}
                </div>
              </div>

              <button
                type="button"
                className={`p-1.5 rounded-lg border text-xs transition-colors ${
                  showTextComposer
                    ? "bg-[#29452b] text-white border-transparent"
                    : "bg-white/80 text-[#4c5f4a] border-[#d8e0ce] hover:bg-white"
                }`}
                onClick={() => setShowTextComposer((v) => !v)}
                title="Toggle keyboard input or edit transcribed text"
                aria-label="Toggle keyboard input fallback"
              >
                <Keyboard size={14} />
              </button>
            </div>

            {showTextComposer && (
              <div className="pointer-events-auto max-w-lg w-full rounded-2xl bg-[#fffef8]/95 backdrop-blur-xl border border-white/95 p-2 shadow-[0_16px_40px_rgba(28,42,30,0.18)] flex items-center gap-2 animate-in fade-in duration-150">
                <input
                  type="text"
                  className="rt-control !min-h-9 text-xs flex-1 !rounded-xl"
                  value={answerText}
                  autoFocus
                  onChange={(e) => setAnswerText(e.target.value)}
                  onKeyDown={handleAnswerKeyDown}
                  placeholder={`Review converted text or type answer to ${activeSpeaker}…`}
                />
                <button
                  type="button"
                  className="rt-btn small shrink-0"
                  disabled={!answerText.trim() || isStreamingAgent}
                  onClick={handleSendAnswer}
                >
                  <Send size={12} aria-hidden="true" />
                  <span>Send</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* BOTTOM ACTION DOCK */}
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex items-center justify-between px-4 flex-wrap gap-2">
          {/* Controls Dock */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#fffef8]/85 backdrop-blur-xl p-1.5 border border-white/90 shadow-[0_16px_40px_-8px_rgba(38,51,40,0.16),_inset_0_1px_1.5px_rgba(255,255,255,0.95)]">
            <button
              type="button"
              className={`rt-btn secondary small ${isRecordingAnswer || micActive ? "!bg-[#233827] !text-white !border-[#5f8464]" : ""}`}
              onClick={toggleMic}
              aria-pressed={isRecordingAnswer || micActive}
              title={
                isRecordingAnswer
                  ? "Recording spoken answer (click to convert & send)"
                  : running
                    ? "Click to start speaking your answer"
                    : micActive
                      ? "Microphone ready (click to mute)"
                      : "Microphone muted (click to unmute)"
              }
            >
              {isRecordingAnswer || micActive ? (
                <Mic size={13} className="text-[#84df77]" />
              ) : (
                <MicOff size={13} />
              )}
              <span>
                {isRecordingAnswer ? "Recording · Send" : micActive ? "Mic: Ready" : "Mic: Off"}
              </span>
              {(isRecordingAnswer || micActive) && (
                <span className="inline-flex items-center w-8 h-2 bg-black/40 rounded-full overflow-hidden ml-0.5 p-0.5">
                  <span
                    className="bg-[#6be05c] h-full transition-all duration-75 rounded-full"
                    style={{ width: `${Math.max(12, Math.min(100, micVolumeMeter))}%` }}
                  />
                </span>
              )}
            </button>
            <button
              type="button"
              className="rt-btn secondary small"
              onClick={() => {
                if (voiceEnabled) kokoroPlayer.stop();
                setVoiceEnabled((v) => !v);
              }}
              aria-pressed={voiceEnabled}
            >
              {voiceEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              {voiceEnabled ? "Voice: On" : "Muted"}
            </button>
            <button
              type="button"
              className="rt-btn secondary small"
              onClick={() => setTableModalOpen(true)}
            >
              <Settings2 size={13} />
              Table Folio
            </button>

            {running && (
              <button
                type="button"
                className="rt-btn secondary small"
                onClick={() => setShowTextComposer((v) => !v)}
              >
                <Keyboard size={13} />
                {showTextComposer ? "Hide keyboard" : "Keyboard fallback"}
              </button>
            )}

            {!running ? (
              <button
                type="button"
                className="rt-btn small"
                disabled={startMutation.isPending}
                onClick={handleStartInterviewClick}
              >
                <Play size={13} />
                {startMutation.isPending ? "Connecting..." : "Start interview"}
              </button>
            ) : (
              <button
                type="button"
                className="rt-btn danger small"
                disabled={completeMutation.isPending}
                onClick={() => activeSession && completeMutation.mutate(activeSession.id)}
              >
                <Square size={12} />
                {completeMutation.isPending ? "Generating report..." : "End & Report"}
              </button>
            )}
          </div>

          {/* Hint badge: Click-and-drag 360 look */}
          <div className="hidden lg:flex items-center gap-1 text-[11px] text-[#2c3d2e] bg-[#fffef8]/80 backdrop-blur-xl px-3 py-1.5 rounded-xl border border-white/80 shadow-[0_8px_20px_rgba(38,51,40,0.08),_inset_0_1px_1px_rgba(255,255,255,0.9)]">
            <span>🖱️ Click & drag anywhere to look 360°</span>
            <span className="text-[#697466]">•</span>
            <span className="text-[#526e50] font-medium">Far-view boardroom seat</span>
          </div>
        </div>

        {/* BOTTOM-RIGHT CANDIDATE VISION PIP */}
        <section
          className={`absolute right-3 sm:right-4 bottom-20 sm:bottom-4 z-20 rounded-2xl overflow-hidden border border-white/25 bg-[#1b251d]/90 text-[#f5f4e6] backdrop-blur-xl shadow-[0_24px_60px_-10px_rgba(0,0,0,0.45),_inset_0_1px_1.5px_rgba(255,255,255,0.2)] transition-all ${
            cvWindowMinimized ? "w-36 sm:w-44" : "w-40 sm:w-60 xl:w-72"
          }`}
          aria-label="Candidate live vision & behavioral analysis"
        >
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/15 text-[10px]">
            <span className="flex items-center gap-1.5 font-semibold">
              <Camera size={12} aria-hidden="true" />
              Candidate Vision
            </span>
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 text-[#d2a957]">
                <Circle size={6} fill="currentColor" aria-hidden="true" />
                {stream ? (cvStats?.expression ?? "Scanning…") : "Off"}
              </span>
              <button
                type="button"
                className="text-white/70 hover:text-white bg-transparent border-0 p-0 ml-1"
                aria-label={cvWindowMinimized ? "Expand camera" : "Minimize camera"}
                onClick={() => setCvWindowMinimized((v) => !v)}
              >
                {cvWindowMinimized ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>
          </div>

          {!cvWindowMinimized && (
            <>
              <div className="relative aspect-[4/3] bg-[#161e18] grid place-items-center overflow-hidden">
                {stream && cameraEnabled ? (
                  <>
                    <video
                      ref={(el) => {
                        videoRef.current = el;
                        if (el && stream && cameraEnabled) attachStreamToVideo(el, stream);
                      }}
                      autoPlay
                      muted
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                      aria-label="Live candidate camera preview"
                    />
                    <canvas
                      ref={overlayCanvasRef}
                      width={320}
                      height={240}
                      className="absolute inset-0 w-full h-full pointer-events-none"
                    />
                  </>
                ) : (
                  <div className="p-3 text-center space-y-1.5">
                    <VideoOff size={18} className="mx-auto text-[#d2a957]" aria-hidden="true" />
                    <p className="text-[10px] text-[#cfd6c8] m-0">
                      {stream
                        ? "Camera paused. Click Turn on below."
                        : "Camera off. Turn on for real-time composure & posture tracking."}
                    </p>
                  </div>
                )}
              </div>

              {stream && cameraEnabled && cvStats && (
                <div className="grid grid-cols-3 gap-1 px-2 py-1.5 text-[9px] bg-black/30 border-t border-white/10 text-center">
                  <div>
                    <div className="text-[#b8c3ab]">Eye Contact</div>
                    <div className="font-bold text-white">
                      {Math.round(cvStats.eye_contact_score)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[#b8c3ab]">Composure</div>
                    <div className="font-bold text-white">
                      {Math.round(cvStats.composure_score)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[#b8c3ab]">Engaged</div>
                    <div className="font-bold text-white">
                      {Math.round(cvStats.engagement_score)}%
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-t border-white/15">
                <span className="flex items-center gap-1 text-[9px] text-[#cfd6c8]">
                  <ShieldCheck size={11} aria-hidden="true" /> Local Vision stream
                </span>
                <button
                  type="button"
                  className="rt-btn small !min-h-6 !py-0.5 !px-2 text-[10px]"
                  onClick={toggleCamera}
                >
                  {stream && cameraEnabled ? (
                    <>
                      <VideoOff size={10} /> Off
                    </>
                  ) : (
                    <>
                      <Video size={10} /> Turn on
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {cameraError && (
            <p className="text-[10px] text-[#ffb4ab] px-2.5 pb-2 m-0" role="status">
              {cameraError}
            </p>
          )}
        </section>
      </div>

      {/* GOOGLE MEET STYLE PRE-INTERVIEW GREEN ROOM / PERMISSIONS MODAL */}
      <ModalDialog
        open={permissionsModalOpen}
        title="Ready to join the interview?"
        subtitle="Just like Google Meet, verify your camera and microphone setup before entering the live boardroom panel."
        onClose={() => setPermissionsModalOpen(false)}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* Left: Video Preview */}
            <div className="rounded-2xl overflow-hidden border border-[#d3d9c4] bg-[#1a231d] text-[#f5f4e6]">
              <div className="relative aspect-[4/3] bg-[#111813] grid place-items-center overflow-hidden">
                {stream && cameraEnabled ? (
                  <video
                    ref={(el) => {
                      greenRoomVideoRef.current = el;
                      if (el && stream && cameraEnabled) attachStreamToVideo(el, stream);
                    }}
                    autoPlay
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="text-center p-4 space-y-2">
                    <VideoOff size={28} className="mx-auto text-[#d2a957]" />
                    <p className="text-xs text-[#cbd5c4]">
                      {stream
                        ? "Camera is paused."
                        : "Camera is off or pending permission in browser."}
                    </p>
                  </div>
                )}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px]">
                  <Circle
                    size={6}
                    fill={stream && cameraEnabled ? "#526e50" : "#b45349"}
                    color="transparent"
                  />
                  <span>
                    {stream && cameraEnabled ? "Camera Connected" : "Camera Disconnected"}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-[#243026] flex items-center justify-between border-t border-white/10">
                <span className="text-[11px] text-[#cbd5c4]">Video Test</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rt-btn secondary small !py-1 text-xs"
                    onClick={toggleCamera}
                  >
                    {stream && cameraEnabled ? <VideoOff size={13} /> : <Video size={13} />}
                    {stream && cameraEnabled ? "Turn Off" : "Turn On"}
                  </button>
                  <button
                    type="button"
                    className="rt-btn secondary small !py-1 text-xs flex items-center gap-1"
                    onClick={() => void requestAvPermissions()}
                    title="Re-request camera & microphone permissions"
                  >
                    <RefreshCw size={11} />
                    <span>Re-request</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Audio Meter & Candidate Summary */}
            <div className="space-y-3">
              {/* Mic Level Waveform */}
              <div className="rounded-xl bg-[#f4f6ed] p-3.5 border border-[#dce3d2]">
                <div className="flex items-center justify-between text-xs font-semibold mb-2 text-[#263328]">
                  <span className="flex items-center gap-1.5">
                    <Mic
                      size={14}
                      className={
                        micVolumeMeter > 8 ? "text-[#43793f] animate-pulse" : "text-[#526e50]"
                      }
                    />
                    Microphone Audio Meter
                  </span>
                  <span className="text-[10px] text-[#697466]">
                    {micVolumeMeter > 10 ? "Voice detected" : "Speak to test"}
                  </span>
                </div>

                <div className="w-full bg-[#dbe4d3] h-3.5 rounded-full overflow-hidden p-0.5">
                  <div
                    className="bg-[#43793f] h-full transition-all duration-75 rounded-full"
                    style={{ width: `${Math.max(6, Math.min(100, micVolumeMeter))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[#697466] mt-1">
                  <span>Level: {micVolumeMeter}%</span>
                  <span>
                    {micVolumeMeter > 12 ? "Input level active ✓" : "Speak into microphone"}
                  </span>
                </div>
              </div>

              {/* Speaker Test */}
              <div className="rounded-xl bg-[#f4f6ed] p-3 border border-[#dce3d2] flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-[#263328]">Audio Playback Test</div>
                  <div className="text-[11px] text-[#697466]">
                    Hear a 1-second sample from Nikhil
                  </div>
                </div>
                <button
                  type="button"
                  className="rt-btn secondary small"
                  onClick={() => {
                    setGreenRoomTestedVoice(true);
                    void kokoroPlayer.speak("Audio check. The panel is ready for you.", "Nikhil");
                  }}
                >
                  <Volume2 size={13} />
                  Test Speaker
                </button>
              </div>

              {/* Candidate Details Confirmation */}
              {activeSession && (
                <div className="rounded-xl bg-[#edf2e6] p-3 text-xs space-y-1 text-[#263328]">
                  <div className="font-semibold text-sm">
                    {activeSession.role} at {activeSession.company_name}
                  </div>
                  <div className="text-[#697466]">
                    Candidate: {activeSession.candidate_name} ·{" "}
                    <strong>{activeSession.round_type ?? "Technical Round"}</strong>
                  </div>
                  <div className="text-[10px] text-[#526e50] font-medium flex items-center gap-1 pt-1">
                    <Sparkles size={11} /> All 5 agents prepared with streamed low-latency neural
                    voices
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#d3d9c4]">
            <button
              type="button"
              className="rt-btn secondary"
              onClick={() => setPermissionsModalOpen(false)}
            >
              Cancel
            </button>

            <button
              type="button"
              className="rt-btn"
              disabled={startMutation.isPending}
              onClick={handleJoinConfirmed}
            >
              <CheckCircle2 size={15} />
              Ready to Join Interview →
            </button>
          </div>
        </div>
      </ModalDialog>

      {/* Interactive Table Click Modal: Drop Resume & Candidate Details */}
      <ModalDialog
        open={tableModalOpen}
        title="Table Folio — Drop Resume & Brief"
        subtitle="Load a registered interview or fill in your candidate details & drop your resume directly onto the panel table."
        onClose={() => setTableModalOpen(false)}
      >
        <div className="space-y-4">
          {(listData?.interviews?.length ?? 0) > 0 && (
            <div className="rounded-xl bg-[#f4f6ed] p-3">
              <label htmlFor="table-load-existing" className="text-xs font-semibold block mb-1.5">
                Quick-load registered session from database
              </label>
              <select
                id="table-load-existing"
                className="rt-control !min-h-9 text-xs"
                value={activeSession ? String(activeSession.id) : ""}
                onChange={(e) => {
                  const found = listData?.interviews.find((i) => String(i.id) === e.target.value);
                  if (found) {
                    loadSessionIntoRoom(found);
                    setSearchParams({ session: String(found.id) });
                    setTableModalOpen(false);
                    notify(`Loaded ${found.company_name} — ${found.role} onto the table.`);
                  }
                }}
              >
                <option value="">Select existing session or fill new below…</option>
                {listData?.interviews.map((i) => (
                  <option key={i.id} value={String(i.id)}>
                    {i.company_name} · {i.role} ({i.approach}, {i.duration_minutes}m)
                  </option>
                ))}
              </select>
            </div>
          )}

          <form onSubmit={handleTableFormSubmit} className="space-y-3">
            <div
              className={`rt-upload ${draggingResume ? "dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDraggingResume(true);
              }}
              onDragLeave={() => setDraggingResume(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDraggingResume(false);
                const f = e.dataTransfer.files?.[0];
                if (f) setFormResume(f);
              }}
            >
              <UploadCloud size={20} className="mx-auto text-[#526e50] mb-1" aria-hidden="true" />
              <label
                htmlFor="table-resume-drop"
                className="cursor-pointer font-semibold text-xs text-[#526e50] block"
              >
                Drop your resume onto the table or click to browse
              </label>
              <input
                id="table-resume-drop"
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md"
                className="visually-hidden"
                onChange={(e) => setFormResume(e.target.files?.[0] ?? null)}
              />
              <p className="text-[11px] text-[#697466] m-0 mt-1">
                {formResume
                  ? `Ready: ${formResume.name}`
                  : activeSession?.resume_filename
                    ? `Current: ${activeSession.resume_filename}`
                    : "PDF, DOCX, or TXT · Parsed immediately for all 5 AI agents"}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rt-field mb-0">
                <label htmlFor="tbl-name">Full Name *</label>
                <input
                  id="tbl-name"
                  required
                  autoFocus
                  className="rt-control"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ashwin Telang"
                />
              </div>
              <div className="rt-field mb-0">
                <label htmlFor="tbl-email">Email *</label>
                <input
                  id="tbl-email"
                  type="email"
                  required
                  className="rt-control"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="rt-field mb-0">
                <label htmlFor="tbl-company">Company Name *</label>
                <input
                  id="tbl-company"
                  required
                  className="rt-control"
                  value={formCompany}
                  onChange={(e) => setFormCompany(e.target.value)}
                  placeholder="e.g. NVIDIA"
                />
              </div>
              <div className="rt-field mb-0">
                <label htmlFor="tbl-role">Role Applying For *</label>
                <input
                  id="tbl-role"
                  required
                  className="rt-control"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  placeholder="e.g. AI Engineer"
                />
              </div>
            </div>

            <div className="rt-field mb-0">
              <label htmlFor="tbl-about">About the Company</label>
              <textarea
                id="tbl-about"
                className="rt-control !min-h-[68px]"
                value={formCompanyDesc}
                onChange={(e) => setFormCompanyDesc(e.target.value)}
                placeholder="What does the company build or focus on?"
              />
            </div>

            <div className="rt-field mb-0">
              <label htmlFor="tbl-jd">Job Description (optional)</label>
              <textarea
                id="tbl-jd"
                className="rt-control !min-h-[68px]"
                value={formJd}
                onChange={(e) => setFormJd(e.target.value)}
                placeholder="Paste key role responsibilities…"
              />
            </div>

            <div className="rt-field mb-0">
              <label>Interview Round *</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {(["Technical Round", "HR Round"] as const).map((rt) => {
                  const selected = formRoundType === rt;
                  return (
                    <button
                      key={rt}
                      type="button"
                      onClick={() => {
                        setFormRoundType(rt);
                        setFormApproach(rt === "HR Round" ? "Behavioral Heavy" : "Technical Heavy");
                      }}
                      className={`rounded-xl px-3 py-2 text-left border text-xs transition-all ${
                        selected
                          ? "bg-[#233a24] text-white border-[#233a24]"
                          : "bg-[#f4f6ed] text-[#263328] border-[#d3d9c4] hover:bg-white"
                      }`}
                    >
                      <div className="font-semibold">{rt}</div>
                      <div
                        className={`text-[10px] ${selected ? "text-[#cfe2cc]" : "text-[#697466]"}`}
                      >
                        {rt === "Technical Round"
                          ? "Engineering depth & system design"
                          : "Career fit, culture & STAR behavioral"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="rt-field mb-0">
                <label htmlFor="tbl-duration">Duration</label>
                <select
                  id="tbl-duration"
                  className="rt-control"
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                >
                  <option value="10">10 min</option>
                  <option value="15">15 min</option>
                  <option value="20">20 min</option>
                </select>
              </div>
              <div className="rt-field mb-0">
                <label htmlFor="tbl-difficulty">Difficulty</label>
                <select
                  id="tbl-difficulty"
                  className="rt-control"
                  value={formDifficulty}
                  onChange={(e) => setFormDifficulty(e.target.value)}
                >
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </select>
              </div>
              <div className="rt-field mb-0">
                <label htmlFor="tbl-approach">Approach</label>
                <select
                  id="tbl-approach"
                  className="rt-control"
                  value={formApproach}
                  onChange={(e) => setFormApproach(e.target.value)}
                >
                  <option>Standard Panel</option>
                  <option>Technical Heavy</option>
                  <option>Behavioral Heavy</option>
                  <option>Stress Simulation</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="rt-btn secondary"
                onClick={() => setTableModalOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="rt-btn" disabled={saveTableSetupMutation.isPending}>
                {saveTableSetupMutation.isPending
                  ? "Saving folio..."
                  : "Save Brief & Ready Panel →"}
              </button>
            </div>
          </form>
        </div>
      </ModalDialog>
    </div>
  );
}
