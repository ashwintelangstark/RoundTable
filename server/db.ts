import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
fs.mkdirSync(config.uploadsDir, { recursive: true });
fs.mkdirSync(config.recordingsDir, { recursive: true });

export const db = new DatabaseSync(config.databasePath);

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS email_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_text TEXT NOT NULL,
    delivery_mode TEXT NOT NULL,
    delivered INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS interviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_interview_id INTEGER REFERENCES interviews(id) ON DELETE SET NULL,
    candidate_name TEXT NOT NULL,
    email TEXT NOT NULL,
    company_name TEXT NOT NULL,
    role TEXT NOT NULL,
    company_desc TEXT NOT NULL DEFAULT '',
    job_description TEXT NOT NULL DEFAULT '',
    resume_filename TEXT NOT NULL DEFAULT '',
    resume_text TEXT NOT NULL DEFAULT '',
    duration_minutes INTEGER NOT NULL DEFAULT 15,
    difficulty TEXT NOT NULL DEFAULT 'Intermediate',
    round_type TEXT NOT NULL DEFAULT 'Technical Round',
    approach TEXT NOT NULL DEFAULT 'Standard Panel',
    experience_level TEXT NOT NULL DEFAULT '1–3 years',
    status TEXT NOT NULL DEFAULT 'Registered',
    overall_score INTEGER,
    recording_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS interview_recordings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id INTEGER NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    round_type TEXT NOT NULL DEFAULT 'Technical Round',
    approach TEXT NOT NULL DEFAULT 'Standard Panel',
    recording_url TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS interview_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id INTEGER NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    speaker TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    phase TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cv_telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id INTEGER NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    face_detected INTEGER NOT NULL,
    expression TEXT NOT NULL,
    eye_contact_score REAL NOT NULL,
    smile_score REAL NOT NULL,
    composure_score REAL NOT NULL,
    engagement_score REAL NOT NULL,
    head_offset_x REAL NOT NULL DEFAULT 0,
    head_offset_y REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS assessment_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id INTEGER UNIQUE NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL,
    verdict TEXT NOT NULL,
    summary TEXT NOT NULL,
    breakdown_json TEXT NOT NULL,
    cv_summary_json TEXT NOT NULL,
    panel_notes_json TEXT NOT NULL,
    roadmap_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS career_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id INTEGER REFERENCES interviews(id) ON DELETE SET NULL,
    company_name TEXT NOT NULL,
    role TEXT NOT NULL,
    job_description TEXT NOT NULL,
    analysis_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS resume_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id INTEGER REFERENCES interviews(id) ON DELETE SET NULL,
    filename TEXT NOT NULL,
    resume_text TEXT NOT NULL,
    target_jd TEXT NOT NULL DEFAULT '',
    overall_score INTEGER NOT NULL,
    analysis_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS practice_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent TEXT NOT NULL,
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'Intermediate',
    format TEXT NOT NULL DEFAULT 'Conceptual',
    question TEXT NOT NULL,
    user_answer TEXT NOT NULL DEFAULT '',
    evaluation_json TEXT,
    score INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agent_domain_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id INTEGER NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    agent TEXT NOT NULL,
    domain_title TEXT NOT NULL,
    score INTEGER NOT NULL,
    verdict TEXT NOT NULL,
    summary TEXT NOT NULL,
    strengths_json TEXT NOT NULL,
    improvements_json TEXT NOT NULL,
    question_reviews_json TEXT NOT NULL,
    metrics_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(interview_id, agent)
  );
