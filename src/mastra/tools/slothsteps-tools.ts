import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { GoalsSchema } from "@/lib/goals-schema";
import { trackRun } from "@/lib/metrics";
import { shrinkProblem, stepProblem, TinyStepSchema } from "@/lib/validate-step";
import { askForObject } from "./ask";

const MAX_ATTEMPTS = 2;

export const extractGoalsTool = createTool({
  id: "extract_goals",
  description: "Read a vision-board photo and/or pasted notes and return the goals they express.",
  inputSchema: z.object({
    text: z.string().optional(),
    imageBase64: z.string().optional(),
    imageMimeType: z.string().optional(),
  }),
  outputSchema: GoalsSchema,
  execute: async ({ text, imageBase64, imageMimeType }) =>
    trackRun("extract", async (stats) => {
      const notes = text?.trim();
      const prompt = imageBase64
        ? [
            {
              role: "user" as const,
              content: [
                {
                  type: "image" as const,
                  image: `data:${imageMimeType ?? "image/jpeg"};base64,${imageBase64}`,
                  mimeType: imageMimeType ?? "image/jpeg",
                },
                {
                  type: "text" as const,
                  text:
                    "Read this vision board and list the goals it shows (at most 7, most prominent first)." +
                    (notes ? `\nThe person also wrote:\n${notes}` : ""),
                },
              ],
            },
          ]
        : `Here are someone's goals in their own words. Turn them into at most 7 clear goals:\n${notes ?? ""}`;

      let lastError: unknown;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
          const out = await askForObject(prompt, GoalsSchema, stats);
          stats.retries = attempt;
          return out;
        } catch (err) {
          lastError = err; // usually: the model's JSON did not match the schema
        }
      }
      throw lastError;
    }),
});

export const pickNextStepTool = createTool({
  id: "pick_next_step",
  description: "Write one concrete action of 1 to 10 minutes for a goal, avoiding earlier actions.",
  inputSchema: z.object({
    goal: z.string().min(3).max(500),
    previousSteps: z.array(z.string()).default([]),
  }),
  outputSchema: TinyStepSchema,
  execute: async ({ goal, previousSteps }) =>
    trackRun("pick", async (stats) => {
      const base = [
        `The person's goal: ${goal}`,
        "Write exactly one tiny action that moves this goal forward.",
        "They should be able to start immediately, even if they are procrastinating.",
        "Return JSON with text (the action) and minutes (an integer from 1 to 10).",
        "Do not repeat these earlier actions:",
        ...(previousSteps.length ? previousSteps.map((s) => `- ${s}`) : ["- (none yet)"]),
      ].join("\n");

      let feedback = "";
      let lastError: unknown;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
          const out = await askForObject(base + feedback, TinyStepSchema, stats);
          const problem = stepProblem(out);
          if (!problem) {
            stats.retries = attempt;
            return out;
          }
          feedback = `\nYour previous answer ("${out.text}") was rejected. ${problem}`;
        } catch (err) {
          lastError = err;
          feedback = "\nReturn valid JSON with text and minutes.";
        }
      }
      throw lastError ?? new Error("StepValidationFailed");
    }),
});

export const shrinkStepTool = createTool({
  id: "shrink_step",
  description: "Make an action roughly half as big so it is almost ridiculously easy to start.",
  inputSchema: z.object({
    currentStep: z.string().min(3).max(200),
    minutes: z.number().int().min(1).max(10),
    shrinkCount: z.number().int().min(0).max(100),
  }),
  outputSchema: TinyStepSchema,
  execute: async ({ currentStep, minutes, shrinkCount }) =>
    trackRun("shrink", async (stats) => {
      const target = Math.max(1, Math.ceil(minutes / 2));
      const base = [
        `Current action: ${currentStep}`,
        `It currently takes about ${minutes} minutes and has been shrunk ${shrinkCount} times already.`,
        `Write a substantially smaller first action that takes about ${target} minute(s).`,
        "Keep the original intention but cut the scope. Do not repeat the current action.",
        "Return JSON with text and minutes (an integer from 1 to 10).",
      ].join("\n");

      let feedback = "";
      let lastError: unknown;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
          const out = await askForObject(base + feedback, TinyStepSchema, stats);
          const problem = stepProblem(out) ?? shrinkProblem(currentStep, out);
          if (!problem) {
            stats.retries = attempt;
            // The model sometimes ignores the time budget; never let a shrink get longer.
            return { text: out.text, minutes: Math.min(out.minutes, target) };
          }
          feedback = `\nYour previous answer ("${out.text}") was rejected. ${problem}`;
        } catch (err) {
          lastError = err;
          feedback = "\nReturn valid JSON with text and minutes.";
        }
      }
      throw lastError ?? new Error("StepValidationFailed");
    }),
});
