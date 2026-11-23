import { del, put } from "@vercel/blob";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import dns from "node:dns";
import path from "node:path";
import multer from "multer";
import { config, getOpenRouterApiKey } from "./config.js";
import { db, listRecordingsForInterviewJob, markDemoSeedDismissed } from "./db.js";
import {
  analyzeResumeWithAnanya,
  buildOpeningGreeting,
  conductPanelTurn,
  conductPanelTurnStream,
  decodeCareerWithNikhil,
  evaluateBehavioralAnswerWithSarah,
  evaluateTechAnswerWithDaniel,
  generateBehavioralQuestionWithSarah,
  generateFinalAssessmentReport,
  generateTechQuestionWithDaniel,
  normalizeRoundType,
  type CvAggregate,
  type InterviewRecord,
  type MessageRecord,
} from "./services/agents.js";
import {
  ACCOUNT_VAULT_COOKIE_NAME,
  clearSessionCookie,
  createAuthToken,
  decryptAccountVault,
  extractTokenFromRequest,
  hashPassword,
  loginSchema,
  parseCookieHeader,
  sanitizeUser,
  setAccountVaultCookie,
  setSessionCookie,
  signupSchema,
  verifyAuthToken,
  verifyPassword,
  type UserDbRow,
} from "./services/auth.js";
import { kokoroService } from "./services/kokoro.js";
import { openCvService } from "./services/opencv.js";
import { extractResumeText } from "./services/resumeParser.js";
import { whisperService } from "./services/whisper.js";

dns.setDefaultResultOrder("ipv4first");

export const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const uploadRecording = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "16mb" }));

fs.mkdirSync(config.recordingsDir, { recursive: true });
app.use("/recordings", express.static(config.recordingsDir));
app.use("/api/recordings", express.static(config.recordingsDir));

app.get("/api/health", (_req, res) => {
  const apiKey = getOpenRouterApiKey() || config.openrouterApiKey;
  res.json({
    ok: true,
    database: "sqlite",
    vercel: config.isVercel,
    blobStorageConfigured: Boolean(config.blobReadWriteToken),
    kokoro: kokoroService.getStatus(),
    whisper: whisperService.getStatus(),
    opencv: openCvService.getStatus(),
    openrouterConfigured: Boolean(apiKey),
    openrouterKeyValidFormat: /^sk-or-/.test(apiKey),
    openrouterModel: config.openrouterModel,
    openrouterFallbackModel: config.openrouterFallbackModel,
  });
});

// ---------------------------------------------------------------------------
// Authentication (Sign Up + Username/Password Login)
// ---------------------------------------------------------------------------
app.post("/api/auth/signup", async (req, res) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Please check your sign-up details.";
      res.status(400).json({ error: firstError });
      return;
    }

    const { name, email, phone, password } = parsed.data;
    const existing = db
      .prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1")
      .get(email) as { id: number } | undefined;

    if (existing) {
      res
        .status(409)
        .json({ error: "An account with this Gmail already exists. Please log in instead." });
      return;
    }

    const passwordHash = hashPassword(password);
    const username = name;

    const inserted = db
      .prepare(
        `
        INSERT INTO users (name, username, email, phone, password_hash)
        VALUES (?, ?, ?, ?, ?)
      `,
      )
      .run(name, username, email, phone, passwordHash);

    const userRow = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(Number(inserted.lastInsertRowid)) as unknown as UserDbRow;

    // Keep an encrypted HttpOnly vault cookie so serverless cold starts preserve newly created accounts
    setAccountVaultCookie(res, {
      name: userRow.name,
      username: userRow.username,
      email: userRow.email,
      phone: userRow.phone,
      password_hash: userRow.password_hash,
      created_at: userRow.created_at,
    });

    res.status(201).json({
      ok: true,
      user: sanitizeUser(userRow),
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to create account.",
    });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Username and password are required.";
      res.status(400).json({ error: firstError });
      return;
    }

    const { username, password } = parsed.data;
    const candidates = db
      .prepare(
        `
        SELECT * FROM users
        WHERE LOWER(username) = LOWER(?)
           OR LOWER(name) = LOWER(?)
           OR LOWER(email) = LOWER(?)
        ORDER BY id DESC
      `,
      )
      .all(username, username, username) as unknown as UserDbRow[];

    let matched = candidates.find((row) => verifyPassword(password, row.password_hash));

    // Rehydrate from signed encrypted vault cookie if a serverless cold start reset /tmp SQLite
    if (!matched) {
      const cookies = parseCookieHeader(req.headers["cookie"]);
      const vaultUser = decryptAccountVault(cookies[ACCOUNT_VAULT_COOKIE_NAME]);
      if (vaultUser) {
        const needle = username.toLowerCase();
        const identifierMatches =
          vaultUser.username.toLowerCase() === needle ||
          vaultUser.name.toLowerCase() === needle ||
          vaultUser.email.toLowerCase() === needle;

        if (identifierMatches && verifyPassword(password, vaultUser.password_hash)) {
          const existingByEmail = db
            .prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1")
            .get(vaultUser.email) as unknown as UserDbRow | undefined;

          if (existingByEmail) {
            matched = existingByEmail;
          } else {
            const reinserted = db
              .prepare(
                `
                INSERT INTO users (name, username, email, phone, password_hash, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
              `,
              )
              .run(
                vaultUser.name,
                vaultUser.username,
                vaultUser.email,
                vaultUser.phone,
                vaultUser.password_hash,
                vaultUser.created_at,
              );
            matched = db
              .prepare("SELECT * FROM users WHERE id = ?")
              .get(Number(reinserted.lastInsertRowid)) as unknown as UserDbRow;
          }
        }
      }
    }

    if (!matched) {
      res.status(401).json({ error: "Invalid username or password." });
      return;
    }

    const safeUser = sanitizeUser(matched);
    const token = createAuthToken(safeUser);
    setSessionCookie(res, token);

    res.json({
      ok: true,
      token,
      user: safeUser,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to sign in.",
    });
  }
});

