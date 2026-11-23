import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Compass,
  Eye,
  HeartHandshake,
  Sparkles,
  Target,
} from "lucide-react";
import { Link } from "react-router-dom";
import { LandingLayout } from "@/components/LandingLayout";
import { ScrollReveal } from "@/components/ScrollReveal";

const PILLARS = [
  {
    icon: Target,
    title: "Real Committee Depth, Not Generic Prompts",
    description:
      "Real hiring decisions are rarely made by one voice. RoundTable surrounds you with five distinct perspectives — strategy, resume credibility, deep problem-solving, culture & leadership, and final executive judgment — so there are no blind spots on interview day.",
  },
  {
    icon: Eye,
    title: "Presence Matters as Much as Knowledge",
    description:
      "Even brilliant candidates lose momentum when nerves affect their pacing, eye contact, or clarity. Our studio gently coaches your composure and delivery alongside your spoken answers, helping you project calm authority from the first hello.",
  },
  {
    icon: HeartHandshake,
    title: "A Safe Space to Make Mistakes First",
    description:
      "It is far better to stumble on a tough follow-up question inside your private practice room than during a dream final round. Repeat the same target role as many times as you like, switching between Technical and HR rounds until your confidence feels effortless.",
  },
];

const ROUND_FLOW = [
  {
    phase: "Opening & Alignment",
    lead: "Nikhil",
    story:
      "Sets a calm, welcoming tone and checks whether your career direction aligns naturally with the company's real priorities.",
  },
  {
    phase: "Your Story on Paper",
    lead: "ananya",
    story:
      "Looks closely at the projects and achievements on your resume, inviting you to explain the real impact you personally drove.",
  },
  {
    phase: "Thinking Under Pressure",
    lead: "Daniel",
    story:
      "Guides you through thoughtful problem-solving follow-ups so you practice reasoning out loud clearly and calmly.",
  },
  {
    phase: "Leadership & Humanity",
    lead: "sarah",
    story:
      "Explores teamwork, ownership, and how you handle challenges — while keeping an eye on warmth, poise, and clarity.",
  },
  {
    phase: "The Final Hiring Bar",
    lead: "Marcus",
    story:
      "Brings everything together with decisive executive questions and authors your clear hiring-readiness report and improvement roadmap.",
  },
];

