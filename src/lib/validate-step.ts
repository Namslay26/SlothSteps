import { z } from "zod";

export const TinyStepSchema = z.object({
  text: z.string().trim().min(3).max(200),
  minutes: z.number().int().min(1).max(10),
});
export type TinyStep = z.infer<typeof TinyStepSchema>;

const VAGUE =
  /^(plan|think about|think|work on|consider|explore|focus on|try to|figure out|start working)\b/i;

// Words that can't start an action. This is a cheap guard, not a part-of-speech check.
const NOT_AN_ACTION = new Set([
  "a", "an", "the", "my", "your", "some", "this", "that", "it", "more", "one", "step", "goal",
]);

// Returns a reason to reject the step, or null if it is acceptable.
// The reason is fed back to the model on retry, so write it as an instruction.
export function stepProblem(step: TinyStep): string | null {
  const words = step.text.trim().split(/\s+/);
  const first = (words[0] ?? "").toLowerCase().replace(/[^a-z']/g, "");

  if (!first || NOT_AN_ACTION.has(first)) {
    return "Start with an action verb such as Open, Write, Put, Call or Send.";
  }
  if (VAGUE.test(step.text.trim())) {
    return "Avoid vague verbs like plan, think about or work on. Name one concrete action.";
  }
  if (words.length < 3) {
    return "Name the concrete thing the person will act on.";
  }
  return null;
}

// A shrunk step has to actually be different from the one it replaces.
export function shrinkProblem(currentText: string, next: TinyStep): string | null {
  if (next.text.trim().toLowerCase() === currentText.trim().toLowerCase()) {
    return "The action is unchanged. Make it smaller than the current action.";
  }
  return null;
}
