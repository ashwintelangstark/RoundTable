import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/App";
import { AuthProvider } from "@/components/AuthContext";
import { ToastProvider } from "@/components/ToastContext";
import type { AuthUser } from "@/lib/api";

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children?: ReactNode }) => (
    <div data-testid="mock-three-canvas">{children}</div>
  ),
  useFrame: () => {},
  useThree: () => ({
    camera: {
      fov: 50,
      position: { set: () => {} },
      lookAt: () => {},
      updateProjectionMatrix: () => {},
    },
    size: { width: 1024, height: 600 },
  }),
}));

vi.mock("@/game/interview/room", () => ({
  InterviewRoom: () => <div data-testid="mock-interview-room" />,
}));

const MOCK_USER: AuthUser = {
  id: 1,
  name: "Ashwin Telang",
  username: "Ashwin Telang",
  email: "ashwin@gmail.com",
  phone: "+91 98765 43210",
  created_at: "2026-11-23T00:00:00.000Z",
};

function renderRoute(initialEntry: string, initialUser: AuthUser | null = MOCK_USER) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AuthProvider initialUser={initialUser}>
          <MemoryRouter initialEntries={[initialEntry]}>
            <AppRoutes />
          </MemoryRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("RoundTable Authentication Gate & Unified Routing", () => {
  it("shows the Authentication page (Login & Sign Up with Name, Gmail, Phone, Password) before accessing the web app", () => {
    renderRoute("/", null);

    // Login tab shown initially
    expect(screen.getByText(/Sign in to RoundTable/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Username$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Access RoundTable/i })).toBeInTheDocument();

    // Switch to Sign Up tab and verify all required fields
    fireEvent.click(screen.getByRole("tab", { name: /Sign Up/i }));
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Gmail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Account/i })).toBeInTheDocument();
  });

  it("renders Overview at / with RoundTable branding, signed-in user info, sign out, and all 5 panel agents", () => {
    renderRoute("/");
    expect(screen.getAllByText(/RoundTable/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nikhil").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ananya").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Daniel").length).toBeGreaterThan(0);
    expect(screen.getAllByText("sarah").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Marcus").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ashwin Telang").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Sign out/i }).length).toBeGreaterThan(0);
  });

  it("renders Interview Registration section at /registration", () => {
    renderRoute("/registration");
    expect(screen.getByText(/Register an interview/i)).toBeInTheDocument();
    expect(screen.getByText(/My interviews/i)).toBeInTheDocument();
  });

  it("renders 3D Interview Room section at /room with Candidate Vision and table prompt without right sidebar blocks", () => {
    renderRoute("/room");
    expect(screen.getByTestId("mock-three-canvas")).toBeInTheDocument();
    expect(screen.getByText(/Candidate Vision/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Click the conference table/i).length).toBeGreaterThan(0);
    // Verified that the right-side conversation and interview panel blocks are removed
    expect(screen.queryByRole("heading", { name: "Interview Panel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Conversation" })).not.toBeInTheDocument();
    // Verified dynamic weather badge trigger is rendered
    expect(screen.getByLabelText(/Weather and time atmosphere settings/i)).toBeInTheDocument();
  });

  it("verifies sidebar has only 1 collapsible button and section links are properly rendered", () => {
    renderRoute("/");
    // Exactly 1 desktop sidebar drawer toggle button
    const hideBtn = screen.getByRole("button", { name: /Hide sidebar drawer/i });
    expect(hideBtn).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /Hide sidebar drawer/i }).length).toBe(1);

    // Verify workspace nav links are rendered
    const overviewLink = screen.getByRole("link", { name: /Overview/i });
    expect(overviewLink).toBeInTheDocument();

    const registrationLink = screen.getByRole("link", { name: /Interview Registration/i });
    expect(registrationLink).toBeInTheDocument();

    const roomLink = screen.getByRole("link", { name: /Interview Room/i });
    expect(roomLink).toBeInTheDocument();
  });

  it("renders all 5 specialist development sections", () => {
    renderRoute("/career");
    expect(screen.getByText(/Role Expectations Decoder/i)).toBeInTheDocument();

    renderRoute("/resume");
    expect(screen.getByText(/Audit & elevate your resume/i)).toBeInTheDocument();

    renderRoute("/technical");
    expect(screen.getByText(/Daniel asks/i)).toBeInTheDocument();

    renderRoute("/behavioral");
    expect(screen.getByText(/Sarah asks/i)).toBeInTheDocument();

    renderRoute("/readiness");
    expect(screen.getByText(/Enter 3D Interview Room/i)).toBeInTheDocument();
  });
});
