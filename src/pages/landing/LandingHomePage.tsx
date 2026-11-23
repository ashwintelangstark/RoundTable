import {
  ArrowRight,
  ArrowUpRight,
  Award,
  Compass,
  Mic,
  Sparkles,
  Users2,
  Video,
} from "lucide-react";
import { Link } from "react-router-dom";
import { LandingLayout } from "@/components/LandingLayout";
import { ScrollReveal } from "@/components/ScrollReveal";
import { INTERVIEW_PANEL } from "@/game/interview/team";

const JOURNEY_STEPS = [
  {
    step: "01",
    title: "Share the Role You Want",
    detail:
      "Add the company, job title, job description, and your resume. Choose a Technical Round or HR Round and set the pace that fits your upcoming interview.",
  },
  {
    step: "02",
    title: "Step Into the Virtual Boardroom",
    detail:
      "Take your seat across from five distinct interviewers. Speak your answers naturally out loud while they listen, respond in lifelike voices, and follow up on your real stories.",
  },
  {
    step: "03",
    title: "Leave With Clarity & Proof",
    detail:
      "Review personalized notes from all five perspectives, replay your recorded interview clips, and see your readiness score climb before the real hiring day arrives.",
  },
];

const QUICK_HIGHLIGHTS = [
  {
    icon: Users2,
    value: "5 Voices",
    label: "A complete virtual hiring panel seated across from you",
  },
  {
    icon: Mic,
    value: "Speak Naturally",
    label: "Practice out loud in real conversational flow — no typing",
  },
  {
    icon: Video,
    value: "Every Attempt Saved",
    label: "Rewatch past rounds to watch your poise & clarity improve",
  },
  {
    icon: Award,
    value: "Hiring Readiness",
    label: "Clear feedback and next steps after every completed round",
  },
];

