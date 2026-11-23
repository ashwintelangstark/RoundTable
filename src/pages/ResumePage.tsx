import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileCheck2, Sparkles, UploadCloud, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AgentDomainReportCard } from "@/components/AgentDomainReportCard";
import { useToast } from "@/components/ToastContext";
import { useSelectedInterviewReport } from "@/hooks/useSelectedInterviewReport";
import { api, kokoroPlayer } from "@/lib/api";

export function ResumePage() {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const { interviews, selectedInterviewId, selectInterview, sessionData, loadingSession } =
    useSelectedInterviewReport();

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [targetJd, setTargetJd] = useState("");
  const [dragging, setDragging] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const iv = sessionData?.interview;
    if (!iv) return;
    setResumeText(iv.resume_text);
    setTargetJd(iv.job_description);
  }, [sessionData?.interview]);

  const { data: historyData } = useQuery({
    queryKey: ["resume-history"],
    queryFn: api.resumeHistory,
  });

  const analyzeMutation = useMutation({
    mutationFn: (fd: FormData) => api.analyzeResume(fd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resume-history"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      notify("Ananya completed your resume audit.");
    },
    onError: (err) =>
      notify(err instanceof Error ? err.message : "Resume analysis failed", "error"),
  });

  const latestSaved = (() => {
    const first = historyData?.history?.[0];
    if (!first) return null;
    try {
      return {
        overall_score: first.overall_score,
        filename: first.filename,
        analysis: JSON.parse(first.analysis_json),
      };
    } catch {
      return null;
    }
  })();

  const activeResult = analyzeMutation.data ?? latestSaved;
  const subscores = activeResult?.analysis?.subscores;

  function handleAnalyze() {
    const fd = new FormData();
    if (resumeFile) fd.append("resume", resumeFile);
    if (resumeText.trim()) fd.append("resumeText", resumeText.trim());
    fd.append("targetJd", targetJd.trim());
    analyzeMutation.mutate(fd);
  }

  async function speakSummary() {
    if (!activeResult?.analysis) return;
    try {
      setSpeaking(true);
      await kokoroPlayer.speak(
        `Your resume scored ${activeResult.overall_score} out of 100. ${activeResult.analysis.executive_summary}`,
        "ananya",
        { onEnd: () => setSpeaking(false) },
      );
    } catch {
      setSpeaking(false);
      notify("Voice audio engine is still loading.", "error");
    }
  }

  return (
    <div className="space-y-5">
      <AgentDomainReportCard
        agentKey="ananya"
        agentLabel="AGENT 02 · ANANYA · RESUME & CLAIM ANALYST"
        heading="Interview Resume Audit & Claim Defensibility Report"
        description="Inspect how convincingly you defended your resume metrics, ownership depth, and career progression under Ananya's questioning."
        interviews={interviews}
        selectedInterviewId={selectedInterviewId}
        onSelectInterview={selectInterview}
        sessionData={sessionData}
        loading={loadingSession}
      />

      {/* Main Grid: Upload & Health Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-5 items-start">
        <section className="rt-card">
          <div className="flex items-center justify-between gap-2">
            <span className="rt-tag">AGENT 02 · ANANYA</span>
            <span className="text-[11px] text-[#697466]">Resume Gap & Strength Analyst</span>
          </div>
          <h3 className="mt-3">Audit & elevate your resume</h3>
          <p className="text-xs text-[#697466] mb-3">
            Drop a PDF, DOCX, or TXT resume—or paste resume bullets—and optionally add a target job
            description for ATS & impact coaching.
          </p>

          <div
            className={`rt-upload mb-3 ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) setResumeFile(file);
            }}
          >
            <UploadCloud size={22} className="mx-auto text-[#526e50] mb-1" aria-hidden="true" />
            <label
              htmlFor="ananya-resume-file"
              className="cursor-pointer font-semibold text-xs text-[#526e50] block"
            >
              Drop PDF / DOCX resume here or browse
            </label>
            <input
              id="ananya-resume-file"
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md"
              className="visually-hidden"
              onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-[11px] text-[#697466] m-0 mt-1">
              {resumeFile
                ? `Selected: ${resumeFile.name}`
                : "Real PDF/DOCX text extraction enabled"}
            </p>
          </div>

          <div className="rt-field">
            <label htmlFor="ananya-resume-paste">Or paste resume text / bullets</label>
            <textarea
              id="ananya-resume-paste"
              className="rt-control"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste experience bullets if you prefer quick iteration…"
            />
          </div>

          <div className="rt-field">
            <label htmlFor="ananya-target-jd">Target job description (optional)</label>
            <textarea
              id="ananya-target-jd"
              className="rt-control"
              value={targetJd}
              onChange={(e) => setTargetJd(e.target.value)}
              placeholder="Paste target role requirements for keyword & gap alignment…"
            />
          </div>

          <button
            type="button"
            className="rt-btn"
            disabled={analyzeMutation.isPending || (!resumeFile && !resumeText.trim())}
            onClick={handleAnalyze}
          >
            {analyzeMutation.isPending ? "Analyzing with Ananya..." : "Analyze resume ↗"}
          </button>
        </section>

        <section className="rt-card">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="m-0">Resume health</h3>
            {activeResult && (
              <button
                type="button"
                className="rt-btn secondary small"
                onClick={speakSummary}
                disabled={speaking}
              >
                <Volume2 size={13} aria-hidden="true" />
                {speaking ? "Speaking..." : "Hear Ananya"}
              </button>
            )}
          </div>

          {!activeResult ? (
            <p className="text-xs text-[#697466] py-8 text-center">
              Select an interview session above or upload a resume to see quantified impact, ATS
              signals, and actionable bullet improvements.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-[#f4f6ed]">
                <div className="rt-scorecircle shrink-0 !h-20 !w-20 !text-2xl">
                  {activeResult.overall_score}
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#263328]">
                    Overall Resume Strength
                  </div>
                  <p className="text-xs text-[#52604f] m-0 mt-0.5 leading-relaxed">
                    {activeResult.analysis?.executive_summary}
                  </p>
                </div>
              </div>

              {subscores && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#526e50] m-0">
                    Category Breakdown
                  </h4>
                  {Object.entries(subscores).map(([k, v]) => (
                    <div key={k}>
                      <div className="flex justify-between text-xs font-medium capitalize">
                        <span>{k}</span>
                        <span>{String(v)}/100</span>
                      </div>
                      <progress
                        className="rt-progress"
                        value={Number(v)}
                        max={100}
                        aria-label={`${k} score ${v} percent`}
                      />
                    </div>
                  ))}
                </div>
              )}

              {activeResult.analysis?.strengths && (
                <div className="rounded-xl border border-[#e4e7da] p-3">
                  <h4 className="text-xs font-bold text-[#526e50] m-0 mb-1.5 flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    Validated Strengths
                  </h4>
                  <ul className="text-xs text-[#354332] pl-4 m-0 space-y-1">
                    {activeResult.analysis.strengths.map(
                      (s: { title?: string; detail?: string } | string, idx: number) => (
                        <li key={idx}>{typeof s === "string" ? s : `${s.title}: ${s.detail}`}</li>
                      ),
                    )}
                  </ul>
                </div>
              )}

              {activeResult.analysis?.gaps && (
                <div className="rounded-xl border border-[#e4e7da] p-3">
                  <h4 className="text-xs font-bold text-[#b45349] m-0 mb-1.5">
                    Gaps & Areas to Strengthen
                  </h4>
                  <ul className="text-xs text-[#483735] pl-4 m-0 space-y-1">
                    {activeResult.analysis.gaps.map(
                      (
                        g: { title?: string; severity?: string; fix?: string } | string,
                        idx: number,
                      ) => (
                        <li key={idx}>
                          {typeof g === "string" ? g : `${g.title} (${g.severity}): ${g.fix}`}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
