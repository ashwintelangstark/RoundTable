import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AgentDomainReportCard } from "@/components/AgentDomainReportCard";
import { useToast } from "@/components/ToastContext";
import { useSelectedInterviewReport } from "@/hooks/useSelectedInterviewReport";
import { api, kokoroPlayer } from "@/lib/api";

export function CareerPage() {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const { interviews, selectedInterviewId, selectInterview, sessionData, loadingSession } =
    useSelectedInterviewReport();

  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState("");
  const [companyDesc, setCompanyDesc] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const iv = sessionData?.interview;
    if (!iv) return;
    setCompanyName(iv.company_name);
    setRole(iv.role);
    setCompanyDesc(iv.company_desc);
    setJobDescription(iv.job_description);
  }, [sessionData?.interview]);

  const { data: historyData } = useQuery({
    queryKey: ["career-history"],
    queryFn: api.careerHistory,
  });

  const analyzeMutation = useMutation({
    mutationFn: api.analyzeCareer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["career-history"] });
      notify("Nikhil decoded the role & company strategy.");
    },
    onError: (err) => notify(err instanceof Error ? err.message : "Analysis failed", "error"),
  });

  const result = analyzeMutation.data?.analysis;
  const latestSaved = (() => {
    const raw = historyData?.history?.[0]?.analysis_json;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as NonNullable<typeof result>;
    } catch {
      return null;
    }
  })();
  const activeAnalysis = result ?? latestSaved;

  async function speakSummary() {
    if (!activeAnalysis) return;
    try {
      setSpeaking(true);
      await kokoroPlayer.speak(
        `${activeAnalysis.summary ?? ""} Focus your preparation on: ${(activeAnalysis.prep_strategy ?? []).slice(0, 2).join(" ")}`,
        "Nikhil",
        { onEnd: () => setSpeaking(false) },
      );
    } catch {
      setSpeaking(false);
      notify("Voice audio is still loading.", "error");
    }
  }

  return (
    <div className="space-y-5">
      <AgentDomainReportCard
        agentKey="Nikhil"
        agentLabel="AGENT 01 · NIKHIL · JD & COMPANY DECODER"
        heading="Interview Role & Company Performance Report"
        description="Inspect Nikhil's post-interview evaluation of how accurately you aligned with the company domain, role expectations, and JD signals."
        interviews={interviews}
        selectedInterviewId={selectedInterviewId}
        onSelectInterview={selectInterview}
        sessionData={sessionData}
        loading={loadingSession}
      />

      {/* Main Grid: Decoder Form & Role Readiness Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1.25fr] gap-5 items-start">
        <section className="rt-card">
          <div className="flex items-center justify-between gap-2">
            <span className="rt-tag">AGENT 01 · NIKHIL</span>
            <span className="text-[11px] text-[#697466]">JD & Company Decoder</span>
          </div>
          <h3 className="mt-3">Role Expectations Decoder</h3>
          <p className="text-xs text-[#697466] mb-3">
            Inspect the underlying job requirements and evaluate how well your responses measure up.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rt-field mb-0">
              <label htmlFor="career-company">Company name</label>
              <input
                id="career-company"
                className="rt-control"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. NVIDIA"
              />
            </div>
            <div className="rt-field mb-0">
              <label htmlFor="career-role">Target role</label>
              <input
                id="career-role"
                className="rt-control"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Senior AI Engineer"
              />
            </div>
          </div>

          <div className="rt-field mt-3">
            <label htmlFor="career-context">Company products / domain context</label>
            <textarea
              id="career-context"
              className="rt-control"
              value={companyDesc}
              onChange={(e) => setCompanyDesc(e.target.value)}
              placeholder="Core products, business model, technical stack…"
            />
          </div>

          <div className="rt-field">
            <label htmlFor="career-jd">Target job description</label>
            <textarea
              id="career-jd"
              className="rt-control min-h-32"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here…"
            />
          </div>

          <button
            type="button"
            className="rt-btn"
            disabled={analyzeMutation.isPending || (!jobDescription.trim() && !role.trim())}
            onClick={() =>
              analyzeMutation.mutate({
                companyName,
                role,
                companyDesc,
                jobDescription,
              })
            }
          >
            {analyzeMutation.isPending ? "Decoding with Nikhil..." : "Decode requirements ↗"}
          </button>
        </section>

        <section className="rt-card">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="m-0">Role readiness matrix</h3>
            {activeAnalysis && (
              <button
                type="button"
                className="rt-btn secondary small"
                onClick={speakSummary}
                disabled={speaking}
              >
                <Volume2 size={13} aria-hidden="true" />
                {speaking ? "Speaking..." : "Hear Nikhil"}
              </button>
            )}
          </div>

          {!activeAnalysis ? (
            <p className="text-xs text-[#697466] py-8 text-center">
              Select an interview session above or run Nikhil’s decoder to see weighted
              competencies, company signals, and hidden expectations.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-[#f4f6ed] p-3.5 text-xs leading-relaxed text-[#263328]">
                {activeAnalysis.summary}
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#526e50] mb-2">
                  Weighted Competencies
                </h4>
                {activeAnalysis.competencies?.map((comp) => (
                  <div key={comp.name} className="mb-2.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{comp.name}</span>
                      <span>{comp.weight}%</span>
                    </div>
                    <progress
                      className="rt-progress"
                      value={comp.weight}
                      max={100}
                      aria-label={`${comp.name} importance ${comp.weight} percent`}
                    />
                    <p className="text-[11px] text-[#697466] m-0 -mt-1">{comp.expectation}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#e4e7da] p-3">
                  <h4 className="text-xs font-bold text-[#263328] m-0 mb-2">Company Signals</h4>
                  <ul className="text-xs text-[#52604f] pl-4 m-0 space-y-1">
                    {activeAnalysis.company_signals?.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-[#e4e7da] p-3">
                  <h4 className="text-xs font-bold text-[#263328] m-0 mb-2">Hidden Expectations</h4>
                  <ul className="text-xs text-[#52604f] pl-4 m-0 space-y-1">
                    {activeAnalysis.hidden_expectations?.map((h, idx) => (
                      <li key={idx}>{h}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-xl bg-[#e5e8ce]/65 p-3.5">
                <h4 className="text-xs font-bold text-[#263328] m-0 mb-2">
                  High-Leverage Prep Strategy
                </h4>
                <ul className="text-xs text-[#263328] pl-4 m-0 space-y-1">
                  {activeAnalysis.prep_strategy?.map((p, idx) => (
                    <li key={idx}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
