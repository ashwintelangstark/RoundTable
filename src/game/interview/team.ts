export const INTERVIEW_PANEL = [
  { name: "Nikhil", title: "JD & Company Decoder Agent", initials: "N", avatar: "analyst" },
  { name: "ananya", title: "Resume Gap & Strength Analyst Agent", initials: "a", avatar: "recruiter" },
  { name: "Daniel", title: "Technical System Design Interviewer Agent", initials: "D", avatar: "engineer" },
  { name: "sarah", title: "Behavioral & Culture Fit Interviewer Agent", initials: "s", avatar: "people" },
  { name: "Marcus", title: "Hiring Bar Raiser Agent", initials: "M", avatar: "leader" },
] as const;

export type PanelMember = (typeof INTERVIEW_PANEL)[number];