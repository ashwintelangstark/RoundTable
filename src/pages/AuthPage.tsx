import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
  UserPlus,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthContext";
import { useToast } from "@/components/ToastContext";
import { api } from "@/lib/api";

type AuthMode = "login" | "signup";

const PANEL_PREVIEW = [
  { name: "Nikhil", role: "Strategy & Role Alignment" },
  { name: "ananya", role: "Resume Storytelling" },
  { name: "Daniel", role: "Problem Solving & Depth" },
  { name: "sarah", role: "Leadership & Presence" },
  { name: "Marcus", role: "Final Hiring Readiness" },
];

export function AuthPage() {
  const { loginWithCredentials } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>("login");

  // Login state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginPending, setLoginPending] = useState(false);

  // Sign-up state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupPending, setSignupPending] = useState(false);

  // Inline feedback & confirmation banner
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signupConfirmation, setSignupConfirmation] = useState<{
    name: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    document.title = `${mode === "login" ? "Sign In" : "Create Account"} | RoundTable`;
  }, [mode]);

  function switchMode(next: AuthMode) {
    setMode(next);
    setErrorMessage(null);
  }

  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    const trimmedUser = loginUsername.trim();
    if (!trimmedUser || !loginPassword) {
      setErrorMessage("Please enter your username and password.");
      return;
    }

    setLoginPending(true);
    try {
      const signedIn = await loginWithCredentials(trimmedUser, loginPassword);
      notify(`Welcome to RoundTable, ${signedIn.name}!`);
      navigate("/", { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to sign in. Please try again.";
      setErrorMessage(msg);
    } finally {
      setLoginPending(false);
    }
  }

  async function handleSignupSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const name = signupName.trim();
    const email = signupEmail.trim().toLowerCase();
    const phone = signupPhone.trim();

    if (name.length < 2) {
      setErrorMessage("Please enter your full name (at least 2 characters).");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMessage("Please enter a valid Gmail address.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 7) {
      setErrorMessage("Please enter a valid phone number.");
      return;
    }
    if (signupPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setSignupPending(true);
    try {
      const res = await api.signup({
        name,
        email,
        phone,
        password: signupPassword,
      });

      setSignupConfirmation({
        name: res.user.name,
        email: res.user.email,
      });
      setSignupName("");
      setSignupEmail("");
      setSignupPhone("");
      setSignupPassword("");
      setLoginUsername("");
      setLoginPassword("");
      setMode("login");
      notify(`Account created for ${res.user.name}. Please sign in to access RoundTable.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not create account.";
      setErrorMessage(msg);
    } finally {
      setSignupPending(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col justify-center p-4 sm:p-6 lg:p-10">
      {/* Subtle Top Return Bar */}
      <div className="w-full max-w-5xl mx-auto mb-5 flex items-center justify-between gap-3 rt-auth-card-fade">
        <Link
          to="/"
          className="rt-pill no-underline hover:bg-white/85 transition-colors inline-flex items-center gap-1.5"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          <span>Back to Home</span>
        </Link>
        <div className="hidden sm:flex items-center gap-2">
          <Link to="/about" className="rt-pill no-underline hover:bg-white/85 transition-colors">
            About
          </Link>
          <Link to="/agents" className="rt-pill no-underline hover:bg-white/85 transition-colors">
            Agents
          </Link>
          <Link to="/benefits" className="rt-pill no-underline hover:bg-white/85 transition-colors">
            Benefits
          </Link>
        </div>
      </div>

      <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Glass Brand & 5-Agent Showcase with Fade Entrance */}
        <section className="rt-glass-hero rt-auth-card-fade lg:col-span-6 p-7 sm:p-9 flex flex-col justify-between gap-6">
          <div>
            <div className="flex items-center gap-3.5 mb-7">
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
                <div className="font-serif-display text-2xl font-semibold leading-tight text-[#1c2c1e]">
                  RoundTable
                </div>
                <div className="text-[10px] tracking-[2px] uppercase font-bold text-[#526e50]">
                  CAREER INTELLIGENCE STUDIO
                </div>
              </div>
            </div>

            <span className="rt-tag mb-4">
              <Sparkles size={11} aria-hidden="true" />
              5-AGENT 3D INTERVIEW PANEL
            </span>

            <h1 className="font-serif-display text-3xl sm:text-4xl font-medium leading-[1.15] text-[#1c2c1e] mt-2 mb-4">
              Prepare with intention.
              <br />
              <em className="font-serif-display italic text-[#2f4e32]">
                Interview with confidence.
              </em>
            </h1>

            <p className="text-sm text-[#435443] leading-relaxed">
              Enter your private career studio to decode job descriptions, strengthen your resume,
              practice live voice-to-voice interviews in a virtual boardroom with calm camera
              guidance, and track hiring readiness across every attempt.
            </p>
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-bold tracking-[1.6px] uppercase text-[#566a55]">
              Your 5 AI Panelists
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PANEL_PREVIEW.map((agent) => (
                <div
                  key={agent.name}
                  className="rt-glass-inset px-3.5 py-2.5 flex items-center justify-between gap-2"
                >
                  <span className="text-xs font-semibold text-[#1e3120]">{agent.name}</span>
                  <span className="text-[11px] text-[#556855] truncate">{agent.role}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2 text-[11px] text-[#4c5f4c]">
              <ShieldCheck size={14} className="text-[#365a38] shrink-0" aria-hidden="true" />
              <span>Private studio workspace — create your account and sign in right away.</span>
            </div>
          </div>
        </section>

        {/* Right Glass Authentication Card with Smooth Staggered Fade Transition */}
        <section className="rt-card rt-auth-card-fade-delay lg:col-span-6 p-7 sm:p-9 flex flex-col justify-center">
          <div className="mb-6">
            <div className="rt-eyebrow mb-1">
              {mode === "login" ? "Member Access" : "Create Your Studio Account"}
            </div>
            <h2 className="font-serif-display text-2xl sm:text-3xl font-medium text-[#1c2c1e] m-0">
              {mode === "login" ? "Sign in to RoundTable" : "Join RoundTable"}
            </h2>
            <p className="text-xs text-[#556754] mt-1.5 mb-0">
              {mode === "login"
                ? "Enter your username (or Gmail) and password to access your workspace."
                : "Fill in your name, Gmail, phone number, and password to create your account."}
            </p>
          </div>

          {/* Segmented Glass Mode Switcher */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="rt-glass-inset p-1.5 grid grid-cols-2 gap-1.5 mb-6 rounded-full"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              onClick={() => switchMode("login")}
              className={`py-2.5 px-4 rounded-full text-xs font-semibold transition-all ${
                mode === "login"
                  ? "bg-white/90 text-[#1c2c1e] shadow-sm border border-white"
                  : "text-[#4e614e] hover:text-[#1c2c1e]"
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              onClick={() => switchMode("signup")}
              className={`py-2.5 px-4 rounded-full text-xs font-semibold transition-all ${
                mode === "signup"
                  ? "bg-white/90 text-[#1c2c1e] shadow-sm border border-white"
                  : "text-[#4e614e] hover:text-[#1c2c1e]"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Confirmation Banner after Sign Up */}
          {signupConfirmation && mode === "login" && (
            <div
              role="status"
              className="mb-5 rounded-2xl border border-[#8db38a]/70 bg-[#eef7ec]/85 backdrop-blur-md p-4 text-xs text-[#203c22] rt-auth-panel-fade"
            >
              <div className="flex items-start gap-2.5">
                <CheckCircle2
                  size={16}
                  className="text-[#2e6433] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="space-y-1 min-w-0">
                  <div className="font-semibold text-[#1a341d]">
                    Account created for {signupConfirmation.name}!
                  </div>
                  <p className="m-0 font-medium text-[#1f3b22] leading-relaxed">
                    Enter your username (
                    <span className="font-semibold">{signupConfirmation.name}</span> or{" "}
                    <span className="font-semibold">{signupConfirmation.email}</span>) and password
                    below to enter RoundTable.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 rounded-2xl border border-[#d9948c]/80 bg-[#fcebe9]/90 px-4 py-3 text-xs font-medium text-[#8b3027] rt-auth-panel-fade"
            >
              {errorMessage}
            </div>
          )}

          {mode === "login" ? (
            <form
              key="login-form"
              onSubmit={handleLoginSubmit}
              noValidate
              className="rt-auth-panel-fade"
            >
              <div className="rt-field">
                <label htmlFor="login-username">Username</label>
                <div className="relative">
                  <User
                    size={15}
                    aria-hidden="true"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5c705b] pointer-events-none"
                  />
                  <input
                    id="login-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder={
                      signupConfirmation
                        ? `Enter ${signupConfirmation.name} or ${signupConfirmation.email}`
                        : "Enter your username or Gmail"
                    }
                    className="rt-control !pl-10"
                  />
                </div>
                <span className="rt-field-hint">
                  Use the name or Gmail you registered with during sign up.
                </span>
              </div>

              <div className="rt-field">
                <label htmlFor="login-password">Password</label>
                <div className="relative">
                  <Lock
                    size={15}
                    aria-hidden="true"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5c705b] pointer-events-none"
                  />
                  <input
                    id="login-password"
                    name="password"
                    type={showLoginPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="rt-control !pl-10 !pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    aria-label={showLoginPassword ? "Hide password" : "Show password"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#556855] hover:bg-white/60"
                  >
                    {showLoginPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loginPending} className="rt-btn w-full mt-2">
                {loginPending ? "Signing in..." : "Access RoundTable"}
                <ArrowRight size={15} aria-hidden="true" />
              </button>

              <p className="text-center text-xs text-[#556855] mt-5 mb-0">
                Don&apos;t have an account yet?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="font-semibold text-[#29492c] underline underline-offset-2 hover:text-[#1b331d]"
                >
                  Create an account
                </button>
              </p>
            </form>
          ) : (
            <form
              key="signup-form"
              onSubmit={handleSignupSubmit}
              noValidate
              className="rt-auth-panel-fade"
            >
              <div className="rt-field">
                <label htmlFor="signup-name">Full Name</label>
                <div className="relative">
                  <User
                    size={15}
                    aria-hidden="true"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5c705b] pointer-events-none"
                  />
                  <input
                    id="signup-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder="Enter your full name"
                    className="rt-control !pl-10"
                  />
                </div>
                <span className="rt-field-hint">
                  You can use your name or Gmail as your username when logging in.
                </span>
              </div>

              <div className="rt-field">
                <label htmlFor="signup-email">Gmail</label>
                <div className="relative">
                  <Mail
                    size={15}
                    aria-hidden="true"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5c705b] pointer-events-none"
                  />
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="yourname@gmail.com"
                    className="rt-control !pl-10"
                  />
                </div>
              </div>

              <div className="rt-field">
                <label htmlFor="signup-phone">Phone Number</label>
                <div className="relative">
                  <Phone
                    size={15}
                    aria-hidden="true"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5c705b] pointer-events-none"
                  />
                  <input
                    id="signup-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="rt-control !pl-10"
                  />
                </div>
              </div>

              <div className="rt-field">
                <label htmlFor="signup-password">Password</label>
                <div className="relative">
                  <Lock
                    size={15}
                    aria-hidden="true"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5c705b] pointer-events-none"
                  />
                  <input
                    id="signup-password"
                    name="password"
                    type={showSignupPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Create a password (min. 6 characters)"
                    className="rt-control !pl-10 !pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword((prev) => !prev)}
                    aria-label={showSignupPassword ? "Hide password" : "Show password"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#556855] hover:bg-white/60"
                  >
                    {showSignupPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={signupPending} className="rt-btn w-full mt-2">
                <UserPlus size={15} aria-hidden="true" />
                {signupPending ? "Creating account..." : "Create Account"}
              </button>

              <p className="text-center text-xs text-[#556855] mt-5 mb-0">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="font-semibold text-[#29492c] underline underline-offset-2 hover:text-[#1b331d]"
                >
                  Log in
                </button>
              </p>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
