import {
  callOpenRouter,
  callOpenRouterJson,
  callOpenRouterStream,
  type ChatMessage,
} from "./openrouter";

export interface InterviewRecord {
  id: number;
  candidate_name: string;
  email: string;
  company_name: string;
  role: string;
  company_desc: string;
  job_description: string;
  resume_filename: string;
  resume_text: string;
  duration_minutes: number;
  difficulty: string;
  round_type?: string;
  approach: string;
  experience_level: string;
  status: string;
  overall_score: number | null;
}

export const ROUND_TYPES = ["Technical Round", "HR Round"] as const;
export type InterviewRoundType = (typeof ROUND_TYPES)[number];

export function normalizeRoundType(roundType?: string, approach?: string): InterviewRoundType {
  const combined = `${roundType ?? ""} ${approach ?? ""}`.toLowerCase();
  if (combined.includes("hr round") || combined === "hr" || combined.includes("behavioral heavy")) {
    return "HR Round";
  }
  return "Technical Round";
}

export function buildOpeningGreeting(interview: {
  candidate_name: string;
  role: string;
  company_name: string;
  round_type?: string;
  approach?: string;
}): string {
  const round = normalizeRoundType(interview.round_type, interview.approach);
  if (round === "HR Round") {
    return `Welcome ${interview.candidate_name}! I'm Nikhil for your ${interview.company_name} HR Round. Question one: why does this ${interview.role} role excite you right now?`;
  }
  return `Welcome ${interview.candidate_name}! I'm Nikhil for your ${interview.company_name} Technical Round. Question one: walk me through the hardest system you engineered and its key trade-offs.`;
}

export interface MessageRecord {
  speaker: string;
  role: string;
  content: string;
  phase: string;
}

export interface CvAggregate {
  sample_count: number;
  avg_eye_contact: number;
  avg_composure: number;
  avg_engagement: number;
  dominant_expression: string;
}

