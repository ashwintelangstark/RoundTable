import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Code2,
  FileText,
  Layers,
  Lock,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  Users2,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { INTERVIEW_PANEL } from "@/game/interview/team";
import { api } from "@/lib/api";

const AGENT_DATA = [
  {
    name: "Nikhil",
    title: "JD & Company Decoder Agent",
    tag: "Strategy",
    route: "/career",
    icon: Target,
  },
  {
    name: "ananya",
    title: "Resume Gap & Strengths Analyst Agent",
    tag: "Resume",
    route: "/resume",
    icon: FileText,
  },
  {
    name: "Daniel",
    title: "Technical System Design Interviewer Agent",
    tag: "Technical",
    route: "/technical",
    icon: Code2,
  },
  {
    name: "sarah",
    title: "Behavioural & Culture Fit Interviewer Agent",
    tag: "People",
    route: "/behavioral",
    icon: Users2,
  },
  {
    name: "Marcus",
    title: "Hiring Bar Raiser Agent",
    tag: "Bar Raiser",
    route: "/readiness",
    icon: Lock,
  },
];

export function OverviewPage() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.dashboard,
  });

  const stats = data?.stats;
  const rawRecent = data?.recentInterviews ?? [];

  // Default fallback row if no sessions registered yet to match prototype view
  const recent =
    rawRecent.length > 0
      ? rawRecent
      : [
          {
            id: 1,
            role: "AI ENGINEER",
            company_name: "NVIDIA",
            approach: "Standard Panel",
            status: "Completed",
            overall_score: 82,
          },
        ];

  return (
    <div className="space-y-6">
      {/* HERO BANNER WITH 3D GLASS SEAL */}
      <section className="rt-glass-hero p-8 flex flex-wrap items-center justify-between gap-6">
        <div className="max-w-xl">
          <span className="rt-tag">YOUR CAREER STUDIO</span>
          <h3 className="font-serif-display text-3xl md:text-4xl font-medium mt-3 mb-3 leading-tight text-[#1c2c1e]">
            Prepare with intention.
            <br />
            <em className="font-serif-display italic">Interview with confidence.</em>
          </h3>
          <p className="text-sm text-[#485744] leading-relaxed mb-6 max-w-lg">
            Five AI specialists seated at one virtual boardroom table — decoding job descriptions,
            strengthening your resume, probing technical architecture, coaching behavioral presence
            with real-time facial telemetry, and speaking with natural wisdom.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="rt-btn" onClick={() => navigate("/room")}>
              Enter interview room
              <ArrowUpRight size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="rt-btn secondary"
              onClick={() => navigate("/registration")}
            >
              Register Interview
            </button>
          </div>
        </div>

        {/* Circular 3D Embossed Glass Medallion */}
        <div className="hidden sm:grid place-items-center pr-3">
          <div className="relative grid place-items-center h-48 w-48 rounded-full bg-white/20 backdrop-blur-2xl border-2 border-white/80 shadow-[0_0_50px_rgba(255,255,255,0.7),_inset_0_2px_4px_rgba(255,255,255,0.9),_0_20px_40px_rgba(22,45,28,0.16)] ring-8 ring-white/15">
            <div className="absolute inset-2.5 rounded-full border border-white/60 pointer-events-none" />
            <img
              src="/logo.png"
              alt="RoundTable Career Intelligence Crest"
              className="h-32 w-32 rounded-full object-contain filter drop-shadow-md"
            />
          </div>
        </div>
      </section>

      {/* METRIC STATS ROW (4 TRANSPARENT GLASS CARDS WITH GREEN ICONS) */}
      <section
        aria-label="Performance metrics"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <div className="rt-glass-stat flex items-start gap-3.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#526e50]/15 border border-white/70 text-[#2b442b] shrink-0 mt-0.5">
            <Calendar size={18} aria-hidden="true" />
          </div>
          <div>
            <div className="text-[11px] text-[#556350] font-medium">Interviews completed</div>
            <div className="font-serif-display text-3xl font-bold my-1 text-[#1e2f20]">
              {String(
                stats?.completedCount ?? (rawRecent.length > 0 ? stats?.completedCount : 1),
              ).padStart(2, "0")}
            </div>
            <div className="text-[11px] text-[#526e50] font-medium">
              {stats?.totalCount ?? (rawRecent.length > 0 ? stats?.totalCount : 1)} total registered
            </div>
          </div>
        </div>

        <div className="rt-glass-stat flex items-start gap-3.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#526e50]/15 border border-white/70 text-[#2b442b] shrink-0 mt-0.5">
            <BarChart3 size={18} aria-hidden="true" />
          </div>
          <div>
            <div className="text-[11px] text-[#556350] font-medium">Average readiness</div>
            <div className="font-serif-display text-3xl font-bold my-1 text-[#1e2f20]">
              {stats?.avgReadiness ?? 82}%
            </div>
            <div className="text-[11px] text-[#526e50] font-medium">Across completed panels</div>
          </div>
        </div>

        <div className="rt-glass-stat flex items-start gap-3.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#526e50]/15 border border-white/70 text-[#2b442b] shrink-0 mt-0.5">
            <ShieldCheck size={18} aria-hidden="true" />
          </div>
          <div>
            <div className="text-[11px] text-[#556350] font-medium">Resume strength</div>
            <div className="font-serif-display text-3xl font-bold my-1 text-[#1e2f20]">
              {stats?.resumeStrength ?? 84}
              <span className="text-sm font-normal text-[#556350]"> /100</span>
            </div>
            <div className="text-[11px] text-[#526e50] font-medium">Analyzed by ananya</div>
          </div>
        </div>

        <div className="rt-glass-stat flex items-start gap-3.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#526e50]/15 border border-white/70 text-[#2b442b] shrink-0 mt-0.5">
            <Layers size={18} aria-hidden="true" />
          </div>
          <div>
            <div className="text-[11px] text-[#556350] font-medium">Agent lab delta</div>
            <div className="font-serif-display text-3xl font-bold my-1 text-[#1e2f20]">
              {String(stats?.practiceCount ?? 1).padStart(2, "0")}
            </div>
            <div className="text-[11px] text-[#526e50] font-medium">Technical & STAR reps</div>
          </div>
        </div>
      </section>

      {/* TWO COLUMNS: CONTINUE YOUR JOURNEY & 5-AGENT PANEL */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-5 items-start">
        {/* Left: Continue your journey */}
        <div className="rt-card">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="m-0 text-xl font-medium font-serif-display text-[#1c2c1e]">
              Continue your journey
            </h3>
            <Link to="/registration" className="rt-btn secondary small">
              All interviews +
            </Link>
          </div>
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="recent-interviews-caption"
            className="table-wrapper"
          >
            <table className="rt-table responsive">
              <caption id="recent-interviews-caption" className="visually-hidden">
                Recent interview sessions
              </caption>
              <thead>
                <tr>
                  <th scope="col">ROLE / COMPANY</th>
                  <th scope="col">APPROACH</th>
                  <th scope="col">STATUS</th>
                  <th scope="col">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((item) => (
                  <tr key={item.id} className="rt-glass-inset !border-white/50">
                    <th scope="row" className="font-normal text-left py-3.5">
                      <strong className="block text-xs uppercase tracking-wide text-[#1c2c1e]">
                        {item.role}
                      </strong>
                      <span className="text-[11px] uppercase tracking-wider text-[#637562] font-semibold">
                        {item.company_name}
                      </span>
                    </th>
                    <td data-label="Approach" className="text-xs text-[#3b4e3c]">
                      {item.approach}
                    </td>
                    <td data-label="Status">
                      <span className="rt-tag !bg-[#2e5232]/15 !text-[#234226] !border-white/80">
                        <CheckCircle2 size={12} className="text-[#36683a]" />
                        {item.status}
                      </span>
                    </td>
                    <td data-label="Action">
                      {item.status === "Completed" ? (
                        <button
                          type="button"
                          className="rt-btn secondary small"
                          onClick={() => navigate(`/readiness?interviewId=${item.id}`)}
                        >
                          Report ({item.overall_score ?? "82"})
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rt-btn small"
                          onClick={() => navigate(`/room?session=${item.id}`)}
                        >
                          Enter Room
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Your 5-Agent Panel */}
        <div className="rt-card">
          <h3 className="m-0 text-xl font-medium font-serif-display text-[#1c2c1e]">
            Your 5-Agent Panel
          </h3>
          <p className="text-xs text-[#556350] mt-1 mb-3.5">
            Each specialist comes a live seat in the 3D room and a dedicated coaching section.
          </p>
          <div className="space-y-2">
            {AGENT_DATA.map((agent) => {
              const Icon = agent.icon;
              return (
                <Link
                  key={agent.name}
                  to={agent.route}
                  className="rt-glass-inset flex items-center justify-between gap-3 p-2.5 no-underline text-inherit hover:bg-white/50 transition-all rounded-xl"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#526e50]/15 border border-white/70 text-[#2b442b] shrink-0">
                      <Icon size={15} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#1c2c1e]">{agent.name}</div>
                      <div className="text-[10px] text-[#637562] truncate">{agent.title}</div>
                    </div>
                  </div>
                  <span className="rt-tag !py-0.5 !px-2.5 text-[10px] shrink-0">{agent.tag}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* PRACTICE PATHWAYS (3 CARDS MATCHING BOTTOM ROW OF SCREENSHOT) */}
      <section aria-label="Practice pathways">
        <div className="flex items-center justify-between mb-3.5">
          <h3 className="font-serif-display text-xl font-medium m-0 text-[#1c2c1e]">
            Practice pathways
          </h3>
          <span className="text-xs text-[#556350] font-medium">
            Build mastery across all 5 agent roles
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rt-card flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="rt-tag">01 · NIKHIL</span>
                <div className="grid h-7 w-7 place-items-center rounded-full bg-white/40 border border-white/70 text-[#2b442b]">
                  <Target size={14} aria-hidden="true" />
                </div>
              </div>
              <h4 className="text-base font-semibold m-0 mb-1.5 text-[#1c2c1e]">Know the role</h4>
              <p className="text-xs text-[#556350] leading-relaxed mb-4">
                Decode job descriptions, strategic company expectations, and unwritten evaluation
                signals.
              </p>
            </div>
            <Link to="/career" className="rt-btn secondary small w-fit">
              Explore Career Intelligence →
            </Link>
          </div>

          <div className="rt-card flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="rt-tag">02 · ANANYA</span>
                <div className="grid h-7 w-7 place-items-center rounded-full bg-white/40 border border-white/70 text-[#2b442b]">
                  <FileText size={14} aria-hidden="true" />
                </div>
              </div>
              <h4 className="text-base font-semibold m-0 mb-1.5 text-[#1c2c1e]">
                Strengthen your story
              </h4>
              <p className="text-xs text-[#556350] leading-relaxed mb-4">
                Upload your PDF or DOCX resume to uncover gaps, quantify outcomes, and sharpen
                alignment.
              </p>
            </div>
            <Link to="/resume" className="rt-btn secondary small w-fit">
              Open Resume Intelligence →
            </Link>
          </div>

          <div className="rt-card flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="rt-tag">03 · DANIEL & SARAH</span>
                <div className="grid h-7 w-7 place-items-center rounded-full bg-white/40 border border-white/70 text-[#2b442b]">
                  <Code2 size={14} aria-hidden="true" />
                </div>
              </div>
              <h4 className="text-base font-semibold m-0 mb-1.5 text-[#1c2c1e]">
                Think deeply & lead
              </h4>
              <p className="text-xs text-[#556350] leading-relaxed mb-4">
                Drill system design trade-offs with Daniel or sharpen STAR leadership stories with
                Sarah.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link to="/technical" className="rt-btn secondary small">
                Technical Lab →
              </Link>
              <Link to="/behavioral" className="rt-btn secondary small">
                Behavioural Lab →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
