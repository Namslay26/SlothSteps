import { Mastra } from "@mastra/core";
import { slothStepsAgent } from "./agents/slothsteps-agent";
import { extractGoalsTool, pickNextStepTool, shrinkStepTool } from "./tools/slothsteps-tools";
import {
  planWeekWorkflow,
  scanBoardWorkflow,
  shrinkStepWorkflow,
} from "./workflows/slothsteps-workflows";

export const mastra = new Mastra({
  agents: { slothStepsAgent },
  tools: { extractGoalsTool, pickNextStepTool, shrinkStepTool },
  workflows: {
    scanBoard: scanBoardWorkflow,
    planWeek: planWeekWorkflow,
    shrinkStep: shrinkStepWorkflow,
  },
});
