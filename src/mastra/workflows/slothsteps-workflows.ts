import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { applyShrink, chooseGoalForNextStep, getStep, insertStep } from "@/lib/store";
import { GoalsSchema } from "@/lib/goals-schema";
import { TinyStepSchema } from "@/lib/validate-step";
import { extractGoalsTool, pickNextStepTool, shrinkStepTool } from "../tools/slothsteps-tools";

/* 1. scanBoard: photo or notes -> goals (the person reviews them before saving) */

const extractStep = createStep(extractGoalsTool);

export const scanBoardWorkflow = createWorkflow({
  id: "scan-board",
  inputSchema: z.object({
    text: z.string().optional(),
    imageBase64: z.string().optional(),
    imageMimeType: z.string().optional(),
  }),
  outputSchema: GoalsSchema,
})
  .then(extractStep)
  .commit();

/* 2. planWeek: choose a goal -> ask the agent for one tiny step -> save it */

const chooseGoalStep = createStep({
  id: "choose-goal",
  inputSchema: z.object({ goalId: z.string().optional() }),
  outputSchema: z.object({
    goalId: z.string(),
    goal: z.string(),
    previousSteps: z.array(z.string()),
  }),
  execute: async ({ inputData }) => {
    const choice = chooseGoalForNextStep(inputData.goalId);
    if (!choice) throw new Error("NoGoals");
    return choice;
  },
});

// The pick_next_step tool runs directly as a workflow step: its input
// ({ goal, previousSteps }) is the previous step's output.
const writeStepStep = createStep(pickNextStepTool);

const saveStepStep = createStep({
  id: "save-step",
  inputSchema: TinyStepSchema,
  outputSchema: z.object({ stepId: z.string() }),
  execute: async ({ inputData, getStepResult }) => {
    const { goalId } = getStepResult(chooseGoalStep);
    const saved = insertStep(goalId, inputData.text, inputData.minutes);
    return { stepId: saved.id };
  },
});

export const planWeekWorkflow = createWorkflow({
  id: "plan-week",
  inputSchema: z.object({ goalId: z.string().optional() }),
  outputSchema: z.object({ stepId: z.string() }),
})
  .then(chooseGoalStep)
  .then(writeStepStep)
  .then(saveStepStep)
  .commit();

/* 3. shrinkStep: load the step -> ask the agent for a smaller one -> apply it */

const loadStepStep = createStep({
  id: "load-step",
  inputSchema: z.object({ stepId: z.string() }),
  outputSchema: z.object({
    stepId: z.string(),
    currentStep: z.string(),
    minutes: z.number(),
    shrinkCount: z.number(),
  }),
  execute: async ({ inputData }) => {
    const step = getStep(inputData.stepId);
    if (!step) throw new Error("StepNotFound");
    if (step.status !== "pending") throw new Error("StepNotPending");
    return {
      stepId: step.id,
      currentStep: step.text,
      minutes: step.minutes,
      shrinkCount: step.shrink_count,
    };
  },
});

// The shrink_step tool runs directly as a workflow step.
const makeSmallerStep = createStep(shrinkStepTool);

const applyShrinkStep = createStep({
  id: "apply-shrink",
  inputSchema: TinyStepSchema,
  outputSchema: z.object({ applied: z.boolean() }),
  execute: async ({ inputData, getStepResult }) => {
    const loaded = getStepResult(loadStepStep);
    return {
      applied: applyShrink(loaded.stepId, inputData.text, inputData.minutes, loaded.shrinkCount),
    };
  },
});

export const shrinkStepWorkflow = createWorkflow({
  id: "shrink-step",
  inputSchema: z.object({ stepId: z.string() }),
  outputSchema: z.object({ applied: z.boolean() }),
})
  .then(loadStepStep)
  .then(makeSmallerStep)
  .then(applyShrinkStep)
  .commit();
