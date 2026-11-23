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
  InteractiveAgentShowcaseCanvas: ({ member }: { member: { name: string } }) => (
    <div data-testid={`mock-agent-3d-${member.name}`} />
  ),
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

describe("RoundTable Landing Pages, Authentication Gate & Unified Routing", () => {
  it("renders minimalistic Landing Home at / with separate section links and Explore RoundTable CTA to /login", () => {
    renderRoute("/", null);

    expect(screen.getByRole("heading", { name: /Prepare with intention\./i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^Home$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /^About$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /^Agents$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /^Benefits$/i }).length).toBeGreaterThan(0);

    const exploreLinks = screen.getAllByRole("link", { name: /Explore RoundTable/i });
    expect(exploreLinks.length).toBeGreaterThan(0);
    expect(exploreLinks[0]).toHaveAttribute("href", "/login");
  });

  it("renders separate About, Agents (with all 5 interactive 3D Roblox characters), and Benefits pages", () => {
    const aboutView = renderRoute("/about", null);
    expect(screen.getByText(/Why Traditional Prep Falls Short/i)).toBeInTheDocument();
    aboutView.unmount();

    const agentsView = renderRoute("/agents", null);
    expect(screen.getByTestId("mock-agent-3d-Nikhil")).toBeInTheDocument();
    expect(screen.getByTestId("mock-agent-3d-ananya")).toBeInTheDocument();
    expect(screen.getByTestId("mock-agent-3d-Daniel")).toBeInTheDocument();
    expect(screen.getByTestId("mock-agent-3d-sarah")).toBeInTheDocument();
    expect(screen.getByTestId("mock-agent-3d-Marcus")).toBeInTheDocument();
    agentsView.unmount();

    const benefitsView = renderRoute("/benefits", null);
    expect(screen.getByText(/Preparing alone vs\. preparing at RoundTable/i)).toBeInTheDocument();
    benefitsView.unmount();
  });

  it("renders Login & Sign Up at /login with Name, Gmail, Phone Number, Password and card fade transition", () => {
    renderRoute("/login", null);

    expect(screen.getByText(/Sign in to RoundTable/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Username$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Access RoundTable/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Sign Up/i }));
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Gmail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Account/i })).toBeInTheDocument();
  });

  it("renders Overview at / when authenticated with signed-in user info, sign out, and all 5 panel agents", () => {
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
    expect(screen.queryByRole("heading", { name: "Interview Panel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Conversation" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Weather and time atmosphere settings/i)).toBeInTheDocument();
  });

  it("verifies sidebar has only 1 collapsible button and section links are properly rendered", () => {
    renderRoute("/");
    const hideBtn = screen.getByRole("button", { name: /Hide sidebar drawer/i });
    expect(hideBtn).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /Hide sidebar drawer/i }).length).toBe(1);

    expect(screen.getByRole("link", { name: /Overview/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Interview Registration/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Interview Room/i })).toBeInTheDocument();
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
