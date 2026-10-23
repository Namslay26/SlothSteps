import type { z } from "zod";
import { slothStepsAgent } from "../agents/slothsteps-agent";
import type { RunStats } from "@/lib/metrics";

type Prompt = Parameters<typeof slothStepsAgent.generate>[0];

// One Mastra agent call that must return an object matching `schema`.
// Adds the call's token usage to `stats` (counts only, never text).
export async function askForObject<S extends z.ZodType>(
  prompt: Prompt,
  schema: S,
  stats: RunStats,
): Promise<z.infer<S>> {
  const res = await slothStepsAgent.generate(prompt, { structuredOutput: { schema } });
  stats.tokensIn = (stats.tokensIn ?? 0) + (res.usage?.inputTokens ?? 0);
  stats.tokensOut = (stats.tokensOut ?? 0) + (res.usage?.outputTokens ?? 0);
  return res.object as z.infer<S>;
}
