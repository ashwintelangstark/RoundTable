import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Download, Eye, Video, Volume2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { AgentDomainReportCard } from "@/components/AgentDomainReportCard";
import { useToast } from "@/components/ToastContext";
import { api, kokoroPlayer } from "@/lib/api";

const AGENT_ROUTE_MAP: Record<string, string> = {
  nikhil: "/career",
  ananya: "/resume",
  daniel: "/technical",
  sarah: "/behavioral",
  marcus: "/readiness",
};

export function ReadinessPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedRecordingId, setSelectedRecordingId] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const { data: reportsData } = useQuery({
    queryKey: ["reports"],
    queryFn: api.listReports,
  });

  const { data: interviewsData } = useQuery({
    queryKey: ["interviews"],
    queryFn: api.listInterviews,
  });

  const reports = useMemo(() => reportsData?.reports ?? [], [reportsData]);
  const interviews = useMemo(() => interviewsData?.interviews ?? [], [interviewsData]);
  const requestedId = Number(searchParams.get("interviewId"));

  useEffect(() => {
    if (
      requestedId &&
      (reports.some((r) => r.interview_id === requestedId) ||
        interviews.some((i) => i.id === requestedId))
    ) {
      setSelectedId(requestedId);
    } else if (!selectedId) {
      if (reports[0]) {
        setSelectedId(reports[0].interview_id);
      } else if (interviews[0]) {
        setSelectedId(interviews[0].id);
      }
    }
  }, [reports, interviews, requestedId, selectedId]);

  const active = useMemo(
    () =>
      selectedId !== null
        ? (reports.find((r) => r.interview_id === selectedId) ?? null)
        : (reports[0] ?? null),
    [reports, selectedId],
  );
  const selectedInterview = useMemo(
    () => interviews.find((i) => i.id === selectedId) ?? null,
    [interviews, selectedId],
  );

  const generateReportMutation = useMutation({
    mutationFn: (id: number) => api.completeInterview(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
      queryClient.invalidateQueries({ queryKey: ["interview", res.report.interview_id] });
      queryClient.invalidateQueries({ queryKey: ["interview-detail", res.report.interview_id] });
      queryClient.invalidateQueries({ queryKey: ["agent-report"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      notify("Compiled dynamic assessment report from interview transcript.");
    },
    onError: (err) =>
      notify(err instanceof Error ? err.message : "Could not generate report", "error"),
  });

  function handleSelectInterview(id: number) {
    setSelectedId(id);
    if (id) {
      setSearchParams({ interviewId: String(id) });
    } else {
      setSearchParams({});
    }
  }

  const { data: activeSessionData, isLoading: loadingMarcusDomain } = useQuery({
    queryKey: ["interview", active?.interview_id],
    queryFn: () => api.getInterview(active!.interview_id),
    enabled: Boolean(active?.interview_id),
  });

  const clips = useMemo(() => {
    const list =
      (activeSessionData?.recordings && activeSessionData.recordings.length > 0
        ? activeSessionData.recordings
        : active?.recordings) ?? [];
    if (list.length > 0) return list;
    if (active?.recording_url) {
      return [
        {
          id: 0,
          interview_id: active.interview_id,
          attempt_number: 1,
          round_type: active.round_type ?? "Technical Round",
          approach: active.approach ?? "Standard Panel",
          recording_url: active.recording_url,
          file_size: 0,
          duration_seconds: 0,
          created_at: active.created_at,
        },
      ];
    }
    return [];
  }, [activeSessionData?.recordings, active]);

  useEffect(() => {
    if (clips.length === 0) {
      setSelectedRecordingId(null);
      return;
    }
    const stillExists = clips.some((c) => c.id === selectedRecordingId);
    if (!stillExists) {
      setSelectedRecordingId(clips[clips.length - 1]!.id);
    }
  }, [clips, selectedRecordingId]);

  const activeClip =
    clips.find((c) => c.id === selectedRecordingId) ?? clips[clips.length - 1] ?? null;

  const breakdown = active ? (JSON.parse(active.breakdown_json) as Record<string, number>) : null;
  const cvSummary = active
    ? (JSON.parse(active.cv_summary_json) as {
        avg_eye_contact: number;
        avg_composure: number;
        avg_engagement: number;
        dominant_expression: string;
        sample_count?: number;
        coaching_note: string;
      })
    : null;
  const panelNotes = active
    ? (JSON.parse(active.panel_notes_json) as Array<{
        agent: string;
        title: string;
        score: number;
        note: string;
      }>)
    : [];
  const roadmap = active
    ? (JSON.parse(active.roadmap_json) as Array<{
        priority: string;
        title: string;
        detail: string;
        target_section: string;
      }>)
    : [];

  const radarData = breakdown
    ? [
        { metric: "Technical", value: breakdown["technical"] ?? 0 },
        { metric: "Problem Solving", value: breakdown["problem_solving"] ?? 0 },
        { metric: "Communication", value: breakdown["communication"] ?? 0 },
        { metric: "Behavioral", value: breakdown["behavioral"] ?? 0 },
        { metric: "System Design", value: breakdown["system_design"] ?? 0 },
      ]
    : [];

  function exportReport() {
    if (!active) return;
    const markdown = [
      `# RoundTable Assessment Report — ${active.candidate_name}`,
      `**Company:** ${active.company_name} | **Role:** ${active.role} | **Round:** ${active.round_type ?? "Technical Round"}`,
      `**Approach:** ${active.approach} | **Score:** ${active.overall_score}/100 | **Verdict:** ${active.verdict}`,
      "",
      `## Executive Summary`,
      active.summary,
      "",
      `## Candidate Behavioral & Expression Telemetry`,
      `- Dominant Expression: ${cvSummary?.dominant_expression}`,
      `- Eye Contact: ${cvSummary?.avg_eye_contact}% | Composure: ${cvSummary?.avg_composure}% | Engagement: ${cvSummary?.avg_engagement}%`,
      `- Coaching Note: ${cvSummary?.coaching_note}`,
      "",
      `## Panel Feedback`,
      ...panelNotes.map((n) => `- **${n.agent}** (${n.title}) [${n.score}/100]: ${n.note}`),
      "",
      `## Improvement Roadmap`,
      ...roadmap.map((r) => `- **${r.priority} — ${r.title}**: ${r.detail}`),
    ].join("\n");

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RoundTable-Report-${active.company_name}-${active.role}.md`.replace(/\s+/g, "-");
    a.click();
    URL.revokeObjectURL(url);
    notify("Assessment report exported.");
  }

  async function speakVerdict() {
    if (!active) return;
    try {
      setSpeaking(true);
      await kokoroPlayer.speak(
        `Assessment complete for ${active.role} at ${active.company_name}. Overall score ${active.overall_score} out of 100. Verdict: ${active.verdict}. ${active.summary}`,
        "Marcus",
        { onEnd: () => setSpeaking(false) },
      );
    } catch {
      setSpeaking(false);
      notify("Voice audio engine is still loading.", "error");
    }
  }

  if (reports.length === 0 && interviews.length === 0) {
    return (
      <div className="rt-card text-center py-12">
        <h3>No completed assessment reports yet</h3>
        <p className="text-xs text-[#697466] max-w-md mx-auto mb-5">
          Enter the 3D Interview Room, click the table to configure your candidate brief, and
          complete a session for Marcus to compile your full panel report.
        </p>
        <Link to="/room" className="rt-btn">
          Enter 3D Interview Room →
        </Link>
      </div>
    );
  }

  const dropdownItems =
    interviews.length > 0
      ? interviews.map((i) => {
          const rep = reports.find((r) => r.interview_id === i.id);
          return {
            id: i.id,
            label: rep
              ? `${i.company_name} · ${i.role} (${i.round_type ?? "Technical Round"} · ${rep.overall_score}/100)`
              : `${i.company_name} · ${i.role} (${i.round_type ?? "Technical Round"} · ${i.status})`,
          };
        })
      : reports.map((r) => ({
          id: r.interview_id,
          label: `${r.company_name} · ${r.role} (${r.round_type ?? "Technical Round"} · ${r.overall_score}/100)`,
        }));

  if (!active) {
    return (
      <div className="space-y-5">
        <div className="rt-card flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="rt-tag">AGENT 05 · MARCUS · HIRING BAR RAISER</span>
            <h3 className="mt-2 mb-0">
              {selectedInterview
                ? `${selectedInterview.role} — ${selectedInterview.company_name}`
                : "Select an interview report"}
            </h3>
            <div className="text-xs text-[#697466]">
              {selectedInterview
                ? `${selectedInterview.candidate_name} · ${selectedInterview.round_type ?? "Technical Round"} · Status: ${selectedInterview.status}`
                : "Choose an interview session to view Marcus’s hiring readiness report."}
            </div>
          </div>

          <div className="w-full sm:w-80">
            <select
              aria-label="Select interview report"
              className="rt-control !min-h-10 text-xs font-medium"
              value={String(selectedId ?? dropdownItems[0]?.id ?? "")}
              onChange={(e) => handleSelectInterview(Number(e.target.value))}
            >
              {dropdownItems.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rt-card text-center py-10 space-y-3">
          <h4 className="m-0">No compiled report for this interview yet</h4>
          <p className="text-xs text-[#697466] max-w-md mx-auto">
            Finish speaking with the 5-agent panel in the 3D Interview Room, or generate an
            assessment now from any responses recorded so far.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {selectedId && (
              <button
                type="button"
                className="rt-btn secondary small"
                disabled={generateReportMutation.isPending}
                onClick={() => generateReportMutation.mutate(selectedId)}
              >
                {generateReportMutation.isPending
                  ? "Compiling Assessment..."
                  : "Generate Assessment Report Now"}
              </button>
            )}
            <Link
              to={selectedId ? `/room?session=${selectedId}` : "/room"}
              className="rt-btn small"
            >
              Enter 3D Interview Room →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rt-card flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="rt-tag">AGENT 05 · MARCUS · HIRING BAR RAISER</span>
          <h3 className="mt-2 mb-0">
            {active.role} — {active.company_name}
          </h3>
          <div className="text-xs text-[#697466]">
            Candidate: {active.candidate_name} · {active.round_type ?? "Technical Round"} ·{" "}
            {active.approach} · {active.duration_minutes} min
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Select interview report"
            className="rt-control !w-auto min-w-[230px] !min-h-9 text-xs font-medium"
            value={String(active.interview_id)}
            onChange={(e) => handleSelectInterview(Number(e.target.value))}
          >
            {dropdownItems.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rt-btn secondary small"
            disabled={speaking}
            onClick={speakVerdict}
          >
            <Volume2 size={13} aria-hidden="true" />
            {speaking ? "Speaking..." : "Hear Marcus"}
          </button>
          <button type="button" className="rt-btn small" onClick={exportReport}>
            <Download size={13} aria-hidden="true" />
            Export report
          </button>
        </div>
      </div>

      {clips.length > 0 && activeClip && (
        <section className="rt-card !p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#263328]">
            <span className="flex items-center gap-2">
              <Video size={16} className="text-[#526e50]" />
              Interview Video Recording &amp; Playback
            </span>
            <div className="flex items-center gap-2">
              <span className="rt-tag">
                {clips.length} {clips.length === 1 ? "Session Clip" : "Attempt Clips Recorded"}
              </span>
              <a
                href={activeClip.recording_url}
                download={`RoundTable-Attempt-${activeClip.attempt_number}.webm`}
                className="rt-btn secondary small !py-1 !px-2.5 text-[11px]"
              >
                <Download size={12} aria-hidden="true" />
                Save Clip
              </a>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden bg-black aspect-video max-h-96 flex items-center justify-center border border-[#d3d9c4]">
            <video
              key={activeClip.recording_url}
              src={activeClip.recording_url}
              controls
              playsInline
              preload="metadata"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#697466]">
            <span>
              Viewing <strong>Attempt #{activeClip.attempt_number}</strong> ·{" "}
              {activeClip.round_type} ({activeClip.approach})
              {activeClip.duration_seconds > 0 ? ` · ${activeClip.duration_seconds}s` : ""}
              {activeClip.file_size > 0
                ? ` · ${(activeClip.file_size / (1024 * 1024)).toFixed(2)} MB`
                : ""}
            </span>
            <span>{activeClip.created_at}</span>
          </div>

          {clips.length > 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
              {clips.map((clip, idx) => {
                const isSelected = clip.id === activeClip.id;
                return (
                  <button
                    key={`${clip.id}-${clip.recording_url}`}
                    type="button"
                    onClick={() => setSelectedRecordingId(clip.id)}
                    className={`text-left rounded-xl p-2.5 border transition-all text-xs ${
                      isSelected
                        ? "bg-[#233a24] text-white border-[#233a24] shadow-sm"
                        : "bg-[#f4f6ed] text-[#263328] border-[#dbe2d1] hover:bg-[#e8eee0]"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>Attempt #{clip.attempt_number || idx + 1}</span>
                      <span
                        className={`text-[10px] ${isSelected ? "text-[#cfe2cc]" : "text-[#526e50]"}`}
                      >
                        {clip.round_type}
                      </span>
                    </div>
                    <div
                      className={`text-[10px] mt-0.5 truncate ${isSelected ? "text-[#dbe8d9]" : "text-[#697466]"}`}
                    >
                      {clip.approach}
                      {clip.duration_seconds > 0 ? ` · ${clip.duration_seconds}s` : ""} ·{" "}
                      {clip.created_at}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="rt-card text-center flex flex-col justify-between">
          <div>
            <div className="rt-scorecircle my-3">
              <div>
                {active.overall_score}
                <small>/100</small>
              </div>
            </div>
            <span className="rt-tag">{active.verdict}</span>
            <p className="text-xs text-[#263328] leading-relaxed mt-3 text-left">
              {active.summary}
            </p>
          </div>
        </section>

        <section className="rt-card">
          <h3 className="mb-2">Competency radar</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#d3d9c4" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "#263328", fontSize: 11 }} />
                <Radar dataKey="value" stroke="#526e50" fill="#789575" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rt-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="m-0">Candidate Presence</h3>
            <Eye size={16} className="text-[#526e50]" aria-hidden="true" />
          </div>
          <div className="text-xs text-[#526e50] font-semibold">
            Dominant Expression: {cvSummary?.dominant_expression ?? "Composed"}
          </div>
          {[
            ["Eye Contact", cvSummary?.avg_eye_contact ?? 0],
            ["Composure & Posture", cvSummary?.avg_composure ?? 0],
            ["Engagement", cvSummary?.avg_engagement ?? 0],
          ].map(([label, val]) => (
            <div key={String(label)}>
              <div className="flex justify-between text-xs">
                <span>{label}</span>
                <strong>{val}%</strong>
              </div>
              <progress
                className="rt-progress"
                value={Number(val)}
                max={100}
                aria-label={`${label} ${val}%`}
              />
            </div>
          ))}
          <p className="text-[11px] text-[#697466] m-0">{cvSummary?.coaching_note}</p>
        </section>
      </div>

      <section className="rt-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0">Five-Agent Panel Notes</h3>
          <span className="text-[11px] text-[#697466]">
            Click any specialist card to open their full domain report for this interview
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mt-3">
          {panelNotes.map((item) => {
            const targetRoute = AGENT_ROUTE_MAP[item.agent.toLowerCase()] ?? "/readiness";
            return (
              <Link
                key={item.agent}
                to={`${targetRoute}?interviewId=${active.interview_id}`}
                className="rt-glass-inset p-3.5 space-y-1.5 block no-underline transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-xs text-[#263328] inline-flex items-center gap-1">
                    {item.agent}
                    <ArrowUpRight size={12} className="text-[#526e50]" aria-hidden="true" />
                  </strong>
                  <span className="rt-tag">{item.score}</span>
                </div>
                <div className="text-[10px] text-[#697466]">{item.title}</div>
                <p className="text-xs text-[#263328] m-0 leading-relaxed">{item.note}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <AgentDomainReportCard
        agentKey="Marcus"
        agentLabel="AGENT 05 · MARCUS · HIRING BAR RAISER"
        heading="Hiring Bar Decision & Executive Domain Audit"
        description="Marcus's question-by-question calibration review, hiring bar criteria, and readiness signals for this session."
        interviews={[]}
        selectedInterviewId={active.interview_id}
        onSelectInterview={(id) => setSelectedId(id)}
        sessionData={activeSessionData ?? null}
        loading={loadingMarcusDomain}
        hidePicker
      />

      <section className="rt-card">
        <h3>Marcus’s Improvement Roadmap</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
          {roadmap.map((step) => (
            <div
              key={step.priority}
              className="rt-glass-inset p-4 flex flex-col justify-between gap-3"
            >
              <div>
                <span className="rt-tag">{step.priority}</span>
                <h4 className="text-sm font-semibold mt-2 mb-1">{step.title}</h4>
                <p className="text-xs text-[#697466] m-0 leading-relaxed">{step.detail}</p>
              </div>
              <Link
                to={step.target_section || "/technical"}
                className="rt-btn secondary small w-fit"
              >
                Practice in lab →
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