export function LandingAboutPage() {
  return (
    <LandingLayout title="About">
      <div className="space-y-16">
        {/* ABOUT HERO */}
        <section className="rt-glass-hero p-8 sm:p-12">
          <div className="max-w-4xl space-y-5">
            <span className="rt-tag">
              <Compass size={11} aria-hidden="true" />
              ABOUT ROUNDTABLE
            </span>
            <h1 className="font-serif-display text-4xl sm:text-5xl font-medium leading-[1.1] text-[#1c2c1e] m-0">
              Built for the quiet moment right before you say,
              <em className="font-serif-display italic text-[#2f4e32]">
                {" "}
                &ldquo;Thanks for having me.&rdquo;
              </em>
            </h1>
            <p className="text-[15px] sm:text-base text-[#415342] leading-relaxed m-0">
              Most candidates spend weeks studying notes silently — only to feel caught off guard
              when an actual interviewer asks an unexpected follow-up question out loud. RoundTable
              was created to bridge that exact gap: giving every ambitious job seeker a calm,
              realistic boardroom where practice feels just like the real conversation.
            </p>
          </div>
        </section>

        {/* THE PROBLEM & OUR ANSWER */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <ScrollReveal variant="left" className="lg:col-span-6">
            <div className="rt-card h-full space-y-4">
              <div className="rt-eyebrow">Why Traditional Prep Falls Short</div>
              <h2 className="font-serif-display text-2xl sm:text-3xl font-medium text-[#1c2c1e] m-0">
                Reading answers is not the same as speaking them.
              </h2>
              <p className="text-sm text-[#495b49] leading-relaxed">
                When you only read sample questions or type responses in a quiet document, your
                brain never practices the real rhythm of an interview: listening carefully, pausing
                with composure, structuring a clear thought in seconds, and adjusting when an
                interviewer digs deeper.
              </p>
              <p className="text-sm text-[#495b49] leading-relaxed m-0">
                Candidates often leave real interviews thinking, &ldquo;I knew the answer — I just
                didn&apos;t explain it clearly in the moment.&rdquo; RoundTable gives you that
                moment ahead of time, as many times as you need.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal variant="right" delayMs={120} className="lg:col-span-6">
            <div className="rt-card h-full space-y-4">
              <div className="rt-eyebrow">The RoundTable Approach</div>
              <h2 className="font-serif-display text-2xl sm:text-3xl font-medium text-[#1c2c1e] m-0">
                A complete five-person panel dedicated to your growth.
              </h2>
              <p className="text-sm text-[#495b49] leading-relaxed">
                Instead of one generic interviewer, RoundTable mirrors how thoughtful companies
                actually evaluate candidates. Each specialist focuses on a distinct pillar of your
                candidacy, speaks with their own natural voice, and remembers your resume and target
                role throughout the entire session.
              </p>
              <ul className="space-y-2.5 pt-1 m-0 p-0 list-none">
                {[
                  "Choose Technical Round or HR Round tailored to your upcoming stage",
                  "Practice speaking naturally while receiving live composure guidance",
                  "Keep every recorded practice session organized by role and attempt",
                  "Receive dedicated coaching in all five development studios afterward",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-xs text-[#2b3e2d]">
                    <CheckCircle2
                      size={15}
                      className="text-[#355c38] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        </section>

        {/* THREE PILLARS */}
        <section className="space-y-7">
          <ScrollReveal variant="fade">
            <div className="text-center max-w-2xl mx-auto">
              <div className="rt-eyebrow mb-2">Our Philosophy</div>
              <h2 className="font-serif-display text-3xl sm:text-4xl font-medium text-[#1c2c1e] m-0">
                Thoughtful preparation changes everything
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PILLARS.map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <ScrollReveal key={pillar.title} variant="up" delayMs={idx * 110}>
                  <article className="rt-card h-full space-y-3.5">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/65 border border-white/90 text-[#29492c]">
                      <Icon size={18} aria-hidden="true" />
                    </div>
                    <h3 className="font-serif-display text-xl font-medium text-[#1c2c1e] m-0">
                      {pillar.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#4a5c4a] leading-relaxed m-0">
                      {pillar.description}
                    </p>
                  </article>
                </ScrollReveal>
              );
            })}
          </div>
        </section>

        {/* HOW THE 5-TURN PANEL FLOWS */}
        <section className="rt-card p-7 sm:p-10 space-y-6">
          <ScrollReveal variant="fade">
            <div>
              <div className="rt-eyebrow mb-1.5">Inside One Full Session</div>
              <h2 className="font-serif-display text-2xl sm:text-3xl font-medium text-[#1c2c1e] m-0">
                Five perspectives, one seamless conversation
              </h2>
              <p className="text-xs sm:text-sm text-[#4d5f4d] mt-2 mb-0 max-w-2xl">
                During a full panel interview, each interviewer leads their dedicated round of
                questions before handing off smoothly to the next colleague — just like an on-site
                interview loop.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {ROUND_FLOW.map((stage, idx) => (
              <ScrollReveal key={stage.lead} variant="up" delayMs={idx * 80}>
                <div className="rt-glass-inset p-4 h-full flex flex-col justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold tracking-[1.4px] uppercase text-[#526e50]">
                      0{idx + 1} · {stage.lead}
                    </span>
                    <h3 className="font-serif-display text-base font-semibold text-[#1c2c1e] mt-1 mb-1.5">
                      {stage.phase}
                    </h3>
                    <p className="text-xs text-[#4b5d4b] leading-relaxed m-0">{stage.story}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* NEXT STEP CTA */}
        <ScrollReveal variant="scale">
          <section className="rt-glass-hero p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <span className="rt-tag">
                <Sparkles size={11} aria-hidden="true" />
                NEXT STEP
              </span>
              <h2 className="font-serif-display text-2xl sm:text-3xl font-medium text-[#1c2c1e] m-0">
                Ready to meet the five voices behind the table?
              </h2>
              <p className="text-xs sm:text-sm text-[#4a5c4a] m-0">
                Spin and greet each interviewer in 3D, or step directly into your RoundTable studio.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link to="/agents" className="rt-btn secondary">
                <span>Meet the 5 Agents</span>
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
              <Link to="/login" className="rt-btn">
                <span>Explore RoundTable</span>
                <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </section>
        </ScrollReveal>
      </div>
    </LandingLayout>
  );
}
