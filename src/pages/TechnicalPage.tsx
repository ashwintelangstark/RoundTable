import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AgentDomainReportCard } from "@/components/AgentDomainReportCard";
import { useToast } from "@/components/ToastContext";
import { useSelectedInterviewReport } from "@/hooks/useSelectedInterviewReport";
import { api, kokoroPlayer } from "@/lib/api";

const DOMAINS = [
  "System Design",
  "AI Engineering",
  "Machine Learning",
  "Computer Vision",
  "Data Structures & Algorithms",
  "Python",
  "Robotics",
  "Full-Stack Architecture",
];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const FORMATS = ["System Design", "Conceptual", "Project Deep Dive", "Coding Discussion"];

export function TechnicalPage() {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const { interviews, selectedInterviewId, selectInterview, sessionData, loadingSession } =
    useSelectedInterviewReport();

  const [domain, setDomain] = useState("System Design");
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [format, setFormat] = useState("System Design");
  const [questionObj, setQuestionObj] = useState<{
    question: string;
    hints: string[];
    rubric: string[];
  } | null>(null);
  const [answer, setAnswer] = useState("");
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const iv = sessionData?.interview;
    if (!iv) return;
    setDifficulty(iv.difficulty || "Intermediate");
    const roleLower = iv.role.toLowerCase();
    if (roleLower.includes("vision")) setDomain("Computer Vision");
    else if (roleLower.includes("ai") || roleLower.includes("ml")) setDomain("AI Engineering");
    else setDomain("System Design");
  }, [sessionData?.interview]);

  const genMutation = useMutation({
    mutationFn: api.generateTechQuestion,
    onSuccess: (res) => {
      setQuestionObj(res.data as { question: string; hints: string[]; rubric: string[] });
      setAnswer("");
      evalMutation.reset();
      notify("Daniel prepared an adaptive technical challenge.");
    },
    onError: (err) => notify(err instanceof Error ? err.message : "Generation failed", "error"),
  });

  const evalMutation = useMutation({
    mutationFn: api.evaluateTechAnswer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practice-history", "Daniel"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      notify("Daniel evaluated your technical response.");
    },
    onError: (err) => notify(err instanceof Error ? err.message : "Evaluation failed", "error"),
  });

  async function speakText(text: string) {
    try {
      setSpeaking(true);
      await kokoroPlayer.speak(text, "Daniel", { onEnd: () => setSpeaking(false) });
    } catch {
      setSpeaking(false);
      notify("Voice audio is still loading.", "error");
    }
  }

  const evaluation = evalMutation.data?.evaluation;

  return (
    <div className="space-y-5">
      <AgentDomainReportCard
        agentKey="Daniel"
        agentLabel="AGENT 03 · DANIEL · TECHNICAL & SYSTEM DESIGN"
        heading="Technical Architecture & Problem-Solving Report"
        description="Inspect Daniel's assessment of your technical depth, systems trade-offs, failure modes, and debugging clarity during the interview."
        interviews={interviews}
        selectedInterviewId={selectedInterviewId}
        onSelectInterview={selectInterview}
        sessionData={sessionData}
        loading={loadingSession}
        onUseAnswerForPractice={(ans, q) => {
          setQuestionObj({
            question: q,
            hints: ["Reframe using explicit throughput/latency budgets and failure isolation."],
            rubric: ["Depth", "Trade-offs", "Edge Cases"],
          });
          setAnswer(ans);
          evalMutation.reset();
          notify("Loaded Q&A into Daniel's practice lab below.");
        }}
      />

      {/* Main Grid: Parameters & Question/Response Lab */}
      <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.35fr] gap-5 items-start">
        <section className="rt-card">
          <div className="flex items-center justify-between gap-2">
            <span className="rt-tag">AGENT 03 · DANIEL</span>
            <span className="text-[11px] text-[#697466]">Technical & System Design</span>
          </div>
          <h3 className="mt-3">Technical interview lab</h3>
          <p className="text-xs text-[#697466] mb-4">
            Build architectural depth and algorithmic clarity with adaptive practice.
          </p>

          <div className="rt-field">
            <label htmlFor="tech-domain">Domain</label>
            <select
              id="tech-domain"
              className="rt-control"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            >
              {DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="rt-field">
            <label htmlFor="tech-level">Difficulty</label>
            <select
              id="tech-level"
              className="rt-control"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div className="rt-field">
            <label htmlFor="tech-format">Practice format</label>
            <select
              id="tech-format"
              className="rt-control"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="rt-btn"
            disabled={genMutation.isPending}
            onClick={() => genMutation.mutate({ domain, difficulty, format })}
          >
            {genMutation.isPending ? "Generating prompt..." : "Start technical challenge ↗"}
          </button>
        </section>

        <section className="rt-card space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="m-0">Daniel asks</h3>
            {questionObj && (
              <button
                type="button"
                className="rt-btn secondary small"
                disabled={speaking}
                onClick={() => speakText(questionObj.question)}
              >
                <Volume2 size={13} aria-hidden="true" />
                {speaking ? "Speaking..." : "Hear Daniel"}
              </button>
            )}
          </div>

          <div className="rounded-xl bg-[#f4f6ed] p-4 text-sm leading-relaxed text-[#263328]">
            {questionObj
              ? questionObj.question
              : "Select an interview session above or click Start technical challenge to begin an adaptive drill."}
          </div>

          {questionObj?.hints && (
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-[#526e50]">
                Architecture considerations:
              </span>
              <ul className="text-xs text-[#52604f] pl-4 m-0 space-y-0.5">
                {questionObj.hints.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rt-field mb-0">
            <label htmlFor="tech-answer">Your technical solution & trade-offs</label>
            <textarea
              id="tech-answer"
              className="rt-control min-h-36"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Outline your architecture, components, data flows, failure modes, and performance trade-offs…"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              className="rt-btn"
              disabled={evalMutation.isPending || !questionObj || !answer.trim()}
              onClick={() =>
                questionObj &&
                evalMutation.mutate({
                  domain,
                  difficulty,
                  format,
                  question: questionObj.question,
                  answer,
                })
              }
            >
              {evalMutation.isPending ? "Evaluating with Daniel..." : "Submit to Daniel ↗"}
            </button>
          </div>

          {evaluation && (
            <div className="mt-4 pt-4 border-t border-[#e4e7da] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="m-0 text-sm font-semibold">Daniel’s Evaluation</h4>
                <div className="rt-scorecircle !h-12 !w-12 !text-base">{evaluation.score}</div>
              </div>

              <div className="rounded-xl bg-[#f4f6ed] p-3 text-xs leading-relaxed text-[#263328]">
                {evaluation.summary}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#e4e7da] p-3">
                  <h5 className="text-xs font-bold text-[#526e50] m-0 mb-1.5 flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    Architectural Strengths
                  </h5>
                  <ul className="text-xs text-[#354332] pl-4 m-0 space-y-1">
                    {evaluation.strengths?.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-[#e4e7da] p-3">
                  <h5 className="text-xs font-bold text-[#b45349] m-0 mb-1.5">
                    Blindspots & Scaling Limits
                  </h5>
                  <ul className="text-xs text-[#483735] pl-4 m-0 space-y-1">
                    {evaluation.gaps?.map((b: string, idx: number) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
