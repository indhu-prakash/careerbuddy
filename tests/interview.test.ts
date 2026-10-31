import { describe, expect, it } from "vitest";
import { scoreAnswer } from "@/lib/scoring/interview";
import { audioFormat } from "@/lib/ai/transcribe";

const RUBRIC = [{ criterion: "Correctness" }, { criterion: "Depth" }, { criterion: "Communication" }];

describe("scoreAnswer", () => {
  it("maps the 1-5 mean onto 0-100", () => {
    const all5 = RUBRIC.map((r) => ({ criterion: r.criterion, score: 5, comment: "" }));
    expect(scoreAnswer(RUBRIC, all5).overallScore).toBe(100);
    const all1 = RUBRIC.map((r) => ({ criterion: r.criterion, score: 1, comment: "" }));
    expect(scoreAnswer(RUBRIC, all1).overallScore).toBe(0);
  });

  it("follows the rubric: ignores extra criteria, counts missing ones as 1", () => {
    const { criteria, overallScore } = scoreAnswer(RUBRIC, [
      { criterion: "correctness ", score: 5, comment: "ok" },
      { criterion: "Communication", score: 5, comment: "ok" },
      { criterion: "Charisma", score: 5, comment: "not in rubric" },
    ]);
    expect(criteria.map((c) => c.criterion)).toEqual(["Correctness", "Depth", "Communication"]);
    expect(criteria[1]).toEqual({ criterion: "Depth", score: 1, comment: "Not assessed." });
    expect(overallScore).toBe(67); // mean 11/3 → (3.667-1)/4
  });

  it("clamps out-of-range scores", () => {
    const { criteria } = scoreAnswer([{ criterion: "Depth" }], [{ criterion: "Depth", score: 9, comment: "" }]);
    expect(criteria[0].score).toBe(5);
  });
});

describe("audioFormat", () => {
  it("maps browser recording MIME types", () => {
    expect(audioFormat("audio/webm;codecs=opus")).toBe("webm");
    expect(audioFormat("audio/mp4")).toBe("m4a");
    expect(audioFormat("audio/wav")).toBe("wav");
    expect(audioFormat("video/mp4")).toBeNull();
    expect(audioFormat("")).toBeNull();
  });
});
