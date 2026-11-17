# RoundTable — Production Career Intelligence & 3D AI Interview Panel

**Status:** Production Grade (`Vercel Serverless + Express + React 19`)

RoundTable is a unified full-stack Career Intelligence and 3D Virtual Interview Panel web application powered by **React + Vite**, **Three.js / React Three Fiber**, **Node.js + Express**, **SQLite (`node:sqlite`)**, **Kokoro-82M open-source neural TTS**, **Whisper local speech-to-text**, **OpenCV** webcam facial & behavioral tracking, **Vercel Analytics / Speed Insights / Blob**, and **OpenRouter** agentic LLM orchestration.

## Core Panelists (5 Specialized AI Agents)

1. **Nikhil** — _JD & Company Decoder Agent_ (`/career`, Kokoro voice `am_puck`)
2. **ananya** — _Resume Gap & Strength Analyst Agent_ (`/resume`, Kokoro voice `af_heart`)
3. **Daniel** — _Technical System Design Interviewer Agent_ (`/technical`, Kokoro voice `bm_daniel`)
4. **sarah** — _Behavioral & Culture Fit Interviewer Agent_ (`/behavioral`, Kokoro voice `af_sarah`)
5. **Marcus** — _Hiring Bar Raiser Agent_ (`/readiness`, Kokoro voice `bm_george`)

## Application Sections (Overview + 7 Core Sections)

- **Overview (`/`)**: Studio metrics backed by SQLite, recent sessions, 5-agent panel roster, and practice pathways.
- **1. Interview Registration (`/registration`)**: Register interviews with PDF/DOCX/TXT resume upload, candidate details, company context, JD, duration (10–20 min), difficulty, and approach. Supports editing, deleting, and repeating past interviews with a different approach.
- **2. 3D Interview Room (`/room`)**: First-person Three.js boardroom facing five unique animated Roblox-style characters seated across a walnut conference table. Clicking the table opens the **Drop Resume & Candidate Brief** folio modal; bottom-right **OpenCV Vision** tracks live eye contact, facial expression, and composure; **Kokoro Neural TTS** speaks each agent's response in a unique non-mechanical voice with live lip-sync animation.
- **3. Career Intelligence (`/career` — Nikhil)**: Decodes job descriptions into competency matrices, company signals, and hidden expectations.
- **4. Resume Intelligence (`/resume` — ananya)**: Parses PDF/DOCX resumes and computes health scores, strengths, gaps, missing keywords, and bullet rewrites.
- **5. Technical Interview Lab (`/technical` — Daniel)**: Adaptive technical & system design drills with rubric evaluation and follow-up probes.
- **6. Behavioral Intelligence (`/behavioral` — sarah)**: STAR framework coaching, score breakdown, and executive story rewrites.
- **7. Hiring Readiness (`/readiness` — Marcus)**: Full panel assessment reports combining conversation evidence, OpenCV presence metrics, radar visualization, improvement roadmap, and Markdown export.

## Project File & Folder Reference

