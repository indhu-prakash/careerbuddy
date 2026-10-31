import { describe, expect, it } from "vitest";
import { docKind, extractText } from "@/lib/analysis/extract-text";

describe("docKind", () => {
  it("detects by extension, then MIME type", () => {
    expect(docKind("cv.PDF")).toBe("pdf");
    expect(docKind("cv.docx")).toBe("docx");
    expect(docKind("jd.txt")).toBe("text");
    expect(docKind("blob", "application/pdf")).toBe("pdf");
    expect(docKind("notes", "text/plain")).toBe("text");
  });

  it("rejects unsupported files", () => {
    expect(docKind("cv.doc", "application/msword")).toBeNull();
    expect(docKind("photo.png", "image/png")).toBeNull();
  });
});

describe("extractText", () => {
  it("decodes and trims plain text", async () => {
    expect(await extractText(new TextEncoder().encode("  Senior engineer\n"), "text")).toBe("Senior engineer");
  });
});
