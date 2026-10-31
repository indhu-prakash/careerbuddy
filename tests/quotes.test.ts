import { describe, expect, it } from "vitest";
import { quoteInSource, verifiedQuote } from "@/lib/analysis/quotes";

const resume = `EXPERIENCE
• Built a React + TypeScript dashboard used by 20k users — Acme (2022–2025)
• Wrote “REST API” integrations and Jest unit tests`;

describe("quoteInSource", () => {
  it("accepts verbatim quotes regardless of case, spacing, bullets and typographic marks", () => {
    expect(quoteInSource(resume, "built a react + typescript dashboard")).toBe(true);
    expect(quoteInSource(resume, "used by 20k users - Acme (2022-2025)")).toBe(true);
    expect(quoteInSource(resume, 'Wrote "REST API" integrations')).toBe(true);
  });

  it("accepts quotes shortened with an ellipsis when the parts are in order", () => {
    expect(quoteInSource(resume, "Built a React ... dashboard used by 20k users")).toBe(true);
    expect(quoteInSource(resume, "dashboard used by 20k users … Built a React")).toBe(false);
  });

  it("rejects invented or empty quotes", () => {
    expect(quoteInSource(resume, "Led a team of 10 engineers")).toBe(false);
    expect(quoteInSource(resume, "")).toBe(false);
    expect(quoteInSource(resume, null)).toBe(false);
    expect(quoteInSource(resume, "...")).toBe(false);
  });

  it("verifiedQuote returns the trimmed quote or null", () => {
    expect(verifiedQuote(resume, "  Jest unit tests ")).toBe("Jest unit tests");
    expect(verifiedQuote(resume, "Kubernetes")).toBeNull();
  });
});
