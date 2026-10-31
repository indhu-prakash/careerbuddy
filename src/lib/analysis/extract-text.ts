// Plain text from an uploaded resume or JD. Shared by the CLI (scripts/analyze.ts)
// and POST /api/v1/analyze. Files are parsed in memory and never written anywhere.

export type DocKind = "pdf" | "docx" | "text";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Pick a parser from the file name, falling back to the MIME type. Null = unsupported. */
export function docKind(name: string, mimeType = ""): DocKind | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf" || mimeType === "application/pdf") return "pdf";
  if (ext === "docx" || mimeType === DOCX_MIME) return "docx";
  if (["txt", "md"].includes(ext) || mimeType.startsWith("text/")) return "text";
  return null;
}

export async function extractText(data: Uint8Array, kind: DocKind): Promise<string> {
  if (kind === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data });
    try {
      return (await parser.getText()).text.trim();
    } finally {
      await parser.destroy();
    }
  }
  if (kind === "docx") {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ buffer: Buffer.from(data) })).value.trim();
  }
  return new TextDecoder().decode(data).trim();
}
