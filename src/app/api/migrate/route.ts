import { z } from "zod";
import { getOptionalUser } from "@/lib/auth/session";
import { suggestMapping, type MappingSuggestion } from "@/lib/domain/migrate";
import { refineMapping } from "@/lib/ai/extract";

const Body = z.object({
  headers: z.array(z.string().max(200)).min(1).max(200),
  sample: z.array(z.array(z.string().max(500)).max(200)).max(25),
});

export type MapResponse = { engine: "claude" | "heuristic"; suggestions: MappingSuggestion[]; notes: string[] };

/** Suggest a column mapping: heuristic first pass, refined by Claude when available. */
export async function POST(req: Request) {
  if (!(await getOptionalUser())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const { headers, sample } = parsed.data;
  const heuristic = suggestMapping(headers, sample);
  const refined = await refineMapping(headers, sample, heuristic);
  const body: MapResponse = refined
    ? { engine: "claude", suggestions: refined.suggestions, notes: refined.notes }
    : { engine: "heuristic", suggestions: heuristic, notes: [] };
  return Response.json(body);
}
