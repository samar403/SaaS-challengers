import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { MODEL, withFallback, describeAiError, getClaude } from "./client";
import { BRIEF_SYSTEM, EXTRACT_SYSTEM, MAPPER_SYSTEM } from "./prompts";
import { ExtractionSchema, extractOffline, type Extraction } from "@/lib/domain/documents";
import { TARGET_KEYS, type MappingSuggestion } from "@/lib/domain/migrate";

export type ExtractInput =
  | { kind: "text"; text: string }
  | { kind: "pdf"; base64: string }
  | { kind: "image"; base64: string; mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif" };

export type ExtractResult = { extraction: Extraction; engine: "claude" | "offline"; note?: string };

/** Structured extraction with Claude; falls back to the offline parser for text when Claude is unavailable. */
export async function extractDocument(input: ExtractInput): Promise<ExtractResult> {
  const client = getClaude();
  if (!client) {
    if (input.kind !== "text") throw new Error("PDF and image extraction need Claude — set ANTHROPIC_API_KEY, or paste the text.");
    return { extraction: extractOffline(input.text), engine: "offline" };
  }

  const source: Anthropic.Beta.BetaContentBlockParam =
    input.kind === "text"
      ? { type: "text", text: `<document>\n${input.text}\n</document>` }
      : input.kind === "pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: input.base64 } }
        : { type: "image", source: { type: "base64", media_type: input.mediaType, data: input.base64 } };

  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: EXTRACT_SYSTEM,
      output_config: { effort: "low", format: betaZodOutputFormat(ExtractionSchema) },
      messages: [{ role: "user", content: [source, { type: "text", text: "Extract this document." }] }],
      ...withFallback(),
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      throw new Error("Claude could not extract this document.");
    }
    return { extraction: response.parsed_output, engine: "claude" };
  } catch (err) {
    if (input.kind === "text") {
      return { extraction: extractOffline(input.text), engine: "offline", note: `${describeAiError(err)} Used offline parser.` };
    }
    throw new Error(describeAiError(err));
  }
}

const MappingSchema = z.object({
  mappings: z.array(
    z.object({
      field: z.enum(TARGET_KEYS as [string, ...string[]]),
      column: z.string().nullable(),
      confidence: z.number(),
      reason: z.string().describe("Short justification, e.g. 'SAP MINBE = reorder point'"),
    }),
  ),
  notes: z.array(z.string()).describe("Data-quality issues spotted in the sample (units, padding, decimal commas, mixed types)"),
});

/** Ask Claude to refine the heuristic mapping. Returns null when offline or on error. */
export async function refineMapping(
  headers: string[],
  sample: string[][],
  heuristic: MappingSuggestion[],
): Promise<{ suggestions: MappingSuggestion[]; notes: string[] } | null> {
  const client = getClaude();
  if (!client) return null;
  const csv = [headers, ...sample.slice(0, 8)].map((r) => r.join(" | ")).join("\n");
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: MAPPER_SYSTEM,
      output_config: { effort: "low", format: betaZodOutputFormat(MappingSchema) },
      messages: [
        {
          role: "user",
          content: `Lathe fields: ${TARGET_KEYS.join(", ")}\n\nHeuristic first pass (may be wrong):\n${heuristic
            .map((h) => `${h.field} ← ${h.column ?? "null"} (${h.confidence})`)
            .join("\n")}\n\nCSV sample:\n${csv}`,
        },
      ],
      ...withFallback(),
    });
    const out = response.parsed_output;
    if (!out) return null;
    const valid = new Set(headers);
    const used = new Set<string>();
    const suggestions = TARGET_KEYS.map((field) => {
      const m = out.mappings.find((x) => x.field === field);
      const column = m?.column && valid.has(m.column) && !used.has(m.column) ? m.column : null;
      if (column) {
        used.add(column);
        return { field, column, confidence: Math.max(0, Math.min(1, m!.confidence)), reason: m!.reason };
      }
      const h = heuristic.find((x) => x.field === field && x.column && !used.has(x.column));
      if (h?.column) {
        used.add(h.column);
        return h;
      }
      return { field, column: null, confidence: 0, reason: m?.reason ?? "No matching column" };
    });
    return { suggestions, notes: out.notes };
  } catch {
    return null;
  }
}

/** Start-of-shift brief. Returns null in offline mode so the UI renders its template. */
export async function writeShiftBrief(snapshotJson: string): Promise<string | null> {
  const client = getClaude();
  if (!client) return null;
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: BRIEF_SYSTEM,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: snapshotJson }],
      ...withFallback(),
    });
    if (response.stop_reason === "refusal") return null;
    return (
      response.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim() || null
    );
  } catch {
    return null;
  }
}
