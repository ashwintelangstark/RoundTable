import express from "express";
import fs from "node:fs";
import path from "node:path";
import { app } from "./app";
import { config } from "./config";
import { kokoroService } from "./services/kokoro";
import { openCvService } from "./services/opencv";
import { whisperService } from "./services/whisper";

// Warm up neural speech, local STT, and OpenCV vision workers in persistent Node mode
if (!config.isVercel) {
  openCvService.start();
  kokoroService.warmup();
  whisperService.warmup();
}

// Serve built Vite SPA in production
const distDir = path.resolve(process.cwd(), "dist");
if (process.env["NODE_ENV"] === "production" && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

const server = app.listen(config.port, () => {
  console.log(`[RoundTable API] Listening on http://localhost:${config.port}`);
});

process.on("SIGINT", () => {
  openCvService.shutdown();
  server.close();
  process.exit(0);
});
