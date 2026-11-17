import { CheckCircle2, FileText, Sparkles, Volume2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ToastContext";
import {
  kokoroPlayer,
  type AgentDomainReportRow,
  type InterviewMessage,
  type InterviewSession,
} from "@/lib/api";

interface ParsedReview {
  question: string;
  answer: string;
  feedback: string;
}

export interface AgentSessionPayload {
  interview: InterviewSession;
  messages: InterviewMessage[];
  agentReports?: AgentDomainReportRow[];
  cvSummary?: {
    sample_count: number;
    avg_eye_contact: number;
    avg_composure: number;
    avg_engagement: number;
    dominant_expression: string;
  };
}

interface AgentDomainReportCardProps {
  agentKey: "Nikhil" | "ananya" | "Daniel" | "sarah" | "Marcus";
  agentLabel: string;
  heading: string;
  description: string;
  interviews: InterviewSession[];
  selectedInterviewId: number | null;
  onSelectInterview: (id: number) => void;
  sessionData: AgentSessionPayload | null;
  loading?: boolean;
  hidePicker?: boolean;
  onUseAnswerForPractice?: (answer: string, question: string) => void;
}

function safeParseJson<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function AgentDomainReportCard({
  agentKey,
  agentLabel,
  heading,
  description,
  interviews,
  selectedInterviewId,
  onSelectInterview,
  sessionData,
  loading = false,
  hidePicker = false,
  onUseAnswerForPractice,
}: AgentDomainReportCardProps) {
  const { notify } = useToast();
  const [speaking, setSpeaking] = useState(false);

  const domainReport =
    sessionData?.agentReports?.find((r) => r.agent.toLowerCase() === agentKey.toLowerCase()) ??
    null;

  const strengths = safeParseJson<string[]>(domainReport?.strengths_json, []);
  const improvements = safeParseJson<string[]>(domainReport?.improvements_json, []);
  const reviews = safeParseJson<ParsedReview[]>(domainReport?.question_reviews_json, []);
  const metrics = safeParseJson<Record<string, number>>(domainReport?.metrics_json, {});

  const fallbackUserTurns = (sessionData?.messages ?? []).filter((m) => m.role === "user");

  async function speakDomainReport() {
    if (!domainReport) return;
    try {
      setSpeaking(true);
      await kokoroPlayer.speak(
        `${domainReport.domain_title}. Score ${domainReport.score} out of 100, verdict ${domainReport.verdict}. ${domainReport.summary}`,
        agentKey,
        { onEnd: () => setSpeaking(false) },
      );
    } catch {
      setSpeaking(false);
      notify("Voice audio engine is loading.", "error");
    }
  }

  return (
    <div className="space-y-4">
      {/* Interview Session Picker */}
      {!hidePicker && (
        <section className="rt-card !p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="rt-tag !text-[10px]">
                INTERVIEW PERFORMANCE REPORT · {agentLabel}
              </span>
              <h3 className="text-base font-semibold m-0 mt-1">{heading}</h3>
              <p className="text-xs text-[#697466] m-0">{description}</p>
            </div>

            <div className="w-full sm:w-80">
              <select
                aria-label={`Select interview for ${agentLabel} domain report`}
                className="rt-control !min-h-10 text-xs font-medium"
                value={selectedInterviewId ? String(selectedInterviewId) : ""}
                onChange={(e) => onSelectInterview(Number(e.target.value))}
              >
                <option value="">Choose an interview session…</option>
                {interviews.map((i) => (
                  <option key={i.id} value={String(i.id)}>
                    {i.company_name} — {i.role} ({i.round_type ?? "Technical Round"} · {i.status})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
      )}

      {loading && (
        <section className="rt-card !p-4 text-xs text-[#697466]">
          Loading {agentLabel}’s interview performance report…
        </section>
      )}

      {/* Domain Evaluation Breakdown */}
      {sessionData && domainReport && (
        <section className="rt-card !p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e4e7da]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rt-tag !text-[10px]">{domainReport.domain_title}</span>
                <span className="rt-tag !text-[10px] bg-[#edf2e6]">
                  {sessionData.interview.round_type ?? "Technical Round"}
                </span>
              </div>
              <h4 className="text-base font-semibold m-0 mt-1.5 text-[#263328]">
                {sessionData.interview.candidate_name} · {sessionData.interview.role} @{" "}
                {sessionData.interview.company_name}
              </h4>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                className="rt-btn secondary small"
                disabled={speaking}
                onClick={() => void speakDomainReport()}
              >
                <Volume2 size={13} aria-hidden="true" />
                {speaking ? "Speaking…" : `Hear ${agentLabel}`}
              </button>
              <div className="rt-scorecircle !h-14 !w-14 !text-lg shrink-0">
                <div>{domainReport.score}</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#f4f6ed] p-3.5 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#355234] flex items-center gap-1.5">
                <Sparkles size={13} /> {agentLabel}’s Evaluation Verdict: {domainReport.verdict}
              </span>
            </div>
            <p className="text-xs text-[#263328] m-0 leading-relaxed">{domainReport.summary}</p>
          </div>

          {Object.keys(metrics).length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.entries(metrics).map(([key, val]) => (
                <div key={key} className="rounded-xl bg-[#f7f9f2] border border-[#e3e8d8] p-3">
                  <div className="flex justify-between text-xs font-medium capitalize text-[#263328]">
                    <span>{key.replace(/_/g, " ")}</span>
                    <strong>{Math.round(Number(val))}%</strong>
                  </div>
                  <progress
                    className="rt-progress mt-1.5"
                    value={Math.max(0, Math.min(100, Number(val)))}
                    max={100}
                    aria-label={`${key} ${val} percent`}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#e4e7da] p-3">
              <h5 className="text-xs font-bold text-[#526e50] m-0 mb-2 flex items-center gap-1.5">
                <CheckCircle2 size={13} />
                Validated Strengths
              </h5>
              <ul className="text-xs text-[#354332] pl-4 m-0 space-y-1">
                {strengths.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-[#e4e7da] p-3">
              <h5 className="text-xs font-bold text-[#b45349] m-0 mb-2">Priority Improvements</h5>
              <ul className="text-xs text-[#483735] pl-4 m-0 space-y-1">
                {improvements.map((imp, idx) => (
                  <li key={idx}>{imp}</li>
                ))}
              </ul>
            </div>
          </div>

          {(reviews.length > 0 || fallbackUserTurns.length > 0) && (
            <div className="pt-1">
              <div className="text-xs font-semibold text-[#263328] mb-2 flex items-center gap-1.5">
                <FileText size={14} className="text-[#526e50]" />
                {reviews.length > 0
                  ? `${agentLabel}’s Question & Answer Review (${reviews.length} turns)`
                  : `Candidate Interview Statements (${fallbackUserTurns.length} turns)`}
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {reviews.length > 0
                  ? reviews.map((rev, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-[#f7f9f2] border border-[#e2e7d7] text-xs space-y-1"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-[#263328]">
                            Q{idx + 1}: {rev.question}
                          </div>
                          {onUseAnswerForPractice && (
                            <button
                              type="button"
                              className="text-[11px] font-medium text-[#435e40] hover:underline shrink-0 bg-transparent border-0 p-0"
                              onClick={() => onUseAnswerForPractice(rev.answer, rev.question)}
                            >
                              Practice in Lab ↗
                            </button>
                          )}
                        </div>
                        <div className="text-[#354332] italic">Your Answer: “{rev.answer}”</div>
                        <div className="text-[11px] text-[#526e50] font-medium">
                          {agentLabel} Note: {rev.feedback}
                        </div>
                      </div>
                    ))
                  : fallbackUserTurns.map((t, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-[#f7f9f2] border border-[#e2e7d7] text-xs leading-relaxed"
                      >
                        <div className="text-[10px] text-[#526e50] font-bold mb-0.5">
                          Response #{idx + 1} ({t.phase})
                        </div>
                        <div className="text-[#263328]">{t.content}</div>
                      </div>
                    ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Pending Interview Fallback Info */}
      {sessionData && !domainReport && !loading && (
        <section className="rt-card !p-4 text-xs text-[#697466]">
          <strong className="text-[#263328] block mb-1">
            {sessionData.interview.company_name} — {sessionData.interview.role} (
            {sessionData.interview.status})
          </strong>
          {fallbackUserTurns.length > 0
            ? `${fallbackUserTurns.length} candidate answers recorded so far. Complete the interview and click End & Report for ${agentLabel} to publish your scored domain audit here.`
            : "Enter the 3D Interview Room and complete this session for all five agents to generate domain-specific reports automatically."}
        </section>
      )}
    </div>
  );
}
