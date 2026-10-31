// Evidence quotes from the LLM must appear in the source text. Comparison ignores
// case, whitespace, bullet characters and typographic quotes/dashes, since PDF/DOCX
// extraction mangles those; otherwise it's a verbatim substring check.

const MIN_QUOTE_CHARS = 4;

function loose(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/[•●▪◦·*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True if `quote` appears in `source`. A quote the model shortened with "..." passes
 * when every part appears in order.
 */
export function quoteInSource(source: string, quote: string | null | undefined): boolean {
  if (!quote) return false;
  const src = loose(source);
  const parts = loose(quote)
    .split(/\s*(?:\.{3}|…)\s*/)
    .map((p) => p.replace(/^["']+|["']+$/g, "").trim())
    .filter(Boolean);
  if (parts.length === 0 || parts.join("").length < MIN_QUOTE_CHARS) return false;

  let from = 0;
  for (const part of parts) {
    const at = src.indexOf(part, from);
    if (at < 0) return false;
    from = at + part.length;
  }
  return true;
}

/** The quote if it's verifiably in the source, otherwise null. */
export function verifiedQuote(source: string, quote: string | null | undefined): string | null {
  return quoteInSource(source, quote) ? quote!.trim() : null;
}