`);

try {
  db.exec("ALTER TABLE interviews ADD COLUMN recording_url TEXT;");
} catch {
  // Column already exists
}
try {
  db.exec("ALTER TABLE interviews ADD COLUMN round_type TEXT NOT NULL DEFAULT 'Technical Round';");
} catch {
  // Column already exists
}
try {
  db.exec(
    "ALTER TABLE interviews ADD COLUMN parent_interview_id INTEGER REFERENCES interviews(id) ON DELETE SET NULL;",
  );
} catch {
  // Column already exists
}

export function markDemoSeedDismissed() {
  db.prepare(
    "INSERT INTO app_meta (key, value) VALUES ('demo_seed_applied', '1') ON CONFLICT(key) DO UPDATE SET value = '1'",
  ).run();
}

function backfillLegacyRecordings() {
  const rows = db
    .prepare(
      "SELECT id, round_type, approach, recording_url, created_at FROM interviews WHERE recording_url IS NOT NULL AND recording_url != ''",
    )
    .all() as Array<{
    id: number;
    round_type: string;
    approach: string;
    recording_url: string;
    created_at: string;
  }>;

  const existsStmt = db.prepare(
    "SELECT id FROM interview_recordings WHERE interview_id = ? AND recording_url = ? LIMIT 1",
  );
  const insertStmt = db.prepare(
    `INSERT INTO interview_recordings (interview_id, attempt_number, round_type, approach, recording_url, created_at)
     VALUES (?, 1, ?, ?, ?, ?)`,
  );

  for (const r of rows) {
    if (!existsStmt.get(r.id, r.recording_url)) {
      insertStmt.run(
        r.id,
        r.round_type || "Technical Round",
        r.approach || "Standard Panel",
        r.recording_url,
        r.created_at,
      );
    }
  }
}

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

export function listRecordingsForInterviewJob(interviewId: number): InterviewRecordingRow[] {
  const target = db
    .prepare(
      "SELECT id, parent_interview_id, email, company_name, role FROM interviews WHERE id = ?",
    )
    .get(interviewId) as
    | {
        id: number;
        parent_interview_id: number | null;
        email: string;
        company_name: string;
        role: string;
      }
    | undefined;

  if (!target) return [];

  const rootId = target.parent_interview_id ?? target.id;
  const siblingIds = db
    .prepare(
      `
      SELECT id FROM interviews
      WHERE id = ? OR id = ? OR parent_interview_id = ?
         OR (LOWER(email) = LOWER(?) AND LOWER(company_name) = LOWER(?) AND LOWER(role) = LOWER(?))
    `,
    )
    .all(target.id, rootId, rootId, target.email, target.company_name, target.role) as Array<{
    id: number;
  }>;

  const ids = Array.from(new Set(siblingIds.map((r) => r.id)));
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => "?").join(",");
  return db
    .prepare(
      `
      SELECT ir.*
      FROM interview_recordings ir
      WHERE ir.interview_id IN (${placeholders})
      ORDER BY ir.created_at ASC, ir.id ASC
    `,
    )
    .all(...ids) as unknown as InterviewRecordingRow[];
}

function seedInitialShowcaseData() {
  const metaRow = db.prepare("SELECT value FROM app_meta WHERE key = 'demo_seed_applied'").get() as
    { value: string } | undefined;
  if (metaRow?.value === "1") return;

  const row = db.prepare("SELECT COUNT(*) AS count FROM interviews").get() as { count: number };
  if (row.count > 0) {
    markDemoSeedDismissed();
    return;
  }

  // Mark immediately so if user deletes NVIDIA later it never regenerates
  markDemoSeedDismissed();

  const insertInterview = db.prepare(`
    INSERT INTO interviews (
      candidate_name, email, company_name, role, company_desc, job_description,
      resume_filename, resume_text, duration_minutes, difficulty, approach,
      experience_level, status, overall_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const res = insertInterview.run(
    "Ashwin Telang",
    "ashwin@roundtable.ai",
    "NVIDIA",
    "AI Engineer",
    "Accelerated computing and foundation AI systems powering inference, robotics, and simulation.",
    "Build scalable LLM & vision inference pipelines, optimize TensorRT/ONNX latency, and collaborate across research and systems teams.",
    "Ashwin_Telang_Resume.pdf",
    "Built real-time computer vision and agentic LLM orchestration systems using Python, PyTorch, OpenCV, TypeScript, and React. Reduced inference latency by 38% via quantization and batched serving.",
    15,
    "Intermediate",
    "Standard Panel",
    "1–3 years",
    "Completed",
    84,
  );

  const interviewId = Number(res.lastInsertRowid);

  const insertMsg = db.prepare(
    "INSERT INTO interview_messages (interview_id, speaker, role, content, phase) VALUES (?, ?, ?, ?, ?)",
  );
  insertMsg.run(
    interviewId,
    "Nikhil",
    "assistant",
    "Welcome to RoundTable. For this AI Engineer role at NVIDIA, our focus is production inference efficiency and cross-team ownership. Briefly share what draws you to accelerated AI systems.",
    "Opening",
  );
  insertMsg.run(
    interviewId,
    "You",
    "user",
    "I've spent the past two years optimizing computer vision and LLM pipelines, cutting tail latency by 38% with quantized batching and structured telemetry.",
    "Opening",
  );
  insertMsg.run(
    interviewId,
    "Daniel",
    "assistant",
    "Solid metric. Walk me through how you prevented throughput collapse or accuracy drift when you introduced quantization.",
    "Technical",
  );
  insertMsg.run(
    interviewId,
    "You",
    "user",
    "We held out a golden calibration set, tracked p99 latency alongside task-level F1, and kept sensitive attention layers in fp16.",
    "Technical",
  );

  db.prepare(
    `
    INSERT INTO assessment_reports (
      interview_id, overall_score, verdict, summary,
      breakdown_json, cv_summary_json, panel_notes_json, roadmap_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    interviewId,
    84,
    "Hire — Strong Technical Trajectory",
    "Ashwin demonstrated clear ownership of production AI latency optimizations and anchored answers with real calibration metrics. Deepening multi-node distributed scheduling trade-offs will raise readiness to Strong Hire.",
    JSON.stringify({
      technical: 86,
      problem_solving: 82,
      communication: 85,
      behavioral: 88,
      system_design: 79,
    }),
    JSON.stringify({
      avg_eye_contact: 86,
      avg_composure: 88,
      avg_engagement: 84,
      dominant_expression: "Composed & Attentive",
      coaching_note:
        "Steady eye contact and calm cadence during technical follow-ups. Keep pausing briefly before complex architecture explanations.",
    }),
    JSON.stringify([
      {
        agent: "Nikhil",
        title: "JD & Company Decoder Agent",
        score: 85,
        note: "Strong alignment with NVIDIA inference and latency priorities.",
      },
      {
        agent: "ananya",
        title: "Resume Gap & Strength Analyst Agent",
        score: 84,
        note: "38% latency reduction stood out; add explicit QPS/concurrency numbers on your resume.",
      },
      {
        agent: "Daniel",
        title: "Technical System Design Interviewer Agent",
        score: 80,
        note: "Strong mixed-precision reasoning; probe deeper into KV-cache paging and autoscaling.",
      },
      {
        agent: "sarah",
        title: "Behavioral & Culture Fit Interviewer Agent",
        score: 88,
        note: "Clear ownership and collaborative framing across research and production teams.",
      },
      {
        agent: "Marcus",
        title: "Hiring Bar Raiser Agent",
        score: 83,
        note: "Meets engineering bar; focus next session on failure recovery under burst traffic.",
      },
    ]),
    JSON.stringify([
      {
        priority: "PRIORITY 01",
        title: "Distributed Inference Trade-offs",
        detail:
          "Practice KV-cache memory budgeting, tensor parallelism, and tail-latency SLAs with Daniel.",
        target_section: "/technical",
      },
      {
        priority: "PRIORITY 02",
        title: "Quantify Scale on Resume",
        detail:
          "Pair your 38% latency win with baseline QPS, hardware spec, and cost impact in Ananya's lab.",
        target_section: "/resume",
      },
      {
        priority: "PRIORITY 03",
        title: "Executive Conciseness",
        detail:
          "Lead with the headline decision in 15 seconds before detailing implementation mechanics.",
        target_section: "/behavioral",
      },
    ]),
  );
}

function seedAgentDomainReportsIfEmpty() {
  const existingCount = (
    db.prepare("SELECT COUNT(*) AS count FROM agent_domain_reports").get() as { count: number }
  ).count;
  if (existingCount > 0) return;

  const firstCompleted = db
    .prepare("SELECT * FROM interviews WHERE status = 'Completed' ORDER BY id ASC LIMIT 1")
    .get() as { id: number; company_name: string; role: string } | undefined;
  if (!firstCompleted) return;

  const insertDomain = db.prepare(`
    INSERT INTO agent_domain_reports (
      interview_id, agent, domain_title, score, verdict, summary,
      strengths_json, improvements_json, question_reviews_json, metrics_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(interview_id, agent) DO NOTHING
  `);

  const domainSeed = [
    {
      agent: "Nikhil",
      domain_title: "Career Intelligence · JD & Company Alignment",
      score: 85,
      verdict: "Strong Role Alignment",
      summary: `Candidate aligned closely with ${firstCompleted.company_name}'s inference latency goals and demonstrated clear domain motivation for the ${firstCompleted.role} position.`,
      strengths: [
        "Directly tied prior inference work to production latency targets",
        "Articulated clear motivation for domain-specific systems engineering",
      ],
      improvements: [
        "Reference competitor benchmarks and ecosystem trade-offs earlier",
        "Connect technical choices to product-level cost/SLA metrics",
      ],
      reviews: [
        {
          question: "Walk us through your core work and alignment with this role.",
          answer:
            "Optimized computer vision and LLM inference pipelines, cutting tail latency by 38% via quantized batching.",
          feedback: "Crisp strategic framing aligned immediately with JD core priorities.",
        },
      ],
      metrics: { jd_alignment: 88, company_fit: 84, strategic_clarity: 83 },
    },
    {
      agent: "ananya",
      domain_title: "Resume Intelligence · Claims & Gap Audit",
      score: 84,
      verdict: "Verified Claims",
      summary:
        "Resume optimization metrics (38% latency reduction) held up smoothly during live probing with transparent methodology.",
      strengths: [
        "38% latency gain corroborated by real calibration methodology",
        "Clear distinction between personal ownership and team scope",
      ],
      improvements: [
        "Specify exact GPU hardware, QPS load, and baseline vs tuned latency",
        "Quantify cost-per-million tokens saved on the resume directly",
      ],
      reviews: [
        {
          question: "How was your 38% optimization validated against regressions?",
          answer:
            "Used a golden calibration set tracking p99 latency alongside task-level F1 while preserving fp16 attention layers.",
          feedback: "Strong proof of hands-on validation; surface these baselines on CV.",
        },
      ],
      metrics: { claim_verification: 86, quantified_impact: 81, resume_alignment: 85 },
    },
    {
      agent: "Daniel",
      domain_title: "Technical Interview Lab · Architecture & Systems",
      score: 81,
      verdict: "Pass · High Potential",
      summary:
        "Demonstrated practical intuition on mixed-precision quantization and p99 observability under production inference load.",
      strengths: [
        "Sound mixed-precision fallback intuition keeping attention in fp16",
        "Measured p99 tail latency alongside task accuracy",
      ],
      improvements: [
        "Deepen multi-node KV-cache scheduling and burst failover handling",
        "Outline explicit circuit-breaker thresholds during traffic spikes",
      ],
      reviews: [
        {
          question: "How did you prevent throughput collapse or accuracy drift when quantizing?",
          answer:
            "Tracked p99 alongside F1 on calibration sets and locked sensitive layers to fp16.",
          feedback: "Solid systems reasoning; push deeper on distributed autoscaling.",
        },
      ],
      metrics: { architecture_depth: 82, trade_off_rigor: 80, systems_reliability: 79 },
    },
    {
      agent: "sarah",
      domain_title: "Behavioral Intelligence · Culture & Composure",
      score: 87,
      verdict: "Strong Culture Fit",
      summary:
        "Calm, poised vocal delivery backed by strong OpenCV eye contact and composed executive presence throughout technical stress testing.",
      strengths: [
        "Calm composure and steady eye contact under rapid probing",
        "Ownership-driven narrative framing without blaming collaborators",
      ],
      improvements: [
        "Lead STAR responses with the quantified headline outcome in 15s",
        "Highlight how disagreements across research teams were resolved",
      ],
      reviews: [
        {
          question: "Cross-team ownership and communication under production pressure.",
          answer: "Balanced research accuracy constraints with production SLA commitments cleanly.",
          feedback: "Strong collaborative maturity and composed demeanor.",
        },
      ],
      metrics: { composure: 88, eye_contact: 86, star_clarity: 85, culture_fit: 89 },
    },
    {
      agent: "Marcus",
      domain_title: "Hiring Readiness · Executive Bar Raiser Verdict",
      score: 84,
      verdict: "Hire",
      summary:
        "Meets the panel hiring bar with verified technical delivery and calm behavioral presence; ready for final-stage interviews with deeper burst-failure practice.",
      strengths: [
        "Consistent technical credibility matched with composed delivery",
        "High alignment across JD, resume claims, and systems thinking",
      ],
      improvements: [
        "Drill worst-case multi-region degradation scenarios",
        "Pair every metric on resume with baseline throughput/cost impact",
      ],
      reviews: [
        {
          question: "Overall readiness synthesis across all 5 panel rounds.",
          answer: "Delivered grounded production examples with measurable accuracy safeguards.",
          feedback: "Clear Hire trajectory with strong cross-domain consistency.",
        },
      ],
      metrics: { overall_bar_fit: 84, ownership_signal: 86, readiness_index: 84 },
    },
  ];

  for (const item of domainSeed) {
    insertDomain.run(
      firstCompleted.id,
      item.agent,
      item.domain_title,
      item.score,
      item.verdict,
      item.summary,
      JSON.stringify(item.strengths),
      JSON.stringify(item.improvements),
      JSON.stringify(item.reviews),
      JSON.stringify(item.metrics),
    );
  }
}

seedInitialShowcaseData();
seedAgentDomainReportsIfEmpty();
backfillLegacyRecordings();