```text
RoundTable/
├── index.html                        # Vite entry document (RoundTable logo.png favicon & fonts)
├── package.json                      # Unified scripts & React/Vite/Node/Kokoro/Three dependencies
├── vite.config.ts                    # Vite config + /api proxy to Node.js backend (:3001)
├── tsconfig.json                     # Strict TypeScript config covering src/ and server/
├── eslint.config.js                  # ESLint config for browser (src/) and Node (server/)
├── .env / .env.example               # Runtime environment variables (OPENROUTER_API_KEY, PORT, etc.)
├── logo.png                          # Master RoundTable brand emblem
├── public/
│   ├── logo.png                      # Served RoundTable logo & favicon
│   └── robots.txt
├── docs/
│   └── ARCHITECTURE.md               # Detailed API, SQLite schema, 3D, Kokoro & OpenCV docs
├── server/
│   ├── index.ts                      # Express API server, static SPA hosting, SQLite & AI routes
│   ├── config.ts                     # dotenv configuration loader
│   ├── db.ts                         # SQLite schema initialization & showcase seed
│   └── services/
│       ├── agents.ts                 # Prompts, 5-agent panel orchestrator, report synthesizer
│       ├── openrouter.ts             # OpenRouter model cascade & JSON extractor
│       ├── kokoro.ts                 # Kokoro-82M ONNX neural TTS engine (5 distinct voices)
│       ├── opencv.ts                 # Node <-> Python OpenCV persistent worker bridge
│       ├── cv_worker.py              # OpenCV 4.x Haar-cascade & motion composure analyzer
│       └── resumeParser.ts           # PDF (pdf-parse), DOCX (mammoth), TXT resume parser
└── src/
    ├── main.tsx                      # React 19 entry point
    ├── App.tsx                       # QueryClient, ToastProvider, and unified BrowserRouter routes
    ├── styles.css                    # Warm ivory/sage studio design system & accessible UI styles
    ├── lib/
    │   ├── api.ts                    # Typed REST client & Web Audio Kokoro WAV player + RMS analyzer
    │   └── utils.ts                  # Shared utility helpers
    ├── components/
    │   ├── AppShell.tsx              # Fixed sidebar, responsive mobile drawer, live status topbar
    │   ├── ModalDialog.tsx           # Accessible native <dialog> modal with light-dismiss fallback
    │   ├── ToastContext.tsx          # Top-layer popover="manual" notifications & ARIA live region
    │   └── ui/                       # Reusable UI primitives
    ├── game/interview/
    │   ├── team.ts                   # 5 panel agents, designations, Kokoro voice IDs & 3D styles
    │   ├── team.test.ts              # Unit test verifying exact panelist names & designations
    │   └── room.tsx                  # First-person Three.js boardroom, clickable table, 5 Roblox avatars
    ├── pages/
    │   ├── OverviewPage.tsx
    │   ├── RegistrationPage.tsx
    │   ├── InterviewRoomPage.tsx
    │   ├── CareerPage.tsx
    │   ├── ResumePage.tsx
    │   ├── TechnicalPage.tsx
    │   ├── BehavioralPage.tsx
    │   └── ReadinessPage.tsx
    └── test/
        ├── setup.ts
        └── app-routing.test.tsx      # Route smoke tests across all RoundTable sections
```

## Quick Start

### Prerequisites

- **Node.js v22+** (tested on Node v26 with built-in `node:sqlite`)
- **Python 3** with `opencv-python` (`cv2`) and `numpy` installed
- Valid `OPENROUTER_API_KEY` in `.env`

### Run Development Mode (Frontend + Backend together)

```bash
npm install
npm run dev
```

- Frontend (Vite): `http://localhost:5173`
- Backend API (Node.js): `http://localhost:3001`

### Build & Run Production Mode (Single Server)

```bash
npm run build
npm start
```

### Verify Tests & Typecheck

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Deploying to Vercel

RoundTable includes full Vercel production scaffolding:
- `vercel.json` — SPA fallback rewrites, `/api/(.*)` & `/recordings/(.*)` routing to `api/index.ts`, Node 24.x (`maxDuration: 60`, `memory: 3008`), and automated native binary `excludeFiles` trimming.
- `api/index.ts` & `server/app.ts` — Serverless Express entry point with `/tmp` writable cache/SQLite fallback and `@vercel/blob` persistent clip uploads when `BLOB_READ_WRITE_TOKEN` is configured.
- `@vercel/analytics` and `@vercel/speed-insights` telemetry active in `src/App.tsx`.

Configure these environment variables in your Vercel Project Settings:
- `OPENROUTER_API_KEY` *(required)*
- `OPENROUTER_MODEL` *(optional, defaults to `cohere/north-mini-code:free`)*
- `OPENROUTER_FALLBACK_MODEL` *(optional, defaults to `nvidia/nemotron-3.5-lightning:free`)*
- `KOKORO_DTYPE` *(optional, defaults to `q8`)*
- `BLOB_READ_WRITE_TOKEN` *(optional, recommended for permanent multi-attempt video clip storage across serverless instances)*
