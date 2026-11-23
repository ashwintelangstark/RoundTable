import {
  ArrowRight,
  ArrowUpRight,
  Award,
  CheckCircle2,
  Eye,
  FileCheck2,
  Mic,
  Repeat,
  Sparkles,
  TrendingUp,
  Video,
} from "lucide-react";
import { Link } from "react-router-dom";
import { LandingLayout } from "@/components/LandingLayout";
import { ScrollReveal } from "@/components/ScrollReveal";

const CANDIDATE_BENEFITS = [
  {
    icon: Mic,
    eyebrow: "Natural Voice Conversation",
    title: "Think and speak out loud — just like the real room",
    detail:
      "Forget slowly typing rehearsed paragraphs. Click the microphone, speak your answer in your own natural cadence, and listen as each interviewer responds in a distinct human-like voice with tailored follow-ups.",
  },
  {
    icon: FileCheck2,
    eyebrow: "Personalized to Your Role",
    title: "Technical & HR rounds shaped around your exact resume",
    detail:
      "Upload your resume and paste the job description for the exact company you are targeting. Every question reflects your real projects, your seniority level, and whether you are preparing for a Technical Round or an HR Round.",
  },
  {
    icon: Eye,
    eyebrow: "Live Camera Presence",
    title: "Build calm eye contact and poise before high-stakes video calls",
    detail:
      "While you practice, RoundTable observes your eye contact, composure, and engagement on camera — helping you spot subtle habits like looking away during tough questions and replace them with relaxed confidence.",
  },
  {
    icon: Video,
    eyebrow: "Multi-Attempt Playback",
    title: "Rewatch every practice session for the same role side by side",
    detail:
      "Practicing for a dream company more than once? Every recorded attempt is saved neatly together so you can compare attempt one with attempt three and literally watch your clarity and confidence transform.",
  },
  {
    icon: Award,
    eyebrow: "Five Dedicated Coaching Studios",
    title: "Actionable guidance across every stage of job prep",
    detail:
      "After each interview, all five panelists publish dedicated coaching reports in their own sections — decoding role expectations, polishing resume bullets, sharpening technical depth, refining leadership stories, and summarizing your overall readiness.",
  },
  {
    icon: TrendingUp,
    eyebrow: "Visible Readiness Growth",
    title: "Know exactly when you are ready for the offer",
    detail:
      "Switch between any of your completed interviews in Hiring Readiness to track your evolving scores, review your strengths and gaps, and follow a prioritized preparation roadmap tailored to your latest performance.",
  },
];

const COMPARISON_ROWS = [
  {
    dimension: "How you practice",
    alone: "Reading static question lists or rehearsing silently in your head",
    roundtable: "Speaking naturally across a lifelike 5-interviewer virtual table",
  },
  {
    dimension: "Follow-up questions",
    alone: "Fixed prompts that never challenge your real resume claims",
    roundtable: "Adaptive follow-ups that dig into what you actually said",
  },
  {
    dimension: "Delivery & presence",
    alone: "No objective view of your eye contact, expression, or composure",
    roundtable: "Live camera poise feedback plus full video replay of every attempt",
  },
  {
    dimension: "After the session",
    alone: "Guessing whether your answer sounded strong enough",
    roundtable: "Five detailed specialist reports and a clear hiring-readiness roadmap",
  },
];

export function LandingBenefitsPage() {
  return (
    <LandingLayout title="Benefits">
      <div className="space-y-16">
        {/* BENEFITS HERO */}
        <section className="rt-glass-hero p-8 sm:p-12">
          <div className="max-w-4xl space-y-4">
            <span className="rt-tag">
              <Sparkles size={11} aria-hidden="true" />
              CANDIDATE BENEFITS
            </span>
            <h1 className="font-serif-display text-4xl sm:text-5xl font-medium leading-[1.1] text-[#1c2c1e] m-0">
              Walk into your interview calm —
              <em className="font-serif-display italic text-[#2f4e32]">
                {" "}
                and walk out proud of every answer.
              </em>
            </h1>
            <p className="text-[15px] sm:text-base text-[#415342] leading-relaxed m-0">
              RoundTable turns stressful, uncertain interview prep into a structured, calm ritual.
              Here is how preparing in your private studio helps you perform at your very best when
              the real opportunity arrives.
            </p>
          </div>
        </section>

        {/* 6 CANDIDATE BENEFIT CARDS */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {CANDIDATE_BENEFITS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <ScrollReveal key={item.title} variant="up" delayMs={(idx % 3) * 100}>
                <article className="rt-card h-full flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/65 border border-white/90 text-[#29492c]">
                        <Icon size={18} aria-hidden="true" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-[1.3px] text-[#566a55]">
                        {item.eyebrow}
                      </span>
                    </div>
                    <h2 className="font-serif-display text-xl font-medium text-[#1c2c1e] m-0">
                      {item.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-[#495b49] leading-relaxed m-0">
                      {item.detail}
                    </p>
                  </div>
                </article>
              </ScrollReveal>
            );
          })}
        </section>

        {/* COMPARISON TABLE */}
        <ScrollReveal variant="scale">
          <section className="rt-card p-6 sm:p-9 space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="rt-eyebrow mb-1.5">The Difference You Feel</div>
                <h2 className="font-serif-display text-2xl sm:text-3xl font-medium text-[#1c2c1e] m-0">
                  Preparing alone vs. preparing at RoundTable
                </h2>
              </div>
              <span className="rt-pill">
                <Repeat size={12} aria-hidden="true" />
                Unlimited practice rounds
              </span>
            </div>

            <div className="table-wrapper">
              <table className="rt-table">
                <thead>
                  <tr>
                    <th>Preparation Dimension</th>
                    <th>Preparing Alone</th>
                    <th>With RoundTable</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.dimension}>
                      <td className="font-semibold text-[#1c2c1e]">{row.dimension}</td>
                      <td className="text-[#5d6c5c]">{row.alone}</td>
                      <td className="text-[#1f3b22] font-medium">
                        <span className="inline-flex items-start gap-2">
                          <CheckCircle2
                            size={14}
                            className="text-[#355c38] shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <span>{row.roundtable}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </ScrollReveal>

        {/* CLOSING CTA */}
        <ScrollReveal variant="up">
          <section className="rt-glass-hero p-8 sm:p-11 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="rt-eyebrow">Start Your Next Chapter</div>
              <h2 className="font-serif-display text-2xl sm:text-3xl font-medium text-[#1c2c1e] m-0">
                Give yourself the calm advantage before your next interview.
              </h2>
              <p className="text-xs sm:text-sm text-[#4a5c4a] m-0">
                Create your account in moments and step straight into your personalized RoundTable
                workspace.
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
