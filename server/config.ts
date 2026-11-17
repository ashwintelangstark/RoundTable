import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const isVercel = Boolean(process.env["VERCEL"] || process.env["VERCEL_ENV"]);
const writableRoot = isVercel ? "/tmp/roundtable" : process.cwd();

export const config = {
  isVercel,
  port: Number(process.env["PORT"] ?? 3001),
  openrouterApiKey: process.env["OPENROUTER_API_KEY"] ?? "",
  openrouterModel: process.env["OPENROUTER_MODEL"] ?? "cohere/north-mini-code:free",
  openrouterFallbackModel:
    process.env["OPENROUTER_FALLBACK_MODEL"] ?? "nvidia/nemotron-3.5-lightning:free",
  databasePath: path.resolve(
    writableRoot,
    process.env["DATABASE_PATH"] ??
      (isVercel ? "data/roundtable.sqlite" : "./server/data/roundtable.sqlite"),
  ),
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
};
