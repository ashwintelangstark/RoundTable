import { describe, expect, it } from "vitest";
import { INTERVIEW_PANEL } from "./team";

describe("the requested interview panel", () => {
  it("preserves all five interviewer names and designations in order", () => {
    expect(INTERVIEW_PANEL.map(({ name, title }) => `${title} — ${name}`)).toEqual([
      "JD & Company Decoder Agent — Nikhil",
      "Resume Gap & Strength Analyst Agent — ananya",
      "Technical System Design Interviewer Agent — Daniel",
      "Behavioral & Culture Fit Interviewer Agent — sarah",
      "Hiring Bar Raiser Agent — Marcus",
    ]);
  });
});