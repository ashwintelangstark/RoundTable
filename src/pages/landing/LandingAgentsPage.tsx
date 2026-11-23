import {
  ArrowUpRight,
  CheckCircle2,
  Hand,
  MessageSquareQuote,
  RotateCcw,
  Sparkles,
  Users2,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { LandingLayout } from "@/components/LandingLayout";
import { ScrollReveal } from "@/components/ScrollReveal";
import { InteractiveAgentShowcaseCanvas } from "@/game/interview/room";
import { INTERVIEW_PANEL, type PanelAgentName, type PanelMember } from "@/game/interview/team";

function InteractiveAgentRow({ member, index }: { member: PanelMember; index: number }) {
  const [waveSignal, setWaveSignal] = useState(0);
  const [resetSignal, setResetSignal] = useState(0);
  const [showGreeting, setShowGreeting] = useState(false);

  const reverseDesktop = index % 2 === 1;

  function triggerGreeting() {
    setWaveSignal((n) => n + 1);
    setShowGreeting(true);
  }

  return (
    <ScrollReveal variant={reverseDesktop ? "right" : "left"} delayMs={80}>
      <article
        id={`agent-${member.name.toLowerCase()}`}
        className="rt-card p-6 sm:p-8 scroll-mt-28"
      >
        <div
          className={`grid grid-cols-1 lg:grid-cols-12 gap-8 items-center ${
            reverseDesktop ? "lg:[&>*:first-child]:order-2" : ""
          }`}
        >
          {/* Interactive Three.js 3D Roblox Character Stage */}
          <div className="lg:col-span-5 space-y-3">
            <div className="relative">
              <InteractiveAgentShowcaseCanvas
                member={member}
                waveSignal={waveSignal}
                resetSignal={resetSignal}
                onInteract={() => setShowGreeting(true)}
              />

              {/* Subtle Top Interaction Hint */}
              <div className="pointer-events-none absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                <span className="rt-pill !text-[10px] !py-1 !px-3">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: member.jacketColor }}
                  />
                  0{index + 1} · {member.tag}
                </span>
                <span className="rt-pill !text-[10px] !py-1 !px-3">Drag 360° · Click to wave</span>
              </div>

              {/* Live Greeting Quote Overlay when Interacted */}
              {showGreeting && (
                <div className="absolute bottom-3 left-3 right-3 rt-auth-panel-fade rounded-2xl bg-white/88 backdrop-blur-xl border border-white px-4 py-3 shadow-lg">
                  <div className="flex items-start gap-2 text-xs text-[#1f3321]">
                    <MessageSquareQuote
                      size={15}
                      className="text-[#3a5d3d] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <p className="m-0 italic leading-relaxed">
                      &ldquo;{member.greetingQuote}&rdquo;
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Stage Controls */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <button type="button" onClick={triggerGreeting} className="rt-btn secondary small">
                <Hand size={13} aria-hidden="true" />
                <span>Wave &amp; Greet {member.name}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setResetSignal((n) => n + 1);
                  setShowGreeting(false);
                }}
                className="rt-btn ghost small"
              >
                <RotateCcw size={12} aria-hidden="true" />
                <span>Reset View</span>
              </button>
            </div>
          </div>

          {/* Candidate-Perspective Detailed Brief */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rt-tag">{member.sectionLabel}</span>
              <span className="rt-pill !text-[10px]">{member.voiceLabel}</span>
            </div>

            <div>
              <h2 className="font-serif-display text-3xl sm:text-4xl font-medium text-[#1c2c1e] m-0">
                {member.name}
              </h2>
              <div className="text-xs font-semibold uppercase tracking-[1.2px] text-[#526e50] mt-1">
                {member.title}
              </div>
              <p className="font-serif-display italic text-base text-[#2f4e32] mt-2 mb-0">
                {member.personaTagline}
              </p>
            </div>

            <p className="text-sm text-[#435543] leading-relaxed m-0">{member.candidateBrief}</p>

            {/* What They Listen For */}
            <div className="rt-glass-inset p-4 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#526e50]">
                What {member.name} listens for in your answers
              </div>
              <ul className="space-y-1.5 m-0 p-0 list-none">
                {member.whatTheyListenFor.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-xs text-[#2b3e2d]">
                    <CheckCircle2
                      size={14}
                      className="text-[#355c38] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Sample Questions */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#566a55]">
                Questions you may hear at the table
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {member.sampleQuestions.map((q) => (
                  <div
                    key={q}
                    className="rounded-2xl bg-white/45 border border-white/80 px-3.5 py-2.5 text-xs text-[#314432] italic leading-relaxed"
                  >
                    &ldquo;{q}&rdquo;
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </article>
    </ScrollReveal>
  );
}

export function LandingAgentsPage() {
  function scrollToAgent(name: PanelAgentName) {
    const el = document.getElementById(`agent-${name.toLowerCase()}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <LandingLayout title="Agents">
      <div className="space-y-12">
        {/* AGENTS HERO */}
        <section className="rt-glass-hero p-8 sm:p-12">
          <div className="max-w-4xl space-y-4">
            <span className="rt-tag">
              <Users2 size={11} aria-hidden="true" />
              YOUR 5-AGENT INTERVIEW PANEL
            </span>
            <h1 className="font-serif-display text-4xl sm:text-5xl font-medium leading-[1.1] text-[#1c2c1e] m-0">
              Meet the five voices seated
              <em className="font-serif-display italic text-[#2f4e32]"> across the table.</em>
            </h1>
            <p className="text-[15px] sm:text-base text-[#415342] leading-relaxed m-0">
              Every interviewer at RoundTable brings a distinct personality, voice, and coaching
              focus. Drag any 3D character to look around them, move your cursor to catch their eye
              contact, or click them to say hello before you step into the interview room.
            </p>

            {/* Quick Jump Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {INTERVIEW_PANEL.map((agent) => (
                <button
                  key={agent.name}
                  type="button"
                  onClick={() => scrollToAgent(agent.name)}
                  className="rt-pill hover:bg-white/85 transition-colors"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: agent.jacketColor }}
                  />
                  <span>{agent.name}</span>
                  <span className="text-[#637662] font-normal">· {agent.tag}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ALL 5 INTERACTIVE 3D AGENT SHOWCASES */}
        <section className="space-y-8" aria-label="Interactive 3D panelist directory">
          {INTERVIEW_PANEL.map((member, idx) => (
            <InteractiveAgentRow key={member.name} member={member} index={idx} />
          ))}
        </section>

        {/* CLOSING CTA */}
        <ScrollReveal variant="scale">
          <section className="rt-glass-hero p-8 sm:p-11 text-center">
            <div className="max-w-2xl mx-auto space-y-4">
              <span className="rt-tag">
                <Sparkles size={11} aria-hidden="true" />
                STEP INTO THE BOARDROOM
              </span>
              <h2 className="font-serif-display text-3xl sm:text-4xl font-medium text-[#1c2c1e] m-0">
                Sit across from Nikhil, ananya, Daniel, sarah, and Marcus today.
              </h2>
              <p className="text-sm text-[#455745] leading-relaxed m-0">
                Sign in or create your account to schedule your first Technical or HR panel session
                and unlock all five personal coaching studios.
              </p>
              <div className="pt-2">
                <Link to="/login" className="rt-btn !px-7 !py-3">
                  <span>Explore RoundTable</span>
                  <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>
        </ScrollReveal>
      </div>
    </LandingLayout>
  );
}
