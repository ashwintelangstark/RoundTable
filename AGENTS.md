# RoundTable Workspace Guidelines

## Application Architecture

- **Single Web Application**: React + Vite client (`src/`) served alongside a Node.js + Express + SQLite backend (`server/`).
- **3D Interview Panel Data**: Keep interview panelist definitions, Kokoro voice bindings, and Roblox character style specs in `src/game/interview/team.ts`, and keep Three.js / React Three Fiber scene rendering isolated in `src/game/interview/room.tsx`.
- **AI & Secrets Hygiene**: Keep `OPENROUTER_API_KEY` strictly in `.env` and server-side (`server/config.ts`, `server/services/openrouter.ts`). Never expose API keys in browser code or commit `.env`.
- **Voice & Vision**: Use Kokoro open-source neural TTS (`server/services/kokoro.ts`) exclusively (no mechanical browser speech synthesis fallback) and OpenCV (`server/services/cv_worker.py` + `server/services/opencv.ts`) for live facial expression and behavioral tracking.
