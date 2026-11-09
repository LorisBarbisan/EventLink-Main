// ── PDF extraction via OpenAI ─────────────────────────────────────────────────
// Sends PDF text to GPT-4o-mini and asks it to return structured transaction
// rows. All extracted rows are tagged low_confidence_extraction so the user
// must approve them one-by-one — no bulk approve allowed for AI-extracted rows.

import OpenAI from "openai";

export interface AiExtractedRow {
  date: string; // best-effort ISO YYYY-MM-DD (may be empty string)
  description: string;
  amount: string; // raw string from the PDF, e.g. "−123.45" or "1,234.00"
  reference?: string;
}

const SYSTEM_PROMPT = `You are a financial data extraction assistant. The user will give you the raw text of a PDF bank statement or financial document. Extract every transaction row you can find.

Return ONLY a valid JSON array — no markdown, no commentary, no code fences. Each element must have these keys:
- "date": the transaction date as YYYY-MM-DD if possible, or the raw date string if the year is unclear; empty string if no date found
- "description": the payee name or transaction description
- "amount": the amount as a string exactly as it appears in the document, including sign if present (e.g. "-123.45", "1,234.56"); positive for credits/income, negative for debits/expenses
- "reference": the reference or transaction ID if present (omit if none)

Skip: opening/closing balance lines, running balance figures, header/footer text, page numbers, bank logo lines, account holder name/address lines.
Include: every transaction that has a date + description + amount.`;

export async function extractRowsFromPdf(text: string): Promise<AiExtractedRow[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set — PDF AI extraction is unavailable");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Truncate to ~12 000 chars to stay well inside the context window for large PDFs
  const truncated = text.length > 12_000 ? text.slice(0, 12_000) + "\n[truncated]" : text;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: truncated },
    ],
  });

  const raw = (response.choices[0]?.message?.content ?? "").trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is AiExtractedRow =>
        typeof r === "object" &&
        r !== null &&
        typeof r.description === "string" &&
        typeof r.amount === "string"
    );
  } catch {
    // Model returned non-JSON — log and return empty rather than crashing
    console.warn("[import-pdf-ai] Failed to parse OpenAI response as JSON:", raw.slice(0, 200));
    return [];
  }
}
