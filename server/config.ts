import crypto from "node:crypto";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const isVercel = Boolean(process.env["VERCEL"] || process.env["VERCEL_ENV"]);
const writableRoot = isVercel ? "/tmp/roundtable" : process.cwd();

const openrouterApiKey = process.env["OPENROUTER_API_KEY"] ?? "";
const authSecret =
  process.env["AUTH_SECRET"]?.trim() ||
  crypto
    .createHash("sha256")
    .update(`roundtable-auth:${openrouterApiKey || "local-dev-secret-v1"}`)
    .digest("hex");

const smtpUser = (process.env["SMTP_USER"] ?? "").trim();
const smtpHost =
  (process.env["SMTP_HOST"] ?? "").trim() ||
  (smtpUser.toLowerCase().endsWith("@gmail.com") ? "smtp.gmail.com" : "");

const rawDbPath = path.resolve(
  writableRoot,
  process.env["DATABASE_PATH"] ??
    (isVercel ? "data/roundtable.sqlite" : "./server/data/roundtable.sqlite"),
);
const databasePath =
  isVercel && !rawDbPath.startsWith("/tmp/") ? "/tmp/roundtable/data/roundtable.sqlite" : rawDbPath;

export const config = {
  isVercel,
  port: Number(process.env["PORT"] ?? 3001),
  openrouterApiKey,
  openrouterModel: process.env["OPENROUTER_MODEL"] ?? "nvidia/nemotron-3.5-lightning:free",
  openrouterFallbackModel:
    process.env["OPENROUTER_FALLBACK_MODEL"] ?? "cohere/north-mini-code:free",
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
  mail: {
    resendApiKey: (process.env["RESEND_API_KEY"] ?? "").trim(),
    smtpHost,
    smtpPort: Number(process.env["SMTP_PORT"] ?? 465),
    smtpUser,
    smtpPass: (process.env["SMTP_PASS"] ?? "").trim(),
    from:
      (process.env["SMTP_FROM"] ?? process.env["MAIL_FROM"] ?? "").trim() ||
      (smtpUser ? `RoundTable <${smtpUser}>` : "RoundTable <noreply@roundtable.ai>"),
  },
  appUrl:
    (process.env["APP_URL"] ?? "").trim() ||
    (process.env["VERCEL_URL"] ? `https://${process.env["VERCEL_URL"]}` : "http://localhost:5173"),
};
