import { z } from "zod";
import { getOptionalUser } from "@/lib/auth/session";
import { runCopilot, type CopilotEvent } from "@/lib/ai/copilot";

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) }))
    .min(1)
    .max(40)
    .refine((m) => m[0].role === "user" && m[m.length - 1].role === "user", "Conversation must start and end with a user turn"),
});

export const maxDuration = 120;

/** Streams copilot events as Server-Sent Events. */
export async function POST(req: Request) {
  const user = await getOptionalUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Bad request" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: CopilotEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          // client went away
        }
      };
      try {
        await runCopilot(parsed.data.messages, user, emit, req.signal);
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