export function LandingHomePage() {
  return (
    <LandingLayout title="Home">
      <div className="space-y-20">
        {/* HERO SECTION */}
        <section className="rt-glass-hero p-8 sm:p-12 lg:p-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-5">
              <span className="rt-tag">
                <Sparkles size={11} aria-hidden="true" />
                YOUR PRIVATE INTERVIEW STUDIO
              </span>

              <h1 className="font-serif-display text-4xl sm:text-5xl lg:text-[56px] font-medium leading-[1.08] tracking-tight text-[#1c2c1e] m-0">
                Prepare with intention.
                <br />
                <em className="font-serif-display italic text-[#2f4e32]">
                  Interview with confidence.
                </em>
              </h1>

              <p className="text-[15px] sm:text-base text-[#415342] leading-relaxed max-w-2xl m-0">
                Walk into your next high-stakes interview feeling like you have already been in that
                room. RoundTable seats you face-to-face with five thoughtful interviewers who guide
                you through role strategy, resume probing, problem-solving, leadership storytelling,
                and final-round readiness — all in one calm, realistic space.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link to="/login" className="rt-btn !px-6 !py-3">
                  <span>Explore RoundTable</span>
                  <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
                <Link to="/agents" className="rt-btn secondary !px-6 !py-3">
                  <span>Meet the 5 Agents</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Serene Floating Glass Medallion */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center gap-5">
              <div className="rt-float-slow relative grid place-items-center h-56 w-56 sm:h-64 sm:w-64 rounded-full bg-white/25 backdrop-blur-2xl border-2 border-white/85 shadow-[0_0_60px_rgba(255,255,255,0.75),_inset_0_2px_6px_rgba(255,255,255,0.95),_0_26px_54px_rgba(22,45,28,0.16)] ring-8 ring-white/15">
                <div className="absolute inset-3 rounded-full border border-white/65 pointer-events-none" />
                <img
                  src="/logo.png"
                  alt="RoundTable Studio Emblem"
                  className="w-36 h-36 sm:w-44 sm:h-44 object-contain drop-shadow-[0_12px_22px_rgba(22,45,28,0.18)]"
                />
              </div>

              <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                {INTERVIEW_PANEL.map((agent) => (
                  <Link
                    key={agent.name}
                    to="/agents"
                    className="rt-pill no-underline hover:bg-white/80 transition-colors"
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: agent.jacketColor }}
                    />
                    <span>{agent.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CINEMATIC HIGHLIGHTS STRIP */}
        <section aria-label="RoundTable experience highlights">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {QUICK_HIGHLIGHTS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <ScrollReveal key={item.value} variant="up" delayMs={idx * 90}>
                  <div className="rt-glass-stat h-full flex flex-col justify-between gap-4">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/65 border border-white/90 text-[#29492c] shadow-sm">
                      <Icon size={18} aria-hidden="true" />
                    </div>
                    <div>
                      <div className="font-serif-display text-2xl font-semibold text-[#1c2c1e]">
                        {item.value}
                      </div>
                      <p className="text-xs text-[#4f614f] mt-1 mb-0 leading-relaxed">
                        {item.label}
                      </p>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </section>

        {/* HOW YOUR SESSION UNFOLDS */}
        <section className="space-y-8">
          <ScrollReveal variant="fade">
            <div className="text-center max-w-2xl mx-auto">
              <div className="rt-eyebrow mb-2">How It Feels</div>
              <h2 className="font-serif-display text-3xl sm:text-4xl font-medium text-[#1c2c1e] m-0">
                From nervous rehearsal to calm mastery
              </h2>
              <p className="text-sm text-[#4a5d4a] mt-3 mb-0 leading-relaxed">
                Every detail of RoundTable is shaped around what candidates actually struggle with:
                thinking clearly out loud, keeping calm eye contact, and knowing what interviewers
                really look for behind each question.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {JOURNEY_STEPS.map((item, idx) => (
              <ScrollReveal key={item.step} variant="up" delayMs={idx * 120}>
                <article className="rt-card h-full flex flex-col justify-between gap-5">
                  <div>
                    <span className="rt-tag mb-4">STEP {item.step}</span>
                    <h3 className="font-serif-display text-2xl font-medium text-[#1c2c1e] mt-1 mb-2.5">
                      {item.title}
                    </h3>
                    <p className="text-sm text-[#495b49] leading-relaxed m-0">{item.detail}</p>
                  </div>
                  <div className="h-[1px] w-full bg-gradient-to-r from-white/90 via-[#789575]/40 to-transparent" />
                </article>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* EXPLORE SEPARATE SECTIONS */}
        <section className="space-y-6">
          <ScrollReveal variant="fade">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="rt-eyebrow mb-1.5">Explore Further</div>
                <h2 className="font-serif-display text-3xl font-medium text-[#1c2c1e] m-0">
                  Discover every part of the studio
                </h2>
              </div>
              <Link to="/login" className="rt-btn secondary small">
                <span>Go to Sign In</span>
                <ArrowUpRight size={13} aria-hidden="true" />
              </Link>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <ScrollReveal variant="left" delayMs={60}>
              <Link to="/about" className="rt-card block no-underline h-full group">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60 border border-white/85 text-[#2d4f30] mb-4">
                  <Compass size={18} aria-hidden="true" />
                </div>
                <div className="rt-eyebrow mb-1">01 · About</div>
                <h3 className="font-serif-display text-xl text-[#1c2c1e] mb-2">
                  Why RoundTable Exists
                </h3>
                <p className="text-xs text-[#4b5d4b] leading-relaxed mb-4">
                  Understand our philosophy of calm, committee-style interview preparation built
                  around real candidate confidence.
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#29492c] group-hover:translate-x-1 transition-transform">
                  Read About RoundTable <ArrowRight size={13} aria-hidden="true" />
                </span>
              </Link>
            </ScrollReveal>

            <ScrollReveal variant="scale" delayMs={140}>
              <Link to="/agents" className="rt-card block no-underline h-full group">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60 border border-white/85 text-[#2d4f30] mb-4">
                  <Users2 size={18} aria-hidden="true" />
                </div>
                <div className="rt-eyebrow mb-1">02 · The 5 Agents</div>
                <h3 className="font-serif-display text-xl text-[#1c2c1e] mb-2">
                  Meet the Panel in 3D
                </h3>
                <p className="text-xs text-[#4b5d4b] leading-relaxed mb-4">
                  Interact with all five 3D interviewers — spin, wave, and learn what each panelist
                  listens for during your round.
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#29492c] group-hover:translate-x-1 transition-transform">
                  Meet the 5 Agents <ArrowRight size={13} aria-hidden="true" />
                </span>
              </Link>
            </ScrollReveal>

            <ScrollReveal variant="right" delayMs={220}>
              <Link to="/benefits" className="rt-card block no-underline h-full group">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60 border border-white/85 text-[#2d4f30] mb-4">
                  <Award size={18} aria-hidden="true" />
                </div>
                <div className="rt-eyebrow mb-1">03 · Benefits</div>
                <h3 className="font-serif-display text-xl text-[#1c2c1e] mb-2">
                  How You Grow Faster
                </h3>
                <p className="text-xs text-[#4b5d4b] leading-relaxed mb-4">
                  See how realistic voice flow, presence feedback, multi-attempt replays, and clear
                  roadmaps set you apart.
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#29492c] group-hover:translate-x-1 transition-transform">
                  View All Benefits <ArrowRight size={13} aria-hidden="true" />
                </span>
              </Link>
            </ScrollReveal>
          </div>
        </section>

        {/* CLOSING INVITATION */}
        <ScrollReveal variant="scale">
          <section className="rt-glass-hero p-8 sm:p-11 text-center">
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="rt-eyebrow">Your Seat Is Ready</div>
              <h2 className="font-serif-display text-3xl sm:text-4xl font-medium text-[#1c2c1e] m-0">
                Make your real interview feel like a calm repeat.
              </h2>
              <p className="text-sm text-[#455745] leading-relaxed m-0">
                Create your free account in seconds and step inside your private five-panelist
                interview room today.
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
