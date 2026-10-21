
import ollama from "ollama";
import { z } from "zod";

const GoalList = z.object({
  goals: z.array(z.string().trim().min(3).max(500))
    .min(1).max(20),
});

const TinyStep = z.object({
  text: z.string().trim().min(3).max(200),
  minutes: z.number().int().min(1).max(10),
});

export async function extractGoals(input: {
  text?: string;
  imageBase64?: string;
}) {
  const response = await ollama.chat({
    model: process.env.OLLAMA_MODEL ?? "gemma3:4b",
    format: "json",
    messages: [{
      role: "user",
      content: [
        "Extract the user's actual goals from this input.",
        "Return JSON with a goals array of concise strings.",
        "Do not invent goals. Ignore decorative text.",
        input.text ? `Text:\n${input.text}` : "",
      ].filter(Boolean).join("\n"),
      ...(input.imageBase64
        ? { images: [input.imageBase64] }
        : {}),
    }],
  });

  const parsed = GoalList.safeParse(
    JSON.parse(response.message.content)
  );

  if (!parsed.success) {
    throw new Error("Goal extraction returned invalid output");
  }

  return parsed.data.goals;
}

const VAGUE_VERBS =
  /^(plan|think about|work on|consider|explore|focus on)\b/i;

export function validateTinyStep(raw: unknown) {
  const parsed = TinyStep.safeParse(raw);
  if (!parsed.success) return null;

  const { text, minutes } = parsed.data;
  const startsWithVerb = /^[A-Za-z]+(?:\s|$)/.test(text);
  const hasConcreteObject = /\b(my|the|a|an)\b/i.test(text);

  if (!startsWithVerb || VAGUE_VERBS.test(text)) return null;
  if (!hasConcreteObject) return null;

  return { text, minutes };
}
