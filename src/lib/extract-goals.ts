import { readFile } from "node:fs/promises";
import { Ollama, type Message } from "ollama";
import { z } from "zod";
import { GoalsSchema, goalsJsonSchema, type Goals } from "./goals-schema";

// Check https://ollama.com/library for the current Gemma models and pick one
// that lists image (vision) support. Override without editing code:
//   OLLAMA_MODEL=gemma3:12b npm run extract -- board.jpg
const MODEL = process.env.OLLAMA_MODEL ?? "gemma3:4b";
const HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
const MAX_ATTEMPTS = 2;

const SYSTEM_PROMPT = `You read photos of vision boards and extract the goals they express.

Rules:
- Only include goals supported by something actually visible: written words, pictures, or symbols. Never invent goals.
- Write each title in plain words, 3 to 8 words, like "Run a 10k" or "Save for a trip to Japan".
- Merge duplicates. Return at most 7 goals, most prominent first.
- For "evidence", say what on the board points to the goal.
- If the image is unreadable or shows no goals, return an empty goals array.
- Respond with JSON that matches the schema and nothing else.`;

export type ExtractInput = { imagePath: string } | { text: string };

// Metadata only. This is what you will send to Sentry later. Never log the
// image or the goal text.
export type RunMetrics = {
  model: string;
  attempts: number;
  wallMs: number;
  promptTokens: number;
  outputTokens: number;
};

export async function extractGoals(
  input: ExtractInput,
): Promise<{ goals: Goals; metrics: RunMetrics }> {
  const client = new Ollama({ host: HOST });

  const userMessage: Message =
    "imagePath" in input
      ? {
          role: "user",
          content: "Read this vision board and list the goals it shows.",
          images: [(await readFile(input.imagePath)).toString("base64")],
        }
      : {
          role: "user",
          content: `Here are someone's goals in their own words. Turn them into the schema:\n${input.text}`,
        };

  const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }, userMessage];

  const started = Date.now();
  let promptTokens = 0;
  let outputTokens = 0;
  let lastError = "unknown error";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await client.chat({
      model: MODEL,
      messages,
      format: goalsJsonSchema,
      stream: false,
      options: { temperature: 0.2 },
    });

    promptTokens += res.prompt_eval_count ?? 0;
    outputTokens += res.eval_count ?? 0;
    const raw = res.message.content;

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      parsedJson = undefined;
    }

    const result = GoalsSchema.safeParse(parsedJson);
    if (result.success) {
      return {
        goals: result.data,
        metrics: {
          model: MODEL,
          attempts: attempt,
          wallMs: Date.now() - started,
          promptTokens,
          outputTokens,
        },
      };
    }

    lastError = parsedJson === undefined ? "Output was not valid JSON." : z.prettifyError(result.error);

    // Retry once, telling the model exactly what was wrong.
    messages.push(
      { role: "assistant", content: raw },
      { role: "user", content: `That output was invalid:\n${lastError}\nReturn corrected JSON only.` },
    );
  }

  throw new Error(`Model output failed validation after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}