app.get("/api/auth/me", (req, res) => {
  const token = extractTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ authenticated: false, user: null });
    return;
  }
  const tokenUser = verifyAuthToken(token);
  if (!tokenUser) {
    clearSessionCookie(res);
    res.status(401).json({ authenticated: false, user: null });
    return;
  }

  // Prefer fresh DB row if present; fall back to verified stateless token claims across serverless cold starts
  const dbRow = db
    .prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1")
    .get(tokenUser.email) as unknown as UserDbRow | undefined;

  res.json({
    authenticated: true,
    user: dbRow ? sanitizeUser(dbRow) : tokenUser,
  });
});

app.post("/api/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Dashboard Overview Stats
// ---------------------------------------------------------------------------
app.get("/api/dashboard", (_req, res) => {
  const interviews = db
    .prepare("SELECT * FROM interviews ORDER BY id DESC")
    .all() as unknown as InterviewRecord[];
  const completed = interviews.filter((i) => i.status === "Completed");
  const avgScore = completed.length
    ? Math.round(completed.reduce((sum, i) => sum + (i.overall_score ?? 0), 0) / completed.length)
    : 0;
  const latestResume = db
    .prepare("SELECT overall_score FROM resume_analyses ORDER BY id DESC LIMIT 1")
    .get() as { overall_score: number } | undefined;
  const practiceCount = (
    db.prepare("SELECT COUNT(*) AS count FROM practice_sessions").get() as { count: number }
  ).count;

  res.json({
    stats: {
      completedCount: completed.length,
      totalCount: interviews.length,
      avgReadiness: avgScore,
      resumeStrength: latestResume?.overall_score ?? 0,
      practiceCount,
    },
    recentInterviews: interviews.slice(0, 6),
  });
});

// ---------------------------------------------------------------------------
// Interview Registration CRUD, Multi-Attempt Recordings & Resume Parsing
// ---------------------------------------------------------------------------
app.get("/api/interviews", (_req, res) => {
  const rows = db.prepare("SELECT * FROM interviews ORDER BY id DESC").all() as Array<{
    id: number;
    [key: string]: unknown;
  }>;
  const enriched = rows.map((row) => ({
    ...row,
    recordings_count: listRecordingsForInterviewJob(row.id).length,
  }));
  res.json({ interviews: enriched });
});

app.get("/api/interviews/:id", (req, res) => {
  const id = Number(req.params["id"]);
  const interview = db.prepare("SELECT * FROM interviews WHERE id = ?").get(id);
  if (!interview) {
    res.status(404).json({ error: "Interview not found" });
    return;
  }
  const messages = db
    .prepare("SELECT * FROM interview_messages WHERE interview_id = ? ORDER BY id ASC")
    .all(id);
  const report = db.prepare("SELECT * FROM assessment_reports WHERE interview_id = ?").get(id);
  const agentReports = db
    .prepare("SELECT * FROM agent_domain_reports WHERE interview_id = ? ORDER BY id ASC")
    .all(id);
  const recordings = listRecordingsForInterviewJob(id);
  const cvSummary = getCvAggregate(id);
  res.json({ interview, messages, report, agentReports, recordings, cvSummary });
});

app.post("/api/interviews/:id/recording", uploadRecording.single("recording"), async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const interview = db.prepare("SELECT * FROM interviews WHERE id = ?").get(id) as unknown as
      InterviewRecord | undefined;
    if (!interview) {
      res.status(404).json({ error: "Interview not found" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "Recording file is required" });
      return;
    }

    const body = (req.body ?? {}) as Record<string, string>;
    const durationSeconds = Math.max(0, Math.round(Number(body["duration_seconds"] ?? 0) || 0));
    const ext = req.file.mimetype.includes("mp4") ? "mp4" : "webm";
    const filename = `recording_${id}_${Date.now()}.${ext}`;

    let recordingUrl: string;
    if (config.blobReadWriteToken) {
      const blob = await put(`recordings/${filename}`, req.file.buffer, {
        access: "public",
        contentType: req.file.mimetype || "video/webm",
        token: config.blobReadWriteToken,
      });
      recordingUrl = blob.url;
    } else {
      fs.mkdirSync(config.recordingsDir, { recursive: true });
      fs.writeFileSync(path.join(config.recordingsDir, filename), req.file.buffer);
      recordingUrl = `/recordings/${filename}`;
    }

    const priorClips = listRecordingsForInterviewJob(id);
    const attemptNumber = priorClips.length + 1;
    const resolvedRound = normalizeRoundType(interview.round_type, interview.approach);

    const inserted = db
      .prepare(
        `
        INSERT INTO interview_recordings (
          interview_id, attempt_number, round_type, approach, recording_url, file_size, duration_seconds
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        id,
        attemptNumber,
        resolvedRound,
        interview.approach || resolvedRound,
        recordingUrl,
        req.file.size,
        durationSeconds,
      );

    db.prepare(
      "UPDATE interviews SET recording_url = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(recordingUrl, id);

    const savedClip = db
      .prepare("SELECT * FROM interview_recordings WHERE id = ?")
      .get(Number(inserted.lastInsertRowid));
    const recordings = listRecordingsForInterviewJob(id);

    res.json({ ok: true, recordingUrl, recording: savedClip, recordings });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Failed to save recording" });
  }
});

app.post("/api/interviews", upload.single("resume"), async (req, res) => {
  try {
    const body = req.body as Record<string, string>;
    let resumeText = body["resume_text"] ?? "";
    let resumeFilename = body["resume_filename"] ?? "";

    if (req.file) {
      resumeFilename = req.file.originalname;
      resumeText = await extractResumeText(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      );
    }

    const candidateName = (body["candidate_name"] ?? "").trim();
    const email = (body["email"] ?? "").trim();
    const companyName = (body["company_name"] ?? "").trim();
    const role = (body["role"] ?? "").trim();

    if (!candidateName || !email || !companyName || !role) {
      res
        .status(400)
        .json({ error: "Candidate name, email, company name, and role are required." });
      return;
    }

    const duration = Math.min(20, Math.max(10, Number(body["duration_minutes"] ?? 15) || 15));
    const roundType = normalizeRoundType(body["round_type"], body["approach"]);

    const result = db
      .prepare(
        `
        INSERT INTO interviews (
          candidate_name, email, company_name, role, company_desc, job_description,
          resume_filename, resume_text, duration_minutes, difficulty, round_type, approach,
          experience_level, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Registered')
      `,
      )
      .run(
        candidateName,
        email,
        companyName,
        role,
        body["company_desc"] ?? "",
        body["job_description"] ?? "",
        resumeFilename,
        resumeText,
        duration,
        body["difficulty"] ?? "Intermediate",
        roundType,
        body["approach"] ?? roundType,
        body["experience_level"] ?? "1–3 years",
      );

    const created = db
      .prepare("SELECT * FROM interviews WHERE id = ?")
      .get(Number(result.lastInsertRowid));
    res.status(201).json({ interview: created });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to register" });
  }
});

app.put("/api/interviews/:id", upload.single("resume"), async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const existing = db.prepare("SELECT * FROM interviews WHERE id = ?").get(id) as unknown as
      InterviewRecord | undefined;
    if (!existing) {
      res.status(404).json({ error: "Interview not found" });
      return;
    }

    const body = req.body as Record<string, string>;
    let resumeText = body["resume_text"] ?? existing.resume_text;
    let resumeFilename = body["resume_filename"] ?? existing.resume_filename;

    if (req.file) {
      resumeFilename = req.file.originalname;
      resumeText = await extractResumeText(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      );
    }

    const updatedRoundType = normalizeRoundType(
      body["round_type"] ?? existing.round_type,
      body["approach"] ?? existing.approach,
    );

    db.prepare(
      `
      UPDATE interviews SET
        candidate_name = ?,
        email = ?,
        company_name = ?,
        role = ?,
        company_desc = ?,
        job_description = ?,
        resume_filename = ?,
        resume_text = ?,
        duration_minutes = ?,
        difficulty = ?,
        round_type = ?,
        approach = ?,
        experience_level = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `,
    ).run(
      body["candidate_name"] ?? existing.candidate_name,
      body["email"] ?? existing.email,
      body["company_name"] ?? existing.company_name,
      body["role"] ?? existing.role,
      body["company_desc"] ?? existing.company_desc,
      body["job_description"] ?? existing.job_description,
      resumeFilename,
      resumeText,
      Math.min(20, Math.max(10, Number(body["duration_minutes"] ?? existing.duration_minutes))),
      body["difficulty"] ?? existing.difficulty,
      updatedRoundType,
      body["approach"] ?? existing.approach,
      body["experience_level"] ?? existing.experience_level,
      id,
    );

    const updated = db.prepare("SELECT * FROM interviews WHERE id = ?").get(id);
    res.json({ interview: updated });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to update" });
  }
});

app.post("/api/interviews/:id/repeat", (req, res) => {
  const id = Number(req.params["id"]);
  const existing = db.prepare("SELECT * FROM interviews WHERE id = ?").get(id) as unknown as
    (InterviewRecord & { parent_interview_id?: number | null }) | undefined;
  if (!existing) {
    res.status(404).json({ error: "Interview not found" });
    return;
  }
  const { round_type, approach, duration_minutes, difficulty } = req.body as {
    round_type?: string;
    approach?: string;
    duration_minutes?: number;
    difficulty?: string;
  };

  const resolvedRound = normalizeRoundType(round_type ?? existing.round_type, approach);
  const rootParentId = existing.parent_interview_id ?? existing.id;

  const result = db
    .prepare(
      `
      INSERT INTO interviews (
        parent_interview_id, candidate_name, email, company_name, role, company_desc,
        job_description, resume_filename, resume_text, duration_minutes, difficulty,
        round_type, approach, experience_level, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Registered')
    `,
    )
    .run(
      rootParentId,
      existing.candidate_name,
      existing.email,
      existing.company_name,
      existing.role,
      existing.company_desc,
      existing.job_description,
      existing.resume_filename,
      existing.resume_text,
      Math.min(20, Math.max(10, Number(duration_minutes ?? existing.duration_minutes))),
      difficulty ?? existing.difficulty,
      resolvedRound,
      approach ?? resolvedRound,
      existing.experience_level,
    );

  const created = db
    .prepare("SELECT * FROM interviews WHERE id = ?")
    .get(Number(result.lastInsertRowid));
  res.status(201).json({ interview: created });
});

app.delete("/api/interviews/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const existing = db.prepare("SELECT * FROM interviews WHERE id = ?").get(id) as unknown as
      (InterviewRecord & { recording_url?: string | null }) | undefined;
    if (!existing) {
      res.status(404).json({ error: "Interview not found" });
      return;
    }

    // Ensure hardcoded showcase seed never automatically restores after user deletes it
    markDemoSeedDismissed();

    // Collect every recording URL tied to this session
    const clipRows = db
      .prepare("SELECT recording_url FROM interview_recordings WHERE interview_id = ?")
      .all(id) as Array<{ recording_url: string }>;
    const urlsToDelete = Array.from(
      new Set(
        [existing.recording_url, ...clipRows.map((c) => c.recording_url)].filter((u): u is string =>
          Boolean(u && u.trim()),
        ),
      ),
    );

    let deletedFiles = 0;
    for (const rawUrl of urlsToDelete) {
      if (rawUrl.startsWith("https://") && config.blobReadWriteToken) {
        try {
          await del(rawUrl, { token: config.blobReadWriteToken });
          deletedFiles += 1;
        } catch {
          // Best-effort remote blob cleanup
        }
      } else {
        const cleanBase = path.basename(rawUrl.split("?")[0] ?? "");
        if (cleanBase) {
          const fullPath = path.join(config.recordingsDir, cleanBase);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            deletedFiles += 1;
          }
        }
      }
    }

    // Purge all related records atomically
    db.exec("BEGIN");
    try {
      db.prepare(
        "UPDATE interviews SET parent_interview_id = NULL WHERE parent_interview_id = ?",
      ).run(id);
      db.prepare("DELETE FROM career_analyses WHERE interview_id = ?").run(id);
      db.prepare("DELETE FROM resume_analyses WHERE interview_id = ?").run(id);
      db.prepare("DELETE FROM interview_recordings WHERE interview_id = ?").run(id);
      db.prepare("DELETE FROM interview_messages WHERE interview_id = ?").run(id);
      db.prepare("DELETE FROM cv_telemetry WHERE interview_id = ?").run(id);
      db.prepare("DELETE FROM assessment_reports WHERE interview_id = ?").run(id);
      db.prepare("DELETE FROM agent_domain_reports WHERE interview_id = ?").run(id);
      db.prepare("DELETE FROM interviews WHERE id = ?").run(id);
      db.exec("COMMIT");
    } catch (txErr) {
      db.exec("ROLLBACK");
      throw txErr;
    }

    res.json({ ok: true, deletedFiles });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Failed to delete interview" });
  }
});

// ---------------------------------------------------------------------------
// Live 5-Agent Interview Room Endpoints
// ---------------------------------------------------------------------------
function getCvAggregate(interviewId: number): CvAggregate {
  const row = db
    .prepare(
      `
      SELECT
        COUNT(*) AS sample_count,
        COALESCE(AVG(eye_contact_score), 75) AS avg_eye_contact,
        COALESCE(AVG(composure_score), 80) AS avg_composure,
        COALESCE(AVG(engagement_score), 78) AS avg_engagement
      FROM cv_telemetry
      WHERE interview_id = ? AND face_detected = 1
    `,
    )
    .get(interviewId) as {
    sample_count: number;
    avg_eye_contact: number;
    avg_composure: number;
    avg_engagement: number;
  };

  const dom = db
    .prepare(
      `
      SELECT expression, COUNT(*) AS cnt
      FROM cv_telemetry
      WHERE interview_id = ?
      GROUP BY expression
      ORDER BY cnt DESC
      LIMIT 1
    `,
    )
    .get(interviewId) as { expression: string } | undefined;

  return {
    sample_count: row?.sample_count ?? 0,
    avg_eye_contact: row?.avg_eye_contact ?? 78,
    avg_composure: row?.avg_composure ?? 82,
    avg_engagement: row?.avg_engagement ?? 79,
    dominant_expression: dom?.expression ?? "Composed & Attentive",
  };
}

app.get("/api/interviews/:id/greeting", (req, res) => {
  const id = Number(req.params["id"]);
  const interview = db.prepare("SELECT * FROM interviews WHERE id = ?").get(id) as unknown as
    InterviewRecord | undefined;
  if (!interview) {
    res.status(404).json({ error: "Interview not found" });
    return;
  }

  const openingReply = buildOpeningGreeting(interview);

  res.json({
    speaker: "Nikhil",
    role: "assistant",
    phase: "JD & Role Fit (Nikhil · Q1/6)",
    content: openingReply,
  });
});

app.post("/api/interviews/:id/start", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const interview = db.prepare("SELECT * FROM interviews WHERE id = ?").get(id) as unknown as
      InterviewRecord | undefined;
    if (!interview) {
      res.status(404).json({ error: "Interview not found" });
      return;
    }

    db.prepare(
      "UPDATE interviews SET status = 'In Progress', updated_at = datetime('now') WHERE id = ?",
    ).run(id);
    // Clear prior incomplete messages on fresh run while preserving prior video recording clips
    db.prepare("DELETE FROM interview_messages WHERE interview_id = ?").run(id);

    const openingReply = buildOpeningGreeting(interview);
    const phase = "JD & Role Fit (Nikhil · Q1/6)";

    db.prepare(
      "INSERT INTO interview_messages (interview_id, speaker, role, content, phase) VALUES (?, 'Nikhil', 'assistant', ?, ?)",
    ).run(id, openingReply, phase);

    res.json({
      speaker: "Nikhil",
      phase,
      reply: openingReply,
      questionNumber: 1,
      totalQuestions: 30,
      agentQuestionIndex: 1,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Failed to start interview" });
  }
});

app.post("/api/interviews/:id/respond", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const interview = db.prepare("SELECT * FROM interviews WHERE id = ?").get(id) as unknown as
      InterviewRecord | undefined;
    if (!interview) {
      res.status(404).json({ error: "Interview not found" });
      return;
    }

    const {
      message,
      elapsedRatio = 0.3,
      requestedAgent,
    } = req.body as {
      message?: string;
      elapsedRatio?: number;
      requestedAgent?: string;
    };

    if (!message || !message.trim()) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const history = db
      .prepare(
        "SELECT speaker, role, content, phase FROM interview_messages WHERE interview_id = ? ORDER BY id ASC",
      )
      .all(id) as unknown as MessageRecord[];

    db.prepare(
      "INSERT INTO interview_messages (interview_id, speaker, role, content, phase) VALUES (?, 'You', 'user', ?, ?)",
    ).run(id, message.trim(), "Candidate Response");

    const cvSummary = getCvAggregate(id);
    const turn = await conductPanelTurn({
      interview,
      history,
      userMessage: message.trim(),
      elapsedRatio: Math.max(0, Math.min(1, Number(elapsedRatio))),
      requestedAgent,
      cvSummary,
    });

    db.prepare(
      "INSERT INTO interview_messages (interview_id, speaker, role, content, phase) VALUES (?, ?, 'assistant', ?, ?)",
    ).run(id, turn.speaker, turn.reply, turn.phase);

    res.json({
      speaker: turn.speaker,
      phase: turn.phase,
      reply: turn.reply,
      model: turn.model,
      questionNumber: turn.overallQuestion,
      totalQuestions: turn.totalQuestions,
      agentQuestionIndex: turn.questionInTurn,
      isFinalInterviewQuestion: turn.isFinalInterviewQuestion,
      isInterviewComplete: turn.isInterviewComplete,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Panel response failed" });
  }
});

app.post("/api/interviews/:id/respond-stream", async (req, res) => {
  const id = Number(req.params["id"]);
  const interview = db.prepare("SELECT * FROM interviews WHERE id = ?").get(id) as unknown as
    InterviewRecord | undefined;
  if (!interview) {
    res.status(404).json({ error: "Interview not found" });
    return;
  }

  const {
    message,
    elapsedRatio = 0.3,
    requestedAgent,
    withVoice = true,
  } = req.body as {
    message?: string;
    elapsedRatio?: number;
    requestedAgent?: string;
    withVoice?: boolean;
  };

  if (!message || !message.trim()) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");

  let clientClosed = false;
  res.on("close", () => {
    clientClosed = true;
  });

  const writeEvent = (obj: Record<string, unknown>) => {
    if (!clientClosed && !res.writableEnded) {
      res.write(JSON.stringify(obj) + "\n");
    }
  };

  try {
    const history = db
      .prepare(
        "SELECT speaker, role, content, phase FROM interview_messages WHERE interview_id = ? ORDER BY id ASC",
      )
      .all(id) as unknown as MessageRecord[];

    db.prepare(
      "INSERT INTO interview_messages (interview_id, speaker, role, content, phase) VALUES (?, 'You', 'user', ?, ?)",
    ).run(id, message.trim(), "Candidate Response");

    const cvSummary = getCvAggregate(id);
    let chunkIndex = 0;
    let sendChain = Promise.resolve();

    const turn = await conductPanelTurnStream(
      {
        interview,
        history,
        userMessage: message.trim(),
        elapsedRatio: Math.max(0, Math.min(1, Number(elapsedRatio))),
        requestedAgent,
        cvSummary,
      },
      (sentence, progress) => {
        const myIndex = chunkIndex;
        chunkIndex += 1;

        const synthPromise = withVoice
          ? kokoroService.synthesize(sentence, progress.agent).catch(() => null)
          : Promise.resolve(null);

        sendChain = sendChain.then(async () => {
          if (clientClosed) return;
          const synthesized = await synthPromise;
          writeEvent({
            type: "turn_chunk",
            index: myIndex,
            speaker: progress.agent,
            phase: progress.phase,
            text: sentence,
            questionNumber: progress.overallQuestion,
            totalQuestions: progress.totalQuestions,
            agentQuestionIndex: progress.questionInTurn,
            isFinalInterviewQuestion: progress.isFinalInterviewQuestion,
            isInterviewComplete: progress.isInterviewComplete,
            wavBase64: synthesized ? synthesized.wav.toString("base64") : null,
          });
        });
      },
    );

    await sendChain;

    db.prepare(
      "INSERT INTO interview_messages (interview_id, speaker, role, content, phase) VALUES (?, ?, 'assistant', ?, ?)",
    ).run(id, turn.speaker, turn.reply, turn.phase);

    writeEvent({
      type: "turn_done",
      speaker: turn.speaker,
      phase: turn.phase,
      reply: turn.reply,
      questionNumber: turn.overallQuestion,
      totalQuestions: turn.totalQuestions,
      agentQuestionIndex: turn.questionInTurn,
      isFinalInterviewQuestion: turn.isFinalInterviewQuestion,
      isInterviewComplete: turn.isInterviewComplete,
    });
    res.end();
  } catch (err) {
    writeEvent({
      type: "error",
      error: err instanceof Error ? err.message : "Panel stream failed",
    });
    res.end();
  }
});

app.post("/api/interviews/:id/complete", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const interview = db.prepare("SELECT * FROM interviews WHERE id = ?").get(id) as unknown as
      InterviewRecord | undefined;
    if (!interview) {
      res.status(404).json({ error: "Interview not found" });
      return;
    }

    const messages = db
      .prepare(
        "SELECT speaker, role, content, phase FROM interview_messages WHERE interview_id = ? ORDER BY id ASC",
      )
      .all(id) as unknown as MessageRecord[];
    const cvSummary = getCvAggregate(id);

    const report = await generateFinalAssessmentReport({
      interview,
      messages,
      cvSummary,
    });

    const cvJson = {
      avg_eye_contact: Math.round(cvSummary.avg_eye_contact),
      avg_composure: Math.round(cvSummary.avg_composure),
      avg_engagement: Math.round(cvSummary.avg_engagement),
      dominant_expression: cvSummary.dominant_expression,
      sample_count: cvSummary.sample_count,
      coaching_note: report.cv_coaching_note,
    };

    db.prepare(
      `
      INSERT INTO assessment_reports (
        interview_id, overall_score, verdict, summary,
        breakdown_json, cv_summary_json, panel_notes_json, roadmap_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(interview_id) DO UPDATE SET
        overall_score = excluded.overall_score,
        verdict = excluded.verdict,
        summary = excluded.summary,
        breakdown_json = excluded.breakdown_json,
        cv_summary_json = excluded.cv_summary_json,
        panel_notes_json = excluded.panel_notes_json,
        roadmap_json = excluded.roadmap_json,
        created_at = datetime('now')
    `,
    ).run(
      id,
      report.overall_score,
      report.verdict,
      report.summary,
      JSON.stringify(report.breakdown),
      JSON.stringify(cvJson),
      JSON.stringify(report.panel_notes),
      JSON.stringify(report.roadmap),
    );

    const upsertAgentReport = db.prepare(`
      INSERT INTO agent_domain_reports (
        interview_id, agent, domain_title, score, verdict, summary,
        strengths_json, improvements_json, question_reviews_json, metrics_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(interview_id, agent) DO UPDATE SET
        domain_title = excluded.domain_title,
        score = excluded.score,
        verdict = excluded.verdict,
        summary = excluded.summary,
        strengths_json = excluded.strengths_json,
        improvements_json = excluded.improvements_json,
        question_reviews_json = excluded.question_reviews_json,
        metrics_json = excluded.metrics_json,
        created_at = datetime('now')
    `);

    for (const agentRep of report.agent_reports) {
      upsertAgentReport.run(
        id,
        agentRep.agent,
        agentRep.domain_title,
        agentRep.score,
        agentRep.verdict,
        agentRep.summary,
        JSON.stringify(agentRep.strengths),
        JSON.stringify(agentRep.improvements),
        JSON.stringify(agentRep.question_reviews),
        JSON.stringify(agentRep.metrics),
      );
    }

    db.prepare(
      "UPDATE interviews SET status = 'Completed', overall_score = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(report.overall_score, id);

    const saved = db.prepare("SELECT * FROM assessment_reports WHERE interview_id = ?").get(id);
    const savedAgentReports = db
      .prepare("SELECT * FROM agent_domain_reports WHERE interview_id = ? ORDER BY id ASC")
      .all(id);
    const recordings = listRecordingsForInterviewJob(id);
    res.json({ report: saved, agentReports: savedAgentReports, recordings });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Failed to generate report" });
  }
});

// ---------------------------------------------------------------------------
// Local Whisper Speech-to-Text
// ---------------------------------------------------------------------------
app.post(
  "/api/stt/transcribe",
  express.raw({ type: ["audio/*", "application/octet-stream"], limit: "15mb" }),
  async (req, res) => {
    try {
      let wavBuffer: Buffer;
      if (Buffer.isBuffer(req.body)) {
        wavBuffer = req.body;
      } else {
        const body = req.body as { wavBase64?: string };
        if (!body?.wavBase64) {
          res.status(400).json({ error: "WAV audio payload is required" });
          return;
        }
        wavBuffer = Buffer.from(body.wavBase64, "base64");
      }

      const result = await whisperService.transcribeWav(wavBuffer);
      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Speech-to-text transcription failed",
      });
    }
  },
);

// ---------------------------------------------------------------------------
// OpenCV Facial Expression & Behavior Analysis
// ---------------------------------------------------------------------------
app.post("/api/cv/analyze", async (req, res) => {
  try {
    const { image, interviewId } = req.body as { image?: string; interviewId?: number };
    if (!image) {
      res.status(400).json({ error: "Base64 frame image is required" });
      return;
    }

    const result = await openCvService.analyzeFrame(image);

    if (interviewId && Number.isFinite(Number(interviewId))) {
      const ivExists = db
        .prepare("SELECT id FROM interviews WHERE id = ?")
        .get(Number(interviewId));
      if (ivExists) {
        db.prepare(
          `
          INSERT INTO cv_telemetry (
            interview_id, face_detected, expression, eye_contact_score,
            smile_score, composure_score, engagement_score, head_offset_x, head_offset_y
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(
          Number(interviewId),
          result.face_detected ? 1 : 0,
          result.expression,
          result.eye_contact_score,
          result.smile_score,
          result.composure_score,
          result.engagement_score,
          result.head_offset_x,
          result.head_offset_y,
        );
      }
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "OpenCV analysis failed" });
  }
});

// ---------------------------------------------------------------------------
// Kokoro Open-Source Neural TTS (5 distinct voices, strictly non-mechanical)
// ---------------------------------------------------------------------------
app.get("/api/tts/status", (_req, res) => {
  res.json(kokoroService.getStatus());
});

app.post("/api/tts/stream", async (req, res) => {
  const { text, agent } = req.body as { text?: string; agent?: string };
  if (!text || !text.trim()) {
    res.status(400).json({ error: "Text is required" });
    return;
  }

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");

  const abortController = new AbortController();
  res.on("close", () => abortController.abort());

  try {
    await kokoroService.streamSentences(
      text,
      agent ?? "Nikhil",
      (chunk) => {
        if (!abortController.signal.aborted && !res.writableEnded) {
          res.write(
            JSON.stringify({
              index: chunk.index,
              total: chunk.total,
              text: chunk.text,
              wavBase64: chunk.wav.toString("base64"),
            }) + "\n",
          );
        }
      },
      abortController.signal,
    );
    res.end();
  } catch (err) {
    if (!res.writableEnded) {
      res.write(
        JSON.stringify({
          error: err instanceof Error ? err.message : "Streaming voice synthesis failed",
        }) + "\n",
      );
      res.end();
    }
  }
});

app.post("/api/tts/speak", async (req, res) => {
  try {
    const { text, agent } = req.body as { text?: string; agent?: string };
    if (!text || !text.trim()) {
      res.status(400).json({ error: "Text is required" });
      return;
    }
    const { wav, voice } = await kokoroService.synthesize(text, agent ?? "Nikhil");
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("X-Kokoro-Voice", voice.voiceId);
    res.setHeader("X-Kokoro-Agent", voice.agent);
    res.send(wav);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Kokoro voice synthesis failed",
    });
  }
});

