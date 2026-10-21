
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import {
  extractGoals,
  pickNextStep,
  shrinkStep,
} from "@/lib/agent";

export const extractGoalsTool = createTool({
  id: "extract_goals",
  description:
    "Extract the user's real goals from text or a vision-board image.",
  inputSchema: z.object({
    text: z.string().optional(),
    imageBase64: z.string().optional(),
  }),
  outputSchema: z.object({
    goals: z.array(z.string()).min(1).max(20),
  }),
  execute: async ({ text, imageBase64 }) => {
    const goals = await extractGoals({ text, imageBase64 });
    return { goals };
  },
});

export const pickNextStepTool = createTool({
  id: "pick_next_step",
  description:
    "Generate one concrete, non-repeating action that takes 1–10 minutes.",
  inputSchema: z.object({
    goal: z.string().min(3).max(500),
    previousSteps: z.array(z.string()).default([]),
  }),
  outputSchema: z.object({
    text: z.string().min(3).max(200),
    minutes: z.number().int().min(1).max(10),
  }),
  execute: async ({ goal, previousSteps }) => {
    return pickNextStep({ goal, previousSteps });
  },
});

export const shrinkStepTool = createTool({
  id: "shrink_step",
  description:
    "Make the user's current action smaller and easier to start.",
  inputSchema: z.object({
    currentStep: z.string().min(3).max(200),
    minutes: z.number().int().min(1).max(10),
    shrinkCount: z.number().int().min(0).max(100),
  }),
  outputSchema: z.object({
    text: z.string().min(3).max(200),
    minutes: z.number().int().min(1).max(10),
  }),
  execute: async ({ currentStep, minutes, shrinkCount }) => {
    return shrinkStep({ currentStep, minutes, shrinkCount });
  },
});
