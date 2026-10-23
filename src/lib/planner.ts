import { mastra } from "@/mastra";
import { friendlyError } from "./errors";
import {
  chooseGoalForNextStep,
  getCurrentFocusStep,
  getStep,
  listGoals,
  type StepRow,
} from "./store";

export { friendlyError };

// Run one of the registered Mastra workflows and return its result, or throw
// the underlying error if a step failed.
async function runWorkflow<T>(start: () => Promise<{ status: string; result?: T; error?: unknown }>): Promise<T> {
  const out = await start();
  if (out.status !== "success") {
    throw out.error instanceof Error ? out.error : new Error(`Workflow ${out.status}`);
  }
  return out.result as T;
}

export async function scanInput(input: { text?: string; imageBase64?: string; imageMimeType?: string }) {
  const run = await mastra.getWorkflow("scanBoard").createRun();
  const result = await runWorkflow(() => run.start({ inputData: input }));
  return result.goals.map((goal) => goal.title);
}

export type PlanResult = {
  step: StepRow | null;
  created: boolean;
  reason?: "no-goals" | "pending" | "already-planned";
};

// The weekly job and the weekly-focus button both call this.
// - an unfinished focus carries over until the person checks in,
// - only one focus is planned in a week.
export async function planNextStep(options: { goalId?: string } = {}): Promise<PlanResult> {
  const goals = listGoals();
  if (goals.length === 0) return { step: null, created: false, reason: "no-goals" };
  if (options.goalId && !goals.some((goal) => goal.id === options.goalId)) {
    throw new Error("GoalNotFound");
  }

  const current = getCurrentFocusStep();
  if (current) {
    return {
      step: current,
      created: false,
      reason: current.status === "pending" ? "pending" : "already-planned",
    };
  }

  const goalId = options.goalId ?? chooseGoalForNextStep()?.goalId;
  if (!goalId) return { step: null, created: false, reason: "pending" };

  const run = await mastra.getWorkflow("planWeek").createRun();
  const { stepId } = await runWorkflow(() => run.start({ inputData: { goalId } }));
  return { step: getStep(stepId), created: true };
}

export async function shrinkStepById(stepId: string): Promise<boolean> {
  const run = await mastra.getWorkflow("shrinkStep").createRun();
  const { applied } = await runWorkflow(() => run.start({ inputData: { stepId } }));
  return applied;
}
