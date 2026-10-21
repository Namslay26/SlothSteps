
import ollama from "ollama";
import { z } from "zod";

const GoalList = z.object({
  goals: z.array(z.string().trim().min(3).max(500)).min(1).max(20),
});

const TinyStep = z.object({
  text: z.string().trim().min(3).max(200),
  minutes: z.number().int().min(1).max(10),
});

const VAGUE_VERBS =
  /^(plan|think about|work on|consider|explore|focus on)\b/i;


export function validateTinyStep(raw: unknown) {
  const parsed = TinyStep.safeParse(raw);

  if (!parsed.success) {
    console.warn(
      "Tiny-step schema validation failed:",
      parsed.error.issues
    );
    return null;
  }

  const { text, minutes } = parsed.data;

  const startsWithVerb = /^[A-Za-z]+(?:\s|$)/.test(text);

  if (!startsWithVerb || VAGUE_VERBS.test(text)) {
    console.warn("Tiny step rejected by content validator:", text);
    return null;
  }

  return { text, minutes };
}


async function generateValidatedStep(prompt: string) {
  // First attempt, followed by one retry if validation fails.
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await ollama.chat({
      model: process.env.OLLAMA_MODEL ?? "gemma3:4b",
      format: "json",
      messages: [
        {
          role: "user",
          content: [
            prompt,
            "Return ONLY JSON with keys text and minutes.",
            "text must be one specific, immediately doable action.",
            "Start with an action verb.",
            "Avoid vague verbs such as plan, think about, or work on.",
            "Make the action concrete and include an object.",
            "minutes must be an integer from 1 to 10.",
            ...(attempt === 1
              ? ["Your previous answer was invalid. Correct it strictly."]
              : []),
          ].join("\n"),
        },
      ],
    });

    try {
      const raw: unknown = JSON.parse(response.message.content);
      console.log(
        `Tiny-step attempt ${attempt + 1}:`,
        response.message.content
      );
      const validated = validateTinyStep(raw);
      if (validated) return validated;
    } catch {
      // Invalid JSON: try once more.
    }
  }

  throw new Error("Could not generate a valid tiny step after one retry");
}

export async function extractGoals(input: {
  text?: string;
  imageBase64?: string;
}) {
  const response = await ollama.chat({
    model: process.env.OLLAMA_MODEL ?? "gemma3:4b",
    format: "json",
    messages: [
      {
        role: "user",
        content: [
          "Extract the user's actual goals from the supplied text or image.",
          "Return JSON with a goals array of concise strings.",
          "Do not invent goals. Ignore decorative text.",
          "Return between 1 and 20 goals.",
          input.text ? `Text:\n${input.text}` : "",
        ].filter(Boolean).join("\n"),
        ...(input.imageBase64
          ? { images: [input.imageBase64] }
          : {}),
      },
    ],
  });

  const parsed = GoalList.safeParse(
    JSON.parse(response.message.content)
  );

  if (!parsed.success) {
    throw new Error("Goal extraction returned invalid output");
  }

  return parsed.data.goals;
}

export async function pickNextStep(input: {
  goal: string;
  previousSteps?: string[];
}) {
  const history = input.previousSteps ?? [];

  return generateValidatedStep([
    `User's goal: ${input.goal}`,
    "Choose exactly one tiny action that moves this goal forward.",
    "The user should be able to start immediately.",
    "Make it small enough for someone who is procrastinating.",
    "Avoid repeating these previous steps:",
    ...(history.length
      ? history.map((step) => `- ${step}`)
      : ["- No previous steps"]),
  ].join("\n"));
}

export async function shrinkStep(input: {
  currentStep: string;
  minutes: number;
  shrinkCount: number;
}) {
  const nextMinutes = Math.max(1, Math.ceil(input.minutes / 2));

  return generateValidatedStep([
    `Current action: ${input.currentStep}`,
    `Current estimated time: ${input.minutes} minutes`,
    `This action has already been shrunk ${input.shrinkCount} times.`,
    `Create a substantially smaller first action taking about ${nextMinutes} minute(s).`,
    "Preserve the original intention, but reduce its scope.",
    "Make the result almost ridiculously easy to start.",
    "Do not repeat the current action unchanged.",
  ].join("\n"));
}