// ---------------------------------------------------------------------------
// Individual Agent Development Sections (5 Dedicated Agent Labs)
// ---------------------------------------------------------------------------
app.post("/api/agents/career", async (req, res) => {
  try {
    const { companyName, role, companyDesc, jobDescription, interviewId } = req.body as {
      companyName?: string;
      role?: string;
      companyDesc?: string;
      jobDescription?: string;
      interviewId?: number;
    };
    const result = await decodeCareerWithNikhil({
      companyName: companyName ?? "",
      role: role ?? "",
      companyDesc: companyDesc ?? "",
      jobDescription: jobDescription ?? "",
    });
    db.prepare(
      "INSERT INTO career_analyses (interview_id, company_name, role, job_description, analysis_json) VALUES (?, ?, ?, ?, ?)",
    ).run(
      interviewId ?? null,
      companyName ?? "Target Company",
      role ?? "Target Role",
      jobDescription ?? "",
      JSON.stringify(result.analysis),
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Career analysis failed" });
  }
});

app.get("/api/agents/career/history", (_req, res) => {
  const rows = db.prepare("SELECT * FROM career_analyses ORDER BY id DESC LIMIT 10").all();
  res.json({ history: rows });
});

app.post("/api/agents/resume", upload.single("resume"), async (req, res) => {
  try {
    const body = req.body as Record<string, string>;
    let resumeText = body["resumeText"] ?? "";
    let filename = body["filename"] ?? "Uploaded Resume";

    if (req.file) {
      filename = req.file.originalname;
      resumeText = await extractResumeText(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      );
    }

    if (!resumeText.trim()) {
      res.status(400).json({ error: "Please upload a PDF/DOCX/TXT resume or paste resume text." });
      return;
    }

    const result = await analyzeResumeWithAnanya({
      resumeText,
      targetJd: body["targetJd"] ?? "",
      role: body["role"],
      company: body["company"],
    });

    db.prepare(
      "INSERT INTO resume_analyses (interview_id, filename, resume_text, target_jd, overall_score, analysis_json) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      body["interviewId"] ? Number(body["interviewId"]) : null,
      filename,
      resumeText,
      body["targetJd"] ?? "",
      result.overall_score,
      JSON.stringify(result.analysis),
    );

    res.json({ ...result, filename, extractedPreview: resumeText.slice(0, 600) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Resume analysis failed" });
  }
});

app.get("/api/agents/resume/history", (_req, res) => {
  const rows = db.prepare("SELECT * FROM resume_analyses ORDER BY id DESC LIMIT 10").all();
  res.json({ history: rows });
});

app.post("/api/agents/technical/question", async (req, res) => {
  try {
    const { domain, difficulty, format, role, company } = req.body as {
      domain?: string;
      difficulty?: string;
      format?: string;
      role?: string;
      company?: string;
    };
    const result = await generateTechQuestionWithDaniel({
      domain: domain ?? "System Design",
      difficulty: difficulty ?? "Intermediate",
      format: format ?? "System Design",
      role,
      company,
    });
    res.json(result);
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Question generation failed" });
  }
});

app.post("/api/agents/technical/evaluate", async (req, res) => {
  try {
    const { domain, difficulty, format, question, answer } = req.body as {
      domain?: string;
      difficulty?: string;
      format?: string;
      question?: string;
      answer?: string;
    };
    if (!question || !answer?.trim()) {
      res.status(400).json({ error: "Question and answer are required" });
      return;
    }
    const result = await evaluateTechAnswerWithDaniel({
      domain: domain ?? "System Design",
      difficulty: difficulty ?? "Intermediate",
      format: format ?? "System Design",
      question,
      answer,
    });
    db.prepare(
      "INSERT INTO practice_sessions (agent, category, difficulty, format, question, user_answer, evaluation_json, score) VALUES ('Daniel', ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      domain ?? "System Design",
      difficulty ?? "Intermediate",
      format ?? "System Design",
      question,
      answer,
      JSON.stringify(result.evaluation),
      result.score,
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Evaluation failed" });
  }
});

app.post("/api/agents/behavioral/question", async (req, res) => {
  try {
    const { category, role, company } = req.body as {
      category?: string;
      role?: string;
      company?: string;
    };
    const result = await generateBehavioralQuestionWithSarah({
      category: category ?? "Ownership",
      role,
      company,
    });
    res.json(result);
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Question generation failed" });
  }
});

app.post("/api/agents/behavioral/evaluate", async (req, res) => {
  try {
    const { category, question, answer } = req.body as {
      category?: string;
      question?: string;
      answer?: string;
    };
    if (!question || !answer?.trim()) {
      res.status(400).json({ error: "Question and response are required" });
      return;
    }
    const result = await evaluateBehavioralAnswerWithSarah({
      category: category ?? "Ownership",
      question,
      answer,
    });
    db.prepare(
      "INSERT INTO practice_sessions (agent, category, difficulty, format, question, user_answer, evaluation_json, score) VALUES ('sarah', ?, 'Standard', 'STAR', ?, ?, ?, ?)",
    ).run(
      category ?? "Ownership",
      question,
      answer,
      JSON.stringify(result.evaluation),
      result.score,
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Evaluation failed" });
  }
});

app.get("/api/agents/practice/history", (req, res) => {
  const agent = req.query["agent"] as string | undefined;
  const rows = agent
    ? db
        .prepare(
          "SELECT * FROM practice_sessions WHERE LOWER(agent) = LOWER(?) ORDER BY id DESC LIMIT 12",
        )
        .all(agent)
    : db.prepare("SELECT * FROM practice_sessions ORDER BY id DESC LIMIT 20").all();
  res.json({ history: rows });
});

// ---------------------------------------------------------------------------
// Marcus — Hiring Readiness & All-Agent Domain Reports
// ---------------------------------------------------------------------------
app.get("/api/reports", (_req, res) => {
  const reports = db
    .prepare(
      `
      SELECT
        ar.*,
        i.candidate_name,
        i.company_name,
        i.role,
        i.round_type,
        i.approach,
        i.difficulty,
        i.duration_minutes,
        i.recording_url
      FROM assessment_reports ar
      JOIN interviews i ON i.id = ar.interview_id
      ORDER BY ar.id DESC
    `,
    )
    .all() as Array<{ interview_id: number; [key: string]: unknown }>;

  const enriched = reports.map((r) => ({
    ...r,
    recordings: listRecordingsForInterviewJob(r.interview_id),
  }));
  res.json({ reports: enriched });
});

app.get("/api/interviews/:id/agent-reports", (req, res) => {
  const id = Number(req.params["id"]);
  const rows = db
    .prepare("SELECT * FROM agent_domain_reports WHERE interview_id = ? ORDER BY id ASC")
    .all(id);
  res.json({ agentReports: rows });
});

app.get("/api/reports/agent/:agent", (req, res) => {
  const agent = req.params["agent"] ?? "Nikhil";
  const rows = db
    .prepare(
      `
      SELECT
        adr.*,
        i.candidate_name,
        i.company_name,
        i.role,
        i.round_type,
        i.approach,
        i.difficulty,
        i.duration_minutes,
        i.recording_url,
        i.status AS interview_status
      FROM agent_domain_reports adr
      JOIN interviews i ON i.id = adr.interview_id
      WHERE LOWER(adr.agent) = LOWER(?)
      ORDER BY adr.id DESC
    `,
    )
    .all(agent);
  res.json({ reports: rows });
});

export default app;
