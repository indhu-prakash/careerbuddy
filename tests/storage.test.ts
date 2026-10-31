import { describe, expect, it } from "vitest";
import { createResumeDownloadUrl, resumeObjectPath } from "@/lib/storage";

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

describe("resume storage paths", () => {
  it("puts every object under the owner's folder", () => {
    expect(resumeObjectPath(ALICE, "r1", "application/pdf")).toBe(`${ALICE}/r1/resume.pdf`);
    expect(
      resumeObjectPath(
        ALICE,
        "r1",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(`${ALICE}/r1/resume.docx`);
  });

  it("refuses to sign another user's file", async () => {
    await expect(createResumeDownloadUrl(BOB, `${ALICE}/r1/resume.pdf`)).rejects.toThrow(
      /does not belong/,
    );
  });

  it("refuses path traversal", async () => {
    await expect(createResumeDownloadUrl(ALICE, `${ALICE}/../${BOB}/r1/resume.pdf`)).rejects.toThrow(
      /does not belong/,
    );
  });
});
