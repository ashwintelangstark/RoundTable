import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AuthProvider, useAuth } from "./components/AuthContext";
import { ToastProvider } from "./components/ToastContext";
import { AuthPage } from "./pages/AuthPage";
import { BehavioralPage } from "./pages/BehavioralPage";
import { CareerPage } from "./pages/CareerPage";
import { InterviewRoomPage } from "./pages/InterviewRoomPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ReadinessPage } from "./pages/ReadinessPage";
import { RegistrationPage } from "./pages/RegistrationPage";
import { ResumePage } from "./pages/ResumePage";
import { TechnicalPage } from "./pages/TechnicalPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="rt-card px-8 py-6 flex items-center gap-3.5">
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
            <div className="font-serif-display text-lg font-medium text-[#1c2c1e]">RoundTable</div>
            <div className="text-xs text-[#556855]">Restoring your studio session...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/registration" element={<RegistrationPage />} />
        <Route path="/room" element={<InterviewRoomPage />} />
        <Route path="/career" element={<CareerPage />} />
        <Route path="/resume" element={<ResumePage />} />
        <Route path="/technical" element={<TechnicalPage />} />
        <Route path="/behavioral" element={<BehavioralPage />} />
        <Route path="/readiness" element={<ReadinessPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
        {!import.meta.env["VITEST"] && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}
      </ToastProvider>
    </QueryClientProvider>
  );
}
