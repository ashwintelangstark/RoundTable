import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Video, Volume2 } from "lucide-react";
import { useState } from "react";
import { AgentDomainReportCard } from "@/components/AgentDomainReportCard";
import { useToast } from "@/components/ToastContext";
import { useSelectedInterviewReport } from "@/hooks/useSelectedInterviewReport";
import { api, kokoroPlayer } from "@/lib/api";

const CATEGORIES = [
  "Ownership & Accountability",
  "Teamwork & Conflict Resolution",
  "Leadership & Influence",
  "Failure, Resilience & Learning",
  "Navigating Ambiguity",
  "Executive Communication",
  "High-Stakes Trade-offs",
];

export function BehavioralPage() {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const { interviews, selectedInterviewId, selectInterview, sessionData, loadingSession } =
    useSelectedInterviewReport();

  const [category, setCategory] = useState("Ownership & Accountability");
  const [promptData, setPromptData] = useState<{
    question: string;
    signal_sought: string;
    star_tip: string;
  } | null>(null);
  const [answer, setAnswer] = useState("");
  const [speaking, setSpeaking] = useState(false);

  const { data: historyData } = useQuery({
    queryKey: ["practice-history", "sarah"],
    queryFn: () => api.practiceHistory("sarah"),
  });

  const genMutation = useMutation({
    mutationFn: api.generateBehavioralQuestion,
    onSuccess: (res) => {
      setPromptData(res.data as { question: string; signal_sought: string; star_tip: string });
      setAnswer("");
      evalMutation.reset();
      notify("Sarah prepared a targeted behavioral scenario.");
    },
    onError: (err) => notify(err instanceof Error ? err.message : "Failed to load prompt", "error"),
  });

  const evalMutation = useMutation({
    mutationFn: api.evaluateBehavioralAnswer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practice-history", "sarah"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      notify("Sarah reviewed your STAR response.");
    },
    onError: (err) => notify(err instanceof Error ? err.message : "Evaluation failed", "error"),
  });

  async function speakText(text: string) {
    try {
      setSpeaking(true);
      await kokoroPlayer.speak(text, "sarah", { onEnd: () => setSpeaking(false) });
    } catch {
      setSpeaking(false);
      notify("Voice audio engine is still loading.", "error");
    }
  }

  const evaluation = evalMutation.data?.evaluation;
  const cvSummary = sessionData?.cvSummary;

  return (
    <div className="space-y-5">
      <AgentDomainReportCard
        agentKey="sarah"
        agentLabel="AGENT 04 · SARAH · BEHAVIORAL & CULTURE FIT"
        heading="Behavioral Storytelling & Leadership Presence Report"
        description="Inspect Sarah's evaluation of your STAR structure, conflict resolution, ownership under ambiguity, and interview composure."
        interviews={interviews}
        selectedInterviewId={selectedInterviewId}
        onSelectInterview={selectInterview}
        sessionData={sessionData}
        loading={loadingSession}
        onUseAnswerForPractice={(ans, q) => {
          setPromptData({
            question: q,
            signal_sought: "Authentic STAR ownership, measurable impact, and reflective learning.",
            star_tip: "Keep Situation concise (~20%) and emphasize personal decisions in Action.",
          });
          setAnswer(ans);
          evalMutation.reset();
          notify("Loaded Q&A into Sarah's STAR coach below.");
        }}
      />

      {sessionData && (cvSummary || sessionData.interview.recording_url) && (
        <section className="rt-card !p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <span className="rt-tag !text-[10px]">OPENCV NON-VERBAL TELEMETRY</span>
            {sessionData.interview.recording_url && (
              <span className="inline-flex items-center gap-1 text-xs text-[#435e40] font-semibold">
                <Video size={13} aria-hidden="true" /> Stored Video Recording Available
              </span>
            )}
          </div>
          {cvSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-xl bg-[#f4f7ed] p-3 border border-[#dfe8d4]">
                <div className="text-[10px] text-[#697466] uppercase font-semibold">Composure</div>
                <div className="font-serif-display text-xl font-semibold text-[#3b5938] mt-1">
                  {cvSummary.avg_composure}%
                </div>
              </div>
              <div className="rounded-xl bg-[#f4f7ed] p-3 border border-[#dfe8d4]">
                <div className="text-[10px] text-[#697466] uppercase font-semibold">
                  Eye Contact
                </div>
                <div className="font-serif-display text-xl font-semibold text-[#3b5938] mt-1">
                  {cvSummary.avg_eye_contact}%
                </div>
              </div>
              <div className="rounded-xl bg-[#f4f7ed] p-3 border border-[#dfe8d4]">
                <div className="text-[10px] text-[#697466] uppercase font-semibold">Engagement</div>
                <div className="font-serif-display text-xl font-semibold text-[#3b5938] mt-1">
                  {cvSummary.avg_engagement}%
                </div>
              </div>
              <div className="rounded-xl bg-[#f4f7ed] p-3 border border-[#dfe8d4]">
                <div className="text-[10px] text-[#697466] uppercase font-semibold">
                  Dominant Tone
                </div>
                <div className="font-serif-display text-xl font-semibold text-[#3b5938] mt-1 capitalize">
                  {cvSummary.dominant_expression || "Composed"}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Sarah's Interactive Behavioral Practice & STAR Review */}
      <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.4fr] gap-5 items-start">
        <section className="rt-card">
          <div className="flex items-center justify-between gap-2">
            <span className="rt-tag">AGENT 04 · SARAH</span>
            <span className="text-[11px] text-[#697466]">Behavioral & Culture Fit</span>
          </div>
          <h3 className="mt-3">Behavioral Intelligence</h3>
          <p className="text-xs text-[#697466] mb-4">
            Refine executive presence, ownership clarity, and authentic STAR storytelling.
          </p>

          <div className="rt-field">
            <label htmlFor="beh-category">Scenario category</label>
            <select
              id="beh-category"
              className="rt-control"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="rt-btn"
            disabled={genMutation.isPending}
            onClick={() => genMutation.mutate({ category })}
          >
            {genMutation.isPending ? "Preparing scenario..." : "Ask Sarah ↗"}
          </button>

          {promptData && (
            <div className="mt-4 rounded-xl bg-[#f4f6ed] p-3.5 text-xs space-y-1.5 border border-[#e1ebd4]">
              <div>
                <strong>Signal sought:</strong> {promptData.signal_sought}
              </div>
              <div className="text-[#435e40]">
                <strong>Coaching tip:</strong> {promptData.star_tip}
              </div>
            </div>
          )}
        </section>

        <section className="rt-card space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="m-0">Sarah asks</h3>
            {promptData && (
              <button
                type="button"
                className="rt-btn secondary small"
                disabled={speaking}
                onClick={() => speakText(promptData.question)}
              >
                <Volume2 size={13} aria-hidden="true" />
                {speaking ? "Speaking..." : "Hear Sarah"}
              </button>
            )}
          </div>

          <div className="rounded-xl bg-[#f4f6ed] p-4 text-sm leading-relaxed border border-[#e1ebd4]">
            {promptData
              ? promptData.question
              : "Select an interview session above or pick a scenario category and click Ask Sarah to begin a coaching rep."}
          </div>

          <div className="rt-field mb-0">
            <label htmlFor="beh-answer">Your STAR response</label>
            <textarea
              id="beh-answer"
              className="rt-control min-h-32"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Situation · Task · Action (specifically what YOU did) · Quantified Result…"
            />
          </div>

          <button
            type="button"
            className="rt-btn"
            disabled={!promptData || !answer.trim() || evalMutation.isPending}
            onClick={() =>
              evalMutation.mutate({
                category,
                question: promptData!.question,
                answer,
              })
            }
          >
            {evalMutation.isPending ? "Reviewing with Sarah..." : "Review STAR response ↗"}
          </button>

          {evaluation && (
            <div className="rounded-2xl border border-[#d3d9c4] p-4 space-y-3 bg-[#fffef8]">
              <div className="flex items-center justify-between gap-2">
                <span className="rt-tag">STAR Readiness: {evaluation.score}/100</span>
                <button
                  type="button"
                  className="rt-btn secondary small"
                  disabled={speaking}
                  onClick={() => speakText(evaluation.coaching_feedback)}
                >
                  <Volume2 size={12} aria-hidden="true" />
                  Hear Sarah’s coaching
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {(
                  [
                    ["Situation", evaluation.star_scores?.situation ?? evaluation.score],
                    ["Task", evaluation.star_scores?.task ?? evaluation.score],
                    ["Action", evaluation.star_scores?.action ?? evaluation.score],
                    ["Result", evaluation.star_scores?.result ?? evaluation.score],
                  ] as const
                ).map(([lbl, val]) => (
                  <div key={lbl} className="rounded-xl bg-[#f4f6ed] p-2.5 text-center">
                    <div className="text-[10px] text-[#697466] uppercase">{lbl}</div>
                    <div className="font-serif-display text-xl font-semibold text-[#435e40]">
                      {val}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-[#263328] m-0">{evaluation.coaching_feedback}</p>

              <div className="rounded-xl bg-[#e5e8ce]/65 p-3 text-xs">
                <strong className="block mb-1">Elevated STAR Polish</strong>
                {evaluation.polished_star_example}
              </div>
            </div>
          )}
        </section>
      </div>

      {(historyData?.history?.length ?? 0) > 0 && (
        <section className="rt-card">
          <h3>Recent behavioral reps</h3>
          <div className="divide-y divide-[#edf0e6]">
            {historyData?.history.slice(0, 5).map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold">{item.category}</div>
                  <div className="text-[#697466] truncate">{item.question}</div>
                </div>
                <span className="rt-tag shrink-0">{item.score}/100</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