export async function decodeCareerWithNikhil(input: {
  companyName: string;
  role: string;
  companyDesc: string;
  jobDescription: string;
}) {
  const prompt = `You are Nikhil, the JD & Company Decoder Agent at RoundTable.
Analyze this target role and company deeply and return ONLY valid JSON matching this exact schema:
{
  "summary": "2-3 sentence strategic decode of what this employer actually hires for in this role",
  "company_signals": ["3-4 concise strategic insights about the company's products, culture, or engineering bar"],
  "competencies": [
    { "name": "Competency name", "weight": 90, "expectation": "What strong candidates demonstrate" }
  ],
  "hidden_expectations": ["3 unspoken signals or red flags interviewers check for"],
  "interview_themes": ["4 likely interview round themes"],
  "prep_strategy": ["3 high-leverage preparation actions"]
}
Provide 5 competencies with weights from 50 to 98.

Company: ${input.companyName || "Target Company"}
Role: ${input.role || "Software / AI Engineer"}
Company Context: ${input.companyDesc || "Not provided"}
Job Description: ${input.jobDescription || "Standard engineering expectations for this title."}`;

  const { data: analysis, model } = await callOpenRouterJson<Record<string, unknown>>(
    [
      {
        role: "system",
        content: "You are Nikhil, an incisive career strategist. Return strict JSON only.",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0.45, maxTokens: 1600 },
  );

  return { analysis, model };
}

export async function analyzeResumeWithAnanya(input: {
  resumeText: string;
  targetJd: string;
  role?: string | undefined;
  company?: string | undefined;
}) {
  const prompt = `You are Ananya, the Resume Gap & Strength Analyst Agent at RoundTable.
Review this candidate's resume thoroughly against the target role/JD and return ONLY valid JSON matching this schema:
{
  "overall_score": 82,
  "subscores": {
    "structure_readability": 86,
    "achievement_clarity": 78,
    "role_alignment": 81,
    "quantified_impact": 75
  },
  "executive_summary": "2-3 sentence candid evaluation of resume readiness",
  "strengths": [
    { "title": "Strength headline", "detail": "Concrete evidence from their resume" }
  ],
  "gaps": [
    { "title": "Gap headline", "severity": "High|Medium|Low", "fix": "Specific actionable fix" }
  ],
  "bullet_rewrites": [
    { "original": "Weak or generic bullet/claim from resume", "improved": "Quantified, high-impact rewritten bullet", "reason": "Why it passes hiring bars" }
  ],
  "missing_keywords": ["5-8 high-signal skills or domain terms missing or under-emphasized"]
}
Include 3 strengths, 3 gaps, and 3 bullet rewrites grounded directly in the resume text below.

Target Company/Role: ${input.company ?? ""} ${input.role ?? ""}
Target JD: ${input.targetJd || "General technical/professional benchmark for candidate's stated experience."}

RESUME TEXT:
${input.resumeText.slice(0, 7000)}`;

  const { data: parsed, model } = await callOpenRouterJson<
    { overall_score?: number } & Record<string, unknown>
  >(
    [
      {
        role: "system",
        content: "You are Ananya, a sharp executive resume analyst. Return strict JSON only.",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0.45, maxTokens: 1800 },
  );

  return {
    overall_score: Math.max(30, Math.min(99, Number(parsed.overall_score ?? 78))),
    analysis: parsed,
    model,
  };
}

export async function generateTechQuestionWithDaniel(input: {
  domain: string;
  difficulty: string;
  format: string;
  role?: string | undefined;
  company?: string | undefined;
}) {
  const prompt = `You are Daniel, Technical System Design Interviewer Agent at RoundTable.
Generate ONE realistic, crisp ${input.difficulty}-level ${input.format} interview question in the domain "${input.domain}"${input.company ? ` tailored for ${input.role ?? "Engineer"} at ${input.company}` : ""}.
Return ONLY valid JSON:
{
  "question": "Clear, thought-provoking question (2-4 sentences)",
  "hints": ["2 short coaching hints if candidate gets stuck"],
  "rubric": ["3 key technical points a strong answer covers"]
}`;

  const { data, model } = await callOpenRouterJson<Record<string, unknown>>(
    [
      {
        role: "system",
        content:
          "You are Daniel, a staff technical & system design interviewer. Return strict JSON only.",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0.7, maxTokens: 900 },
  );

  return { data, model };
}

export async function evaluateTechAnswerWithDaniel(input: {
  domain: string;
  difficulty: string;
  format: string;
  question: string;
  answer: string;
}) {
  const prompt = `You are Daniel, Technical System Design Interviewer Agent at RoundTable.
Evaluate the candidate's answer rigorously and constructively. Return ONLY valid JSON:
{
  "score": 81,
  "verdict": "Strong Pass|Pass|Borderline|Needs Depth",
  "summary": "2 sentence assessment of technical precision and trade-off awareness",
  "strengths": ["2-3 specific things they got right"],
  "gaps": ["2-3 missing trade-offs, edge cases, or scaling bottlenecks"],
  "follow_up_question": "One sharp follow-up question you would ask next",
  "ideal_outline": "Concise 4-point blueprint of an exemplary answer"
}

Domain: ${input.domain} (${input.difficulty} · ${input.format})
Question: ${input.question}
Candidate Answer: ${input.answer}`;

  const { data: parsed, model } = await callOpenRouterJson<
    { score?: number } & Record<string, unknown>
  >(
    [
      {
        role: "system",
        content:
          "You are Daniel, a pragmatic senior technical interviewer. Return strict JSON only.",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0.45, maxTokens: 1300 },
  );

  return {
    score: Math.max(20, Math.min(99, Number(parsed.score ?? 75))),
    evaluation: parsed,
    model,
  };
}

export async function generateBehavioralQuestionWithSarah(input: {
  category: string;
  role?: string | undefined;
  company?: string | undefined;
}) {
  const prompt = `You are Sarah, Behavioral & Culture Fit Interviewer Agent at RoundTable.
Generate ONE realistic behavioral interview prompt for category "${input.category}"${input.company ? ` for ${input.role ?? "Candidate"} at ${input.company}` : ""}.
Return ONLY valid JSON:
{
  "question": "Realistic behavioral prompt (1-3 sentences)",
  "signal_sought": "What competency or leadership principle this probes",
  "star_tip": "Quick reminder on structuring a high-impact STAR story"
}`;

  const { data, model } = await callOpenRouterJson<Record<string, unknown>>(
    [
      {
        role: "system",
        content:
          "You are Sarah, an empathetic yet discerning behavioral interviewer. Return strict JSON only.",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0.7, maxTokens: 700 },
  );

  return { data, model };
}

export async function evaluateBehavioralAnswerWithSarah(input: {
  category: string;
  question: string;
  answer: string;
}) {
  const prompt = `You are Sarah, Behavioral & Culture Fit Interviewer Agent at RoundTable.
Evaluate this STAR response and help the candidate elevate executive presence and ownership. Return ONLY valid JSON:
{
  "score": 84,
  "star_scores": {
    "situation": 82,
    "task": 80,
    "action": 86,
    "result": 78
  },
  "strengths": ["2 specific strengths in their storytelling or ownership"],
  "coaching_feedback": "2-3 sentences of constructive personality, clarity, and impact coaching",
  "polished_star_example": "A concise elevated rewrite of their own story showing tighter STAR pacing"
}

Category: ${input.category}
Question: ${input.question}
Candidate Response: ${input.answer}`;

  const { data: parsed, model } = await callOpenRouterJson<
    { score?: number } & Record<string, unknown>
  >(
    [
      {
        role: "system",
        content:
          "You are Sarah, an executive behavioral coach and interviewer. Return strict JSON only.",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0.5, maxTokens: 1300 },
  );

  return {
    score: Math.max(20, Math.min(99, Number(parsed.score ?? 78))),
    evaluation: parsed,
    model,
  };
}

export const AGENT_ORDER = ["Nikhil", "ananya", "Daniel", "sarah", "Marcus"] as const;
export type AgentName = (typeof AGENT_ORDER)[number];
export const QUESTIONS_PER_AGENT = 6;
export const TOTAL_PANEL_QUESTIONS = AGENT_ORDER.length * QUESTIONS_PER_AGENT; // 30

export interface PanelProgress {
  agent: AgentName;
  agentIndex: number;
  questionInTurn: number; // 1 to 6
  overallQuestion: number; // 1 to 30
  totalQuestions: number;
  questionsPerAgent: number;
  isFirstQuestionOfAgent: boolean;
  isLastQuestionOfAgent: boolean;
  isFinalInterviewQuestion: boolean;
  isInterviewComplete: boolean;
  phase: string;
}

export function getPanelProgress(turnIndex: number): PanelProgress {
  if (turnIndex >= TOTAL_PANEL_QUESTIONS) {
    return {
      agent: "Marcus",
      agentIndex: 4,
      questionInTurn: QUESTIONS_PER_AGENT,
      overallQuestion: TOTAL_PANEL_QUESTIONS,
      totalQuestions: TOTAL_PANEL_QUESTIONS,
      questionsPerAgent: QUESTIONS_PER_AGENT,
      isFirstQuestionOfAgent: false,
      isLastQuestionOfAgent: true,
      isFinalInterviewQuestion: true,
      isInterviewComplete: true,
      phase: `Completed All ${TOTAL_PANEL_QUESTIONS} Questions · Generating Reports`,
    };
  }

  const boundedTurn = Math.max(0, turnIndex);
  const agentIndex = Math.floor(boundedTurn / QUESTIONS_PER_AGENT);
  const agent = AGENT_ORDER[agentIndex] ?? "Marcus";
  const questionInTurn = (boundedTurn % QUESTIONS_PER_AGENT) + 1;
  const overallQuestion = boundedTurn + 1;
  const isFirstQuestionOfAgent = questionInTurn === 1;
  const isLastQuestionOfAgent = questionInTurn === QUESTIONS_PER_AGENT;
  const isFinalInterviewQuestion = overallQuestion === TOTAL_PANEL_QUESTIONS;

  const phaseNameMap: Record<AgentName, string> = {
    Nikhil: "JD & Role Fit",
    ananya: "Resume Audit",
    Daniel: "Technical / Execution",
    sarah: "Behavioral & Culture",
    Marcus: "Executive Bar Raiser",
  };

  return {
    agent,
    agentIndex,
    questionInTurn,
    overallQuestion,
    totalQuestions: TOTAL_PANEL_QUESTIONS,
    questionsPerAgent: QUESTIONS_PER_AGENT,
    isFirstQuestionOfAgent,
    isLastQuestionOfAgent,
    isFinalInterviewQuestion,
    isInterviewComplete: false,
    phase: `${phaseNameMap[agent]} (${agent} · Q${questionInTurn}/6)`,
  };
}

function chooseNextPanelist(input: {
  turnIndex: number;
  requestedAgent?: string | undefined;
}): PanelProgress {
  const prog = getPanelProgress(input.turnIndex);
  if (prog.isInterviewComplete) return prog;

  if (input.requestedAgent) {
    const matched = AGENT_ORDER.find(
      (a) => a.toLowerCase() === input.requestedAgent!.toLowerCase(),
    );
    if (matched) {
      return {
        ...prog,
        agent: matched,
        phase: `${matched} · Question ${prog.questionInTurn}/6`,
      };
    }
  }

  return prog;
}

const AGENT_PERSONAS: Record<string, string> = {
  Nikhil:
    "Nikhil (JD & Company Decoder Agent): sharp, welcoming strategist connecting candidate background to company mission and role expectations.",
  ananya:
    "ananya (Resume Gap & Strength Analyst Agent): perceptive analyst probing concrete claims, metrics, timelines, and potential gaps on the candidate's resume.",
  Daniel:
    "Daniel (Technical System Design Interviewer Agent): calm senior systems architect probing technical depth, architecture decisions, or execution rigor.",
  sarah:
    "sarah (Behavioral & Culture Fit Interviewer Agent): warm people lead probing teamwork, conflict resolution, ownership, and workplace culture via STAR.",
  Marcus:
    "Marcus (Hiring Bar Raiser Agent): executive bar-raiser testing high-stakes judgment, long-term trajectory, integrity, and overall hire bar.",
};

function getRoundSpecificFocus(agent: AgentName, roundType: InterviewRoundType): string {
  if (roundType === "HR Round") {
    switch (agent) {
      case "Nikhil":
        return "HR ROUND FOCUS (Nikhil): Ask about motivation to join this company, cultural & mission alignment, role expectations, preferred work environment/collaboration style, and long-term career roadmap.";
      case "ananya":
        return "HR ROUND FOCUS (Ananya): Probe resume timeline transitions, reasons for switching or gaps, key achievements outside pure code, cross-team contributions, strengths vs growth areas, and self-awareness.";
      case "Daniel":
        return "HR ROUND FOCUS (Daniel): Assess practical project execution, communicating progress to non-technical stakeholders, meeting deadlines under shifting specs, quality accountability, and pragmatic problem solving (avoid heavy algorithm/code drills).";
      case "sarah":
        return "HR ROUND FOCUS (Sarah): Deep HR behavioral STAR questions — resolving workplace conflict, handling tough feedback, empathy, leadership under stress, adaptability, and culture values.";
      case "Marcus":
        return "HR ROUND FOCUS (Marcus): Executive HR bar — ethical dilemmas, owning failures transparently, compensation/growth alignment, what drives peak performance, and final hiring suitability.";
    }
  }

  // Technical Round
  switch (agent) {
    case "Nikhil":
      return "TECHNICAL ROUND FOCUS (Nikhil): Probe technical JD stack fit, engineering KPIs, core product engineering challenges, production tooling, scalability goals, and technical readiness for this role.";
    case "ananya":
      return "TECHNICAL ROUND FOCUS (Ananya): Probe concrete technical projects & claims on the candidate's resume — exact stack ownership, latency/scale metrics achieved, debugging breakthroughs, and missing JD tech skills.";
    case "Daniel":
      return "TECHNICAL ROUND FOCUS (Daniel): Rigorous Technical & System Design probing — architecture diagrams, database indexing/sharding, caching/failover, API bottlenecks, concurrency, and algorithmic trade-offs.";
    case "sarah":
      return "TECHNICAL ROUND FOCUS (Sarah): Engineering collaboration & ownership — handling code review disagreements, production outages/postmortems, mentoring, and technical leadership under deadlines (STAR).";
    case "Marcus":
      return "TECHNICAL ROUND FOCUS (Marcus): Senior Technical Bar Raiser — high-ambiguity architectural trade-offs, build-vs-buy risk, failure-mode resilience, and engineering bar readiness.";
  }
}

function buildPanelPromptAndMessages(input: {
  interview: InterviewRecord;
  history: MessageRecord[];
  userMessage?: string | undefined;
  progress: PanelProgress;
  cvSummary?: CvAggregate | null | undefined;
}): ChatMessage[] {
  const {
    agent,
    questionInTurn,
    overallQuestion,
    isFirstQuestionOfAgent,
    isLastQuestionOfAgent,
    totalQuestions,
  } = input.progress;

  const roundType = normalizeRoundType(input.interview.round_type, input.interview.approach);
  const roundFocus = getRoundSpecificFocus(agent, roundType);

  const cvNote =
    input.cvSummary && input.cvSummary.sample_count > 0
      ? `OpenCV Camera Telemetry: expression=${input.cvSummary.dominant_expression}, eye_contact=${input.cvSummary.avg_eye_contact.toFixed(0)}%, composure=${input.cvSummary.avg_composure.toFixed(0)}%.`
      : "Camera telemetry active.";

  const handoffNote =
    isFirstQuestionOfAgent && overallQuestion > 1
      ? `You are now taking over from the previous interviewer. Start briefly with a quick baton handoff (e.g., "Thanks! I'll take over now.") and ask your Question 1.`
      : isLastQuestionOfAgent
        ? `This is your 6th and final question for your round.`
        : `This is Question ${questionInTurn} of 6 for your turn.`;

  const systemPrompt = `You are speaking live as ${AGENT_PERSONAS[agent]}
Interviewing ${input.interview.candidate_name} for "${input.interview.role}" at "${input.interview.company_name}".
INTERVIEW ROUND MODE: ${roundType} (${roundFocus})
Difficulty: ${input.interview.difficulty} | Progress: ${agent} Q${questionInTurn}/6 (Overall ${overallQuestion}/${totalQuestions}).
${handoffNote}
Company Context: ${input.interview.company_desc || "Technology company"}
Job Description: ${input.interview.job_description?.slice(0, 600) || "Standard role expectations"}
Candidate Resume: ${input.interview.resume_text?.slice(0, 1100) || "Not provided"}
${cvNote}

STRICT REAL-TIME VOICE FORMAT (MUST OBEY):
1. Reply in EXACTLY 2 short, plain spoken sentences (maximum 25 words TOTAL).
2. Sentence 1 (4-7 words): Brief natural reaction directly referencing what the candidate just said (or brief handoff greeting on Q1).
3. Sentence 2 (10-17 words): ONE crisp, specific follow-up question matching ${roundType} and your domain.
4. NEVER repeat earlier questions. NEVER use markdown, bullet points, asterisks, stage directions, or speaker name prefixes.`;

  const chatMessages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

  const recentHistory = input.history.slice(-8);
  for (const msg of recentHistory) {
    chatMessages.push(
      msg.role === "user"
        ? { role: "user", content: msg.content }
        : { role: "assistant", content: `[${msg.speaker}]: ${msg.content}` },
    );
  }

  if (input.userMessage) {
    chatMessages.push({ role: "user", content: input.userMessage });
  }

  return chatMessages;
}

function cleanAgentSpeechOutput(content: string): string {
  return content
    .replace(/^\[?(Nikhil|ananya|Ananya|Daniel|sarah|Sarah|Marcus)\]?:\s*/i, "")
    .replace(/[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function conductPanelTurn(input: {
  interview: InterviewRecord;
  history: MessageRecord[];
  userMessage?: string | undefined;
  elapsedRatio: number;
  requestedAgent?: string | undefined;
  cvSummary?: CvAggregate | null | undefined;
}) {
  const priorUserTurns = input.history.filter((m) => m.role === "user").length;
  const completedUserAnswers = priorUserTurns + (input.userMessage ? 1 : 0);
  const progress = chooseNextPanelist({
    turnIndex: completedUserAnswers,
    requestedAgent: input.requestedAgent,
  });

  if (progress.isInterviewComplete) {
    return {
      speaker: "Marcus" as AgentName,
      phase: progress.phase,
      reply: `Thank you, ${input.interview.candidate_name}. You have completed all thirty panel questions—we are generating your five domain reports now.`,
      model: "deterministic-close",
      questionInTurn: progress.questionInTurn,
      overallQuestion: progress.overallQuestion,
      totalQuestions: progress.totalQuestions,
      isFinalInterviewQuestion: true,
      isInterviewComplete: true,
    };
  }

  const chatMessages = buildPanelPromptAndMessages({
    interview: input.interview,
    history: input.history,
    userMessage: input.userMessage,
    progress,
    cvSummary: input.cvSummary,
  });

  const { content, model } = await callOpenRouter(chatMessages, {
    temperature: 0.65,
    maxTokens: 65,
    timeoutMs: 10000,
  });

  return {
    speaker: progress.agent,
    phase: progress.phase,
    reply: cleanAgentSpeechOutput(content),
    model,
    questionInTurn: progress.questionInTurn,
    overallQuestion: progress.overallQuestion,
    totalQuestions: progress.totalQuestions,
    isFinalInterviewQuestion: progress.isFinalInterviewQuestion,
    isInterviewComplete: false,
  };
}

export async function conductPanelTurnStream(
  input: {
    interview: InterviewRecord;
    history: MessageRecord[];
    userMessage?: string | undefined;
    elapsedRatio: number;
    requestedAgent?: string | undefined;
    cvSummary?: CvAggregate | null | undefined;
  },
  onSentence: (sentence: string, progress: PanelProgress) => void | Promise<void>,
) {
  const priorUserTurns = input.history.filter((m) => m.role === "user").length;
  const completedUserAnswers = priorUserTurns + (input.userMessage ? 1 : 0);
  const progress = chooseNextPanelist({
    turnIndex: completedUserAnswers,
    requestedAgent: input.requestedAgent,
  });

  if (progress.isInterviewComplete) {
    const closing = `Thank you, ${input.interview.candidate_name}. You have completed all thirty panel questions—we are generating your five domain reports now.`;
    await onSentence(closing, progress);
    return {
      speaker: "Marcus" as AgentName,
      phase: progress.phase,
      reply: closing,
      model: "deterministic-close",
      questionInTurn: progress.questionInTurn,
      overallQuestion: progress.overallQuestion,
      totalQuestions: progress.totalQuestions,
      isFinalInterviewQuestion: true,
      isInterviewComplete: true,
    };
  }

  const chatMessages = buildPanelPromptAndMessages({
    interview: input.interview,
    history: input.history,
    userMessage: input.userMessage,
    progress,
    cvSummary: input.cvSummary,
  });

  const { content, model } = await callOpenRouterStream(
    chatMessages,
    { temperature: 0.65, maxTokens: 65, timeoutMs: 10000 },
    async (sentence) => {
      const cleaned = cleanAgentSpeechOutput(sentence);
      if (cleaned) await onSentence(cleaned, progress);
    },
  );

  return {
    speaker: progress.agent,
    phase: progress.phase,
    reply: cleanAgentSpeechOutput(content),
    model,
    questionInTurn: progress.questionInTurn,
    overallQuestion: progress.overallQuestion,
    totalQuestions: progress.totalQuestions,
    isFinalInterviewQuestion: progress.isFinalInterviewQuestion,
    isInterviewComplete: false,
  };
}

export interface GeneratedAgentDomainReport {
  agent: AgentName;
  domain_title: string;
  score: number;
  verdict: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  question_reviews: Array<{ question: string; answer: string; feedback: string }>;
  metrics: Record<string, number>;
}

function scoreAnswerText(answer: string, domain: AgentName): { score: number; feedback: string } {
  const clean = answer.trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const lower = clean.toLowerCase();

  const evasivePenalty =
    /\b(i don't know|dont know|no idea|not sure|skip|pass|nothing|idk|never did)\b/i.test(lower);
  const hasMetrics =
    /\b\d+(?:\.\d+)?%|\b\d+\s*(?:ms|s|sec|x|users|requests|qps|rps|gb|mb|tb|k|m)\b|\bp9[059]\b/i.test(
      clean,
    );
  const hasTechnicalDepth =
    /\b(cache|redis|kafka|database|sql|index|shard|latency|throughput|scale|bottleneck|architecture|pipeline|queue|retry|timeout|consensus|model|inference|embedding|quantiz|api|microservice|observability|metric|trade-?off|bottleneck|concurrency|async)\b/i.test(
      lower,
    );
  const hasStarStructure =
    /\b(situation|task|action|result|owned|led|mentored|resolved|disagreed|aligned|delivered|improved|reduced|increased|learned|impact|stakeholder)\b/i.test(
      lower,
    );

  if (wordCount === 0) {
    return { score: 25, feedback: "No spoken answer was recorded for this prompt." };
  }
  if (evasivePenalty && wordCount < 14) {
    return {
      score: 36,
      feedback:
        "Answer lacked a concrete example or explanation; articulate a clear thought process even under uncertainty.",
    };
  }

  let score = 42;
  score += Math.min(26, wordCount * 0.72);
  if (hasMetrics) score += 12;
  if (domain === "Daniel" || domain === "Nikhil" || domain === "Marcus") {
    if (hasTechnicalDepth) score += 10;
  }
  if (domain === "sarah" || domain === "ananya" || domain === "Marcus") {
    if (hasStarStructure) score += 10;
  }
  if (wordCount < 7) score = Math.min(score, 52);
  if (evasivePenalty) score -= 18;

  const finalScore = Math.max(28, Math.min(97, Math.round(score)));
  const feedback =
    finalScore >= 84
      ? `Strong ${wordCount}-word response combining specific mechanics${hasMetrics ? " and measurable metrics" : ""}.`
      : finalScore >= 68
        ? `Solid ${wordCount}-word answer; strengthen impact by naming concrete metrics and alternative trade-offs.`
        : `Brief or surface-level (${wordCount} words); expand with concrete actions, constraints, and measurable results.`;

  return { score: finalScore, feedback };
}

function buildFallbackReport(input: {
  interview: InterviewRecord;
  messages: MessageRecord[];
  cvSummary: CvAggregate;
}): {
  overall_score: number;
  verdict: string;
  summary: string;
  breakdown: Record<string, number>;
  cv_coaching_note: string;
  panel_notes: Array<{ agent: string; title: string; score: number; note: string }>;
  roadmap: Array<{ priority: string; title: string; detail: string; target_section: string }>;
  agent_reports: GeneratedAgentDomainReport[];
  model: string;
} {
  const userMsgs = input.messages.filter((m) => m.role === "user");
  const roundType = normalizeRoundType(input.interview.round_type, input.interview.approach);

  // Build Q&A pairs grouped by asking agent with per-answer objective scoring
  const agentQAs: Record<
    AgentName,
    Array<{ question: string; answer: string; feedback: string }>
  > = {
    Nikhil: [],
    ananya: [],
    Daniel: [],
    sarah: [],
    Marcus: [],
  };
  const agentQuestionScores: Record<AgentName, number[]> = {
    Nikhil: [],
    ananya: [],
    Daniel: [],
    sarah: [],
    Marcus: [],
  };

  for (let i = 0; i < input.messages.length; i += 1) {
    const msg = input.messages[i]!;
    if (msg.role === "assistant") {
      const matchedAgent = AGENT_ORDER.find((a) => a.toLowerCase() === msg.speaker.toLowerCase());
      const nextMsg = input.messages[i + 1];
      if (matchedAgent && nextMsg && nextMsg.role === "user") {
        const evalRes = scoreAnswerText(nextMsg.content, matchedAgent);
        agentQuestionScores[matchedAgent].push(evalRes.score);
        agentQAs[matchedAgent].push({
          question: msg.content,
          answer: nextMsg.content,
          feedback: evalRes.feedback,
        });
      }
    }
  }

  const allScoredTurns = Object.values(agentQuestionScores).flat();
  const baseSignal =
    allScoredTurns.length > 0
      ? Math.round(allScoredTurns.reduce((a, b) => a + b, 0) / allScoredTurns.length)
      : 35;

  // Completion depth bonus/penalty: partial early exits cannot score High/Strong Hire artificially
  const completionRatio = Math.min(1, userMsgs.length / 12);
  const calibratedBase = Math.max(
    28,
    Math.min(96, Math.round(baseSignal * (0.72 + 0.28 * completionRatio))),
  );

  const avgForAgent = (agent: AgentName, fallbackOffset: number): number => {
    const list = agentQuestionScores[agent];
    if (list.length === 0) return Math.max(30, Math.min(92, calibratedBase + fallbackOffset));
    const raw = list.reduce((a, b) => a + b, 0) / list.length;
    return Math.max(28, Math.min(97, Math.round(raw * 0.78 + calibratedBase * 0.22)));
  };

  const hasCvSamples = input.cvSummary.sample_count > 0;
  const eye = hasCvSamples ? Math.round(input.cvSummary.avg_eye_contact) : 72;
  const composure = hasCvSamples ? Math.round(input.cvSummary.avg_composure) : 74;
  const engagement = hasCvSamples ? Math.round(input.cvSummary.avg_engagement) : 72;

  const nikhilScore = avgForAgent("Nikhil", 0);
  const ananyaScore = avgForAgent("ananya", -1);
  const danielScore = avgForAgent("Daniel", -2);
  const sarahRaw = avgForAgent("sarah", 0);
  const sarahScore = Math.max(
    30,
    Math.min(97, Math.round(sarahRaw * 0.7 + ((composure + eye) / 2) * 0.3)),
  );
  const marcusRaw = avgForAgent("Marcus", 0);
  const marcusScore = Math.max(
    28,
    Math.min(
      97,
      Math.round((nikhilScore + ananyaScore + danielScore + sarahScore + marcusRaw) / 5),
    ),
  );

  const verdictFor = (s: number) =>
    s >= 88 ? "Strong Hire" : s >= 78 ? "Hire" : s >= 64 ? "Lean Hire" : "Needs Preparation";

  const agentReports: GeneratedAgentDomainReport[] = [
    {
      agent: "Nikhil",
      domain_title: "Career Intelligence · JD & Company Alignment",
      score: nikhilScore,
      verdict:
        nikhilScore >= 80
          ? "Strong Role Fit"
          : nikhilScore >= 65
            ? "Developing Alignment"
            : "Role Gap",
      summary: `Evaluated ${input.interview.candidate_name}'s ${roundType} alignment with ${input.interview.company_name}'s ${input.interview.role} expectations across ${agentQAs.Nikhil.length} answered prompt(s).`,
      strengths: [
        agentQAs.Nikhil.length > 0
          ? `Addressed role focus across ${agentQAs.Nikhil.length} JD & company alignment question(s)`
          : "Registered role profile and target company scope cleanly",
        `Connected experience toward ${input.interview.company_name}'s domain priorities`,
      ],
      improvements: [
        "Tie answers explicitly to company products and measurable business KPIs",
        "Highlight top role competencies within the first 20 seconds of each response",
      ],
      question_reviews: agentQAs.Nikhil,
      metrics: {
        jd_alignment: nikhilScore,
        company_fit: Math.max(
          28,
          Math.min(97, nikhilScore + (agentQAs.Nikhil.length > 0 ? 1 : -4)),
        ),
        strategic_clarity: Math.max(28, Math.min(97, nikhilScore - 2)),
      },
    },
    {
      agent: "ananya",
      domain_title: "Resume Intelligence · Claims & Gap Audit",
      score: ananyaScore,
      verdict:
        ananyaScore >= 78
          ? "Claims Verified"
          : ananyaScore >= 64
            ? "Partial Proof"
            : "Needs Deeper Proof",
      summary: `Audited ${input.interview.candidate_name}'s spoken explanations against resume credentials across ${agentQAs.ananya.length} claim-verification turn(s).`,
      strengths: [
        agentQAs.ananya.length > 0
          ? "Supported resume claims with live spoken explanations"
          : "Baseline resume credentials captured in session profile",
        input.interview.resume_filename
          ? `Cross-checked discussion against ${input.interview.resume_filename}`
          : "Demonstrated direct project context",
      ],
      improvements: [
        "Quantify specific before/after metrics, throughput, and scale on key projects",
        "Proactively bridge skills adjacent to target JD gaps",
      ],
      question_reviews: agentQAs.ananya,
      metrics: {
        claim_verification: ananyaScore,
        quantified_impact: Math.max(25, Math.min(97, ananyaScore - 3)),
        resume_alignment: Math.max(28, Math.min(97, ananyaScore + 1)),
      },
    },
    {
      agent: "Daniel",
      domain_title:
        roundType === "HR Round"
          ? "Execution Lab · Delivery & Problem Solving"
          : "Technical Interview Lab · Architecture & Systems",
      score: danielScore,
      verdict:
        danielScore >= 80
          ? "Solid Execution"
          : danielScore >= 64
            ? "Needs Depth"
            : "Core Gaps Found",
      summary:
        roundType === "HR Round"
          ? `Assessed delivery habits, deadline prioritization, and stakeholder clarity across ${agentQAs.Daniel.length} execution turn(s).`
          : `Assessed system architecture intuition, bottleneck analysis, and trade-offs across ${agentQAs.Daniel.length} technical turn(s).`,
      strengths: [
        agentQAs.Daniel.length > 0
          ? `Responded across ${agentQAs.Daniel.length} structured problem-solving probe(s)`
          : "Session prepared for technical/execution benchmarking",
        "Focused on practical execution flow",
      ],
      improvements: [
        roundType === "HR Round"
          ? "Provide concrete project milestone examples when explaining prioritization"
          : "Detail failure modes, latency p99 targets, and distributed scaling bottlenecks",
        "Contrast alternative architectures explicitly before committing to one design",
      ],
      question_reviews: agentQAs.Daniel,
      metrics: {
        architecture_depth: danielScore,
        trade_off_rigor: Math.max(25, Math.min(97, danielScore - 2)),
        problem_solving: Math.max(28, Math.min(97, danielScore + 1)),
      },
    },
    {
      agent: "sarah",
      domain_title: "Behavioral Intelligence · Culture & Composure",
      score: sarahScore,
      verdict:
        sarahScore >= 78
          ? "Strong Composure & Fit"
          : sarahScore >= 64
            ? "Steady Delivery"
            : "Polish Presence",
      summary: `Combined verbal STAR ownership analysis across ${agentQAs.sarah.length} turn(s) with OpenCV tracking (${input.cvSummary.dominant_expression}, ${eye}% eye contact, ${composure}% composure).`,
      strengths: [
        `Recorded ${composure}% composure and ${eye}% eye contact under live questioning`,
        "Demonstrated constructive communication framing",
      ],
      improvements: [
        "Anchor behavioral stories in specific Action and quantified Result steps of STAR",
        "Close reflections with clear behavioral lessons applied afterward",
      ],
      question_reviews: agentQAs.sarah,
      metrics: { composure, eye_contact: eye, engagement, star_clarity: sarahRaw },
    },
    {
      agent: "Marcus",
      domain_title: "Hiring Readiness · Executive Bar Raiser Verdict",
      score: marcusScore,
      verdict: verdictFor(marcusScore),
      summary: `Synthesized overall ${roundType} readiness for ${input.interview.role} at ${input.interview.company_name} based on ${userMsgs.length} candidate answers and OpenCV telemetry.`,
      strengths: [
        `Completed ${userMsgs.length} panel exchange(s) across interview domains`,
        `Visual presence (${input.cvSummary.dominant_expression}, ${composure}% composure) tracked throughout session`,
      ],
      improvements: [
        "Lead with concise 15-second executive headlines before detailing deep mechanics",
        "Practice lowest-scoring agent domain drills before your next panel interview",
      ],
      question_reviews: agentQAs.Marcus,
      metrics: {
        hiring_bar_fit: marcusScore,
        communication_clarity: Math.round((marcusScore + engagement) / 2),
        leadership_signal: Math.max(28, Math.min(97, marcusScore - 1)),
      },
    },
  ];

  const overallScore = marcusScore;

  return {
    overall_score: overallScore,
    verdict: verdictFor(overallScore),
    summary: `${input.interview.candidate_name} completed this ${roundType} panel for ${input.interview.role} at ${input.interview.company_name} with ${userMsgs.length} spoken answer(s) scoring ${overallScore}/100 overall.`,
    breakdown: {
      technical: danielScore,
      problem_solving: Math.round((danielScore + marcusScore) / 2),
      communication: Math.round((nikhilScore + engagement) / 2),
      behavioral: sarahScore,
      system_design: Math.max(25, Math.min(97, danielScore - 2)),
    },
    cv_coaching_note: `OpenCV tracking across ${input.cvSummary.sample_count} samples recorded ${eye}% eye contact, ${composure}% composure, and ${input.cvSummary.dominant_expression} expression.`,
    panel_notes: agentReports.map((r) => ({
      agent: r.agent,
      title: r.domain_title,
      score: r.score,
      note: r.summary,
    })),
    roadmap: [
      {
        priority: "PRIORITY 01",
        title:
          roundType === "HR Round" ? "Strengthen STAR Impact" : "Deepen Architectural Trade-offs",
        detail:
          "Practice concise executive answers backed by measurable outcomes in the specialist lab.",
        target_section: roundType === "HR Round" ? "/behavioral" : "/technical",
      },
      {
        priority: "PRIORITY 02",
        title: "Tighten Resume Metrics",
        detail: "Quantify baseline vs. improved scale metrics cleanly in Ananya's Resume lab.",
        target_section: "/resume",
      },
      {
        priority: "PRIORITY 03",
        title: "Sharpen Company & Role Pitch",
        detail: `Align core stories tightly to ${input.interview.company_name} strategic priorities with Nikhil.`,
        target_section: "/career",
      },
    ],
    agent_reports: agentReports,
    model: "transcript-telemetry-engine",
  };
}

export async function generateFinalAssessmentReport(input: {
  interview: InterviewRecord;
  messages: MessageRecord[];
  cvSummary: CvAggregate;
}) {
  const fallback = buildFallbackReport(input);
  const transcriptText =
    input.messages.length > 0
      ? input.messages.map((m) => `${m.speaker}: ${m.content}`).join("\n")
      : "Brief introductory session.";
  const roundType = normalizeRoundType(input.interview.round_type, input.interview.approach);

  const prompt = `You are synthesizing the full 5-agent panel evaluation after a ${roundType} interview.
Analyze the ACTUAL candidate responses below and score EVERY agent and rubric metric strictly based on observed depth, accuracy, specificity, completion count (${input.messages.filter((m) => m.role === "user").length} candidate turns), and camera presence. Weak, evasive, or very short answers MUST receive proportionally low scores (28-58); strong, concrete, metric-rich answers earn 80-96.
Baseline signal calibration from transcript length & specificity: overall=${fallback.overall_score}, Nikhil=${fallback.agent_reports[0]?.score}, ananya=${fallback.agent_reports[1]?.score}, Daniel=${fallback.agent_reports[2]?.score}, sarah=${fallback.agent_reports[3]?.score}, Marcus=${fallback.agent_reports[4]?.score}. Adjust based on semantic quality of what the candidate said.

Return ONLY valid JSON matching this schema (replace every 0 placeholder with your calibrated score 25-98):
{
  "overall_score": 0,
  "verdict": "Strong Hire|Hire|Lean Hire|Needs Preparation",
  "summary": "3 sentence executive hiring debrief strictly grounded in candidate transcript and camera telemetry.",
  "breakdown": { "technical": 0, "problem_solving": 0, "communication": 0, "behavioral": 0, "system_design": 0 },
  "cv_coaching_note": "2 concise sentences interpreting eye contact, composure, and expression telemetry.",
  "roadmap": [
    { "priority": "PRIORITY 01", "title": "Short area title", "detail": "Concrete action plan", "target_section": "/technical" },
    { "priority": "PRIORITY 02", "title": "Short area title", "detail": "Concrete action plan", "target_section": "/resume" },
    { "priority": "PRIORITY 03", "title": "Short area title", "detail": "Concrete action plan", "target_section": "/behavioral" }
  ],
  "agent_reports": [
    {
      "agent": "Nikhil",
      "score": 0,
      "verdict": "Strong Role Fit|Developing Alignment|Role Gap",
      "summary": "2-3 sentence audit of how candidate answered Nikhil's JD & company fit questions.",
      "strengths": ["2 specific strengths observed in answers"],
      "improvements": ["2 concrete improvements"]
    },
    {
      "agent": "ananya",
      "score": 0,
      "verdict": "Claims Verified|Partial Proof|Needs Deeper Proof",
      "summary": "2-3 sentence audit of how candidate defended resume claims & impact.",
      "strengths": ["2 specific strengths"],
      "improvements": ["2 concrete resume/framing improvements"]
    },
    {
      "agent": "Daniel",
      "score": 0,
      "verdict": "Solid Execution|Needs Depth|Core Gaps Found",
      "summary": "2-3 sentence audit of technical/execution problem-solving during interview.",
      "strengths": ["2 specific strengths"],
      "improvements": ["2 concrete improvements"]
    },
    {
      "agent": "sarah",
      "score": 0,
      "verdict": "Strong Composure & Fit|Steady Delivery|Polish Presence",
      "summary": "2-3 sentence audit of STAR stories, teamwork, and OpenCV facial composure.",
      "strengths": ["2 specific strengths"],
      "improvements": ["2 behavioral improvements"]
    },
    {
      "agent": "Marcus",
      "score": 0,
      "verdict": "Strong Hire|Hire|Lean Hire|Needs Preparation",
      "summary": "2-3 sentence Bar Raiser hiring verdict referencing overall interview performance.",
      "strengths": ["2 decisive hiring signals"],
      "improvements": ["2 executive readiness gaps"]
    }
  ]
}

Candidate: ${input.interview.candidate_name}
Company & Role: ${input.interview.company_name} — ${input.interview.role} (${roundType}, ${input.interview.difficulty})
Job Description: ${input.interview.job_description?.slice(0, 700) || "Not provided"}
Resume Excerpt: ${input.interview.resume_text.slice(0, 1200) || "Not provided"}
OpenCV Telemetry: eye_contact=${input.cvSummary.avg_eye_contact.toFixed(0)}%, composure=${input.cvSummary.avg_composure.toFixed(0)}%, engagement=${input.cvSummary.avg_engagement.toFixed(0)}%, expression=${input.cvSummary.dominant_expression}

INTERVIEW TRANSCRIPT:
${transcriptText.slice(0, 7500)}`;

  try {
    const { data: parsed, model } = await callOpenRouterJson<{
      overall_score?: number;
      verdict?: string;
      summary?: string;
      breakdown?: Record<string, number>;
      cv_coaching_note?: string;
      roadmap?: Array<{ priority: string; title: string; detail: string; target_section: string }>;
      agent_reports?: Array<{
        agent?: string;
        score?: number;
        verdict?: string;
        summary?: string;
        strengths?: string[];
        improvements?: string[];
      }>;
    }>(
      [
        {
          role: "system",
          content:
            "You are the RoundTable Evaluation Panel. Ground every score and critique strictly in the actual interview transcript. Output valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      { temperature: 0.3, maxTokens: 2000, timeoutMs: 22000 },
    );

    const mergedAgentReports: GeneratedAgentDomainReport[] = fallback.agent_reports.map((fb) => {
      const llmItem = parsed.agent_reports?.find(
        (r) => r.agent?.toLowerCase() === fb.agent.toLowerCase(),
      );
      if (!llmItem) return fb;
      return {
        ...fb,
        score: Math.max(25, Math.min(99, Number(llmItem.score ?? fb.score))),
        verdict: llmItem.verdict || fb.verdict,
        summary: llmItem.summary || fb.summary,
        strengths:
          Array.isArray(llmItem.strengths) && llmItem.strengths.length > 0
            ? llmItem.strengths
            : fb.strengths,
        improvements:
          Array.isArray(llmItem.improvements) && llmItem.improvements.length > 0
            ? llmItem.improvements
            : fb.improvements,
      };
    });

    return {
      overall_score: Math.max(
        25,
        Math.min(99, Number(parsed.overall_score ?? fallback.overall_score)),
      ),
      verdict: parsed.verdict || fallback.verdict,
      summary: parsed.summary || fallback.summary,
      breakdown: {
        technical: Number(parsed.breakdown?.["technical"] ?? fallback.breakdown["technical"]),
        problem_solving: Number(
          parsed.breakdown?.["problem_solving"] ?? fallback.breakdown["problem_solving"],
        ),
        communication: Number(
          parsed.breakdown?.["communication"] ?? fallback.breakdown["communication"],
        ),
        behavioral: Number(parsed.breakdown?.["behavioral"] ?? fallback.breakdown["behavioral"]),
        system_design: Number(
          parsed.breakdown?.["system_design"] ?? fallback.breakdown["system_design"],
        ),
      },
      cv_coaching_note: parsed.cv_coaching_note || fallback.cv_coaching_note,
      panel_notes: mergedAgentReports.map((r) => ({
        agent: r.agent,
        title: r.domain_title,
        score: r.score,
        note: r.summary,
      })),
      roadmap:
        Array.isArray(parsed.roadmap) && parsed.roadmap.length > 0
          ? parsed.roadmap
          : fallback.roadmap,
      agent_reports: mergedAgentReports,
      model,
    };
  } catch (err) {
    console.warn(
      "[Assessment Report] Falling back to transcript-grounded evaluation:",
      err instanceof Error ? err.message : err,
    );
    return fallback;
  }
}
