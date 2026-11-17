# RoundTable Architecture Documentation

## 1. Unified Request & Data Flow

1. **Client (`src/`)**: React 19 + Vite SPA using `react-router-dom` across `/` and the 7 core sections (`/registration`, `/room`, `/career`, `/resume`, `/technical`, `/behavioral`, `/readiness`).
2. **Backend (`server/index.ts`)**: Express server running on port `3001` (proxied from `/api/*` by Vite during development, and serving `dist/` directly in production).
3. **Database (`server/db.ts`)**: SQLite via built-in `node:sqlite` (`DatabaseSync`, WAL mode, foreign keys enabled).

## 2. SQLite Schema (`server/data/roundtable.sqlite`)

| Table                | Purpose                                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `interviews`         | Candidate details, company/JD context, parsed resume text, duration (10–20 min), difficulty, approach, status, score                     |
| `interview_messages` | Full turn-by-turn transcript tagged by panelist (`Nikhil`, `ananya`, `Daniel`, `sarah`, `Marcus`, `You`) and phase                       |
| `cv_telemetry`       | OpenCV camera samples during live interviews (`face_detected`, `expression`, `eye_contact_score`, `composure_score`, `engagement_score`) |
| `assessment_reports` | Final Marcus-led panel verdict, 5-axis scores, OpenCV presence summary, per-agent notes, and 3-priority roadmap                          |
| `career_analyses`    | Saved Nikhil JD & Company decoder outputs                                                                                                |
| `resume_analyses`    | Saved Ananya resume audit scores, gap analyses, and bullet rewrites                                                                      |
| `practice_sessions`  | Saved Daniel technical drills and Sarah STAR behavioral coaching sessions                                                                |

## 3. Kokoro Open-Source Neural Voice Pipeline (`server/services/kokoro.ts`)

- Powered by `kokoro-js` (`onnx-community/Kokoro-82M-v1.0-ONNX`, quantized `q8` on Node CPU).
- Synthesizes clean 24kHz PCM RIFF `.wav` audio buffers with LRU caching.
- Distinct non-mechanical voice mapping:
  - `Nikhil`: `am_puck`
  - `ananya`: `af_heart`
  - `Daniel`: `bm_daniel`
  - `sarah`: `af_sarah`
  - `Marcus`: `bm_george`
- On the client (`src/lib/api.ts`), Web Audio `AnalyserNode` computes real-time RMS amplitude and streams it into `src/game/interview/room.tsx` so the active 3D Roblox character's mouth, head, and gesture animate synchronously with speech.

## 4. OpenCV Behavioral Vision Pipeline (`server/services/opencv.ts`, `server/services/cv_worker.py`)

- Node spawns a persistent Python `cv2` worker communicating over stdin/stdout JSON lines.
- Each camera frame (`320x240` JPEG) is normalized via CLAHE, analyzed with frontal, alternate, and profile Haar face cascades, eye-with-eyeglasses cascades, smile cascades, and temporal `absdiff` face-patch motion tracking.
- Outputs normalized face & eye bounding boxes (rendered on the bottom-right `<canvas>` reticle), expression classification, eye-contact score, composure score, and engagement score.

## 5. REST API Endpoints

- `GET /api/health` — Database, Kokoro TTS, OpenCV, and OpenRouter readiness
- `GET /api/dashboard` — Overview KPIs and recent sessions
- `GET/POST/PUT/DELETE /api/interviews`, `POST /api/interviews/:id/repeat` — Registration CRUD + PDF/DOCX parsing
- `POST /api/interviews/:id/start`, `POST /api/interviews/:id/respond`, `POST /api/interviews/:id/complete` — Live 5-agent interview & final report generation
- `POST /api/cv/analyze` — Real-time OpenCV frame analysis + telemetry persistence
- `GET /api/tts/status`, `POST /api/tts/speak` — Kokoro WAV speech synthesis
- `POST /api/agents/career`, `POST /api/agents/resume`, `POST /api/agents/technical/*`, `POST /api/agents/behavioral/*`, `GET /api/reports` — Individual agent coaching endpoints
