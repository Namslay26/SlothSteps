import { z } from "zod";

export const CATEGORIES = [
  "health",
  "career",
  "learning",
  "money",
  "relationships",
  "creativity",
  "home",
  "travel",
  "other",
] as const;

export const GoalSchema = z.object({
  title: z
    .string()
    .min(3)
    .max(80)
    .describe("The goal in plain words, e.g. 'Run a 10k' or 'Save for a trip to Japan'"),
  category: z.enum(CATEGORIES),
  evidence: z
    .string()
    .min(3)
    .max(140)
    .describe("What on the board points to this goal: a word, picture, or symbol you can actually see"),
});

// No .min() on the array on purpose: an unreadable board should return an
// empty list rather than force the model to invent goals.
export const GoalsSchema = z.object({
  goals: z.array(GoalSchema).max(7),
});

export type Goal = z.infer<typeof GoalSchema>;
export type Goals = z.infer<typeof GoalsSchema>;

// Ollama's `format` option takes a JSON schema and constrains the output to it.
const { $schema: _ignored, ...schema } = z.toJSONSchema(GoalsSchema);
export const goalsJsonSchema = schema;
