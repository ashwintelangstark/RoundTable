import { ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

const LANDING_NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/agents", label: "Agents" },
  { to: "/benefits", label: "Benefits" },
];

export function LandingLayout({ title, children }: { title: string; children: ReactNode }) {
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    document.title = `${title} | RoundTable`;
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    setMobileMenuOpen(false);
  }, [pathname, title]);

  useEffect(() => {
    const onScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) {
        setScrollProgress(0);
        return;
      }
      setScrollProgress(Math.min(1, Math.max(0, window.scrollY / docHeight)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Cinematic Top Scroll Progress Hairline */}
      <div
        className="rt-scroll-progress w-full"
        style={{ transform: `scaleX(${scrollProgress})` }}
        aria-hidden="true"
      />

      {/* Minimalistic Glass Navigation Bar */}
      <header className="rt-landing-header pt-3.5">
        <nav className="rt-landing-nav" aria-label="Primary navigation">
          <Link to="/" className="flex items-center gap-2.5 no-underline text-[#1c2c1e] shrink-0">
            <div className="rt-brand-badge !w-9 !h-9">
              <img
                src="/logo.png"
                alt="RoundTable logo"
                className="rt-brand-logo !w-6 !h-6"
                width={24}
                height={24}
              />
            </div>
            <div>
              <span className="font-serif-display text-base sm:text-lg font-semibold tracking-tight block leading-none">
                RoundTable
              </span>
              <span className="hidden sm:block text-[8px] tracking-[1.8px] uppercase font-bold text-[#526e50] mt-0.5">
                Career Studio
              </span>
            </div>
          </Link>

          {/* Desktop Separate Page Links */}
          <div className="hidden md:flex items-center gap-1">
            {LANDING_NAV_ITEMS.map((item) => {
              const isActive = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rt-landing-link"
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Top-Right Explore RoundTable CTA + Mobile Trigger */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Link
              to="/login"
              className="rt-btn !py-2 !px-3 sm:!px-4 !text-[11px] sm:!text-xs !min-h-[38px] whitespace-nowrap"
            >
              <span>Explore RoundTable</span>
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/60 border border-white/85 text-[#223524]"
            >
              {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </nav>

        {/* Mobile Glass Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-2.5 rt-card !p-3 !rounded-3xl rt-auth-panel-fade">
            <div className="flex flex-col gap-1">
              {LANDING_NAV_ITEMS.map((item) => {
                const isActive = pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="rt-landing-link text-center"
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 rt-landing-container pt-10 pb-20 rt-page-enter">{children}</main>

      {/* Minimalistic Glass Footer */}
      <footer className="rt-landing-container pb-8">
        <div className="rt-card !py-5 !px-6 !rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="RoundTable emblem"
              className="w-7 h-7 rounded-full object-contain border border-white/80 bg-white/50 p-0.5"
              width={28}
              height={28}
            />
            <div className="text-xs text-[#4a5c4a]">
              <span className="font-serif-display font-semibold text-[#1c2c1e] text-sm mr-2">
                RoundTable
              </span>
              Prepare with intention. Interview with confidence.
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
            {LANDING_NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-[#4a5d4a] hover:text-[#1c2c1e] no-underline font-medium transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/login"
              className="text-[#27462a] hover:text-[#182e1a] no-underline font-semibold"
            >
              Explore RoundTable →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
