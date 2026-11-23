import { useQuery } from "@tanstack/react-query";
import {
  Award,
  BrainCircuit,
  Briefcase,
  CalendarCheck2,
  Cpu,
  FileCheck2,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Tv2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthContext";
import { api } from "@/lib/api";

const WORKSPACE_LINKS = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/registration", label: "Interview Registration", icon: CalendarCheck2 },
  { to: "/room", label: "Interview Room", icon: Tv2 },
];

const DEVELOPMENT_LINKS = [
  { to: "/career", label: "Career Intelligence", icon: BrainCircuit },
  { to: "/resume", label: "Resume Intelligence", icon: FileCheck2 },
  { to: "/technical", label: "Technical Interview Lab", icon: Cpu },
  { to: "/behavioral", label: "Behavioral Intelligence", icon: HeartHandshake },
  { to: "/readiness", label: "Hiring Readiness", icon: Award },
];

const ROUTE_TITLES: Record<string, { eyebrow: string; title: string }> = {
  "/": {
    eyebrow: "Your career, thoughtfully prepared",
    title: "Welcome to RoundTable.",
  },
  "/registration": {
    eyebrow: "Section 01 · Interview Pipeline",
    title: "Interview Registration",
  },
  "/room": {
    eyebrow: "Section 02 · Live 5-Agent 3D Panel",
    title: "The Interview Room",
  },
  "/career": {
    eyebrow: "Section 03 · JD & Company Decoder Agent — Nikhil",
    title: "Career Intelligence",
  },
  "/resume": {
    eyebrow: "Section 04 · Resume Gap & Strength Analyst Agent — ananya",
    title: "Resume Intelligence",
  },
  "/technical": {
    eyebrow: "Section 05 · Technical System Design Interviewer Agent — Daniel",
    title: "Technical Interview Lab",
  },
  "/behavioral": {
    eyebrow: "Section 06 · Behavioral & Culture Fit Interviewer Agent — sarah",
    title: "Behavioral Intelligence",
  },
  "/readiness": {
    eyebrow: "Section 07 · Hiring Bar Raiser Agent — Marcus",
    title: "Hiring Readiness",
  },
};

function SidebarNavContent({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await logout();
      onNavigate?.();
      navigate("/login", { replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/40">
        <Link to="/" className="rt-brand !p-0 !m-0" onClick={onNavigate}>
          <div className="rt-brand-badge">
            <img
              src="/logo.png"
              alt="RoundTable logo"
              className="rt-brand-logo"
              width={26}
              height={26}
            />
          </div>
          <div>
            <h1>RoundTable</h1>
            <small>CAREER INTELLIGENCE</small>
          </div>
        </Link>
      </div>

      <nav aria-label="Workspace">
        <div className="rt-nav-label">Workspace</div>
        <ul className="rt-nav-list">
          {WORKSPACE_LINKS.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="rt-nav-link"
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                >
                  <div className="rt-nav-icon-box">
                    <Icon size={14} strokeWidth={2.2} aria-hidden="true" />
                  </div>
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav aria-label="Agent Development Sections" className="mt-4">
        <div className="rt-nav-label">Agent Development</div>
        <ul className="rt-nav-list">
          {DEVELOPMENT_LINKS.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="rt-nav-link"
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                >
                  <div className="rt-nav-icon-box">
                    <Icon size={14} strokeWidth={2.2} aria-hidden="true" />
                  </div>
                  <span className="font-medium truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="rt-side-bottom">
        <div className="rt-glass-inset p-2.5 flex items-center justify-between gap-2 rounded-2xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#526e50]/20 border border-white/60 text-[#2b442b] shrink-0">
              <Briefcase size={15} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate text-[#1c2c1e]">
                {user?.name || "Candidate Studio"}
              </div>
              <div className="text-[10px] text-[#637562] truncate">
                {user?.email || "Candidate Studio · Live AI Pipeline"}
              </div>
            </div>
          </div>
          {user && (
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              aria-label="Sign out"
              title="Sign out"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/55 border border-white/80 text-[#3c503d] hover:bg-white/90 hover:text-[#8b3027] transition-colors"
            >
              <LogOut size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const drawerRef = useRef<HTMLDialogElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const meta = ROUTE_TITLES[pathname] ?? ROUTE_TITLES["/"]!;

  useEffect(() => {
    document.title = `${meta.title} | RoundTable`;
  }, [meta.title]);

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 12000,
    retry: 1,
  });

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    if (drawerOpen && !drawer.open) {
      drawer.showModal();
    } else if (!drawerOpen && drawer.open) {
      drawer.close();
    }
  }, [drawerOpen]);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    const onClose = () => setDrawerOpen(false);
    drawer.addEventListener("close", onClose);
    return () => drawer.removeEventListener("close", onClose);
  }, []);

  return (
    <div className="rt-app">
      <a href="#main-content" className="visually-hidden">
        Skip to main content
      </a>

      {/* Desktop Sliding Sidebar */}
      <aside
        className={`rt-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}
        aria-label="Sidebar"
        aria-hidden={sidebarCollapsed}
      >
        <SidebarNavContent pathname={pathname} />
      </aside>

      {/* Mobile Drawer */}
      <dialog
        ref={drawerRef}
        className="rt-drawer"
        aria-label="Mobile navigation drawer"
        onClick={(e) => {
          if (e.target === drawerRef.current) setDrawerOpen(false);
        }}
      >
        <div className="rt-drawer-sheet">
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white border border-[#d3d9c4]"
              autoFocus
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <SidebarNavContent pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
        </div>
      </dialog>

      {/* Main Content Area */}
      <main
        id="main-content"
        className={`rt-main ${sidebarCollapsed ? "full-width" : ""}`}
        tabIndex={-1}
      >
        <header className="rt-topbar">
          <div className="flex items-start gap-3">
            {/* Desktop Slide Toggle */}
            <button
              type="button"
              className="rt-desktop-sidebar-btn"
              aria-label={sidebarCollapsed ? "Show sidebar drawer" : "Hide sidebar drawer"}
              aria-expanded={!sidebarCollapsed}
              title={sidebarCollapsed ? "Show sidebar drawer" : "Hide sidebar drawer"}
              onClick={() => setSidebarCollapsed((c) => !c)}
            >
              {sidebarCollapsed ? (
                <PanelLeft size={16} aria-hidden="true" />
              ) : (
                <PanelLeftClose size={16} aria-hidden="true" />
              )}
            </button>

            {/* Mobile Menu Trigger */}
            <button
              type="button"
              className="rt-mobile-menu-btn"
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
            >
              <Menu size={16} aria-hidden="true" />
              <span>Menu</span>
            </button>

            <div>
              <div className="rt-eyebrow">{meta.eyebrow}</div>
              <h2>{meta.title}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="rt-pill" title="Live audio engine status">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  background: health?.kokoro.ready
                    ? "#526e50"
                    : health?.kokoro.loading
                      ? "#c8a35f"
                      : "#99a495",
                }}
              />
              {health?.kokoro.ready
                ? "Voice Audio Ready"
                : health?.kokoro.loading
                  ? "Voice Warming Up"
                  : "Voice Active"}
            </span>
            <span className="rt-pill">Vision Telemetry Active</span>
            <button type="button" className="rt-btn" onClick={() => navigate("/registration")}>
              <Plus size={14} aria-hidden="true" />
              New interview
            </button>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
