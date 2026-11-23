import crypto from "node:crypto";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const isVercel = Boolean(process.env["VERCEL"] || process.env["VERCEL_ENV"]);
const writableRoot = isVercel ? "/tmp/roundtable" : process.cwd();

export function sanitizeOpenRouterApiKey(raw: string | undefined): string {
  if (!raw) return "";
  let cleaned = raw.trim();
  // Handle accidental copy-paste of "OPENROUTER_API_KEY=sk-or-..."
  cleaned = cleaned.replace(/^OPENROUTER_API_KEY\s*=\s*/i, "").trim();
  // Strip wrapping quotes ("...", '...', `...`)
  cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, "").trim();
  // Strip accidental "Bearer " prefix
  cleaned = cleaned.replace(/^Bearer\s+/i, "").trim();
  // Remove any remaining quotes or whitespace/newlines
  cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, "").replace(/[\r\n\t\s]+/g, "");
  // Extract an embedded OpenRouter key if extra characters remain around it
  const embedded = cleaned.match(/sk-or-v1-[A-Za-z0-9_-]+/);
  if (embedded?.[0]) {
    return embedded[0];
  }
  return cleaned;
}

export function getOpenRouterApiKey(): string {
  const candidates = [
    process.env["OPENROUTER_API_KEY"],
    process.env["OPENROUTER_KEY"],
    process.env["VITE_OPENROUTER_API_KEY"],
  ];
  for (const candidate of candidates) {
    const cleaned = sanitizeOpenRouterApiKey(candidate);
    if (cleaned) return cleaned;
  }
  return "";
}

const openrouterApiKey = getOpenRouterApiKey();
const authSecret =
  process.env["AUTH_SECRET"]?.trim() ||
  crypto
    .createHash("sha256")
    .update(`roundtable-auth:${openrouterApiKey || "local-dev-secret-v1"}`)
    .digest("hex");

const rawDbPath = path.resolve(
  writableRoot,
  process.env["DATABASE_PATH"] ??
    (isVercel ? "data/roundtable.sqlite" : "./server/data/roundtable.sqlite"),
);
const databasePath =
  isVercel && !rawDbPath.startsWith("/tmp/") ? "/tmp/roundtable/data/roundtable.sqlite" : rawDbPath;

const RETIRED_MODELS = new Set(["cohere/north-mini-code:free"]);

function normalizeModel(raw: string | undefined, fallback: string): string {
  const cleaned = (raw ?? "").trim().replace(/^["'`]+|["'`]+$/g, "");
  if (!cleaned || RETIRED_MODELS.has(cleaned)) return fallback;
  return cleaned;
}

export const config = {
  isVercel,
  port: Number(process.env["PORT"] ?? 3001),
  openrouterApiKey,
  openrouterModel: normalizeModel(
    process.env["OPENROUTER_MODEL"],
    "nvidia/nemotron-3.5-lightning:free",
  ),
  openrouterFallbackModel: normalizeModel(
    process.env["OPENROUTER_FALLBACK_MODEL"],
    "openrouter/free",
  ),
  appUrl:
    (process.env["APP_URL"] ?? "").trim() ||
    (process.env["VERCEL_URL"] ? `https://${process.env["VERCEL_URL"]}` : "http://localhost:5173"),
  databasePath,
  kokoroDtype: (process.env["KOKORO_DTYPE"] ?? "q8") as "fp32" | "fp16" | "q8" | "q4",
  uploadsDir: path.resolve(
    writableRoot,
    process.env["UPLOADS_DIR"] ?? (isVercel ? "uploads" : "./server/uploads"),
  ),
  recordingsDir: path.resolve(
    writableRoot,
    process.env["RECORDINGS_DIR"] ?? (isVercel ? "recordings" : "./server/storage/recordings"),
  ),
  blobReadWriteToken: process.env["BLOB_READ_WRITE_TOKEN"] ?? "",
  hfCacheDir: isVercel ? "/tmp/hf-cache" : undefined,
  authSecret,
};
