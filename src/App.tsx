import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ToastProvider } from "./components/ToastContext";
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
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
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
