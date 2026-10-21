
import { Agent } from "@mastra/core/agent";
import { ollama } from "ollama-ai-provider-v2";

import {
  extractGoalsTool,
  pickNextStepTool,
  shrinkStepTool,
} from "../tools/slothsteps-tools";

export const slothStepsAgent = new Agent({
  id: "slothsteps-agent",
  name: "SlothSteps Agent",
  instructions: `
    You are the SlothSteps assistant.

    Your job is to help users turn goals into tiny, manageable actions.

    Rules:
    - Use extractGoalsTool to extract goals from supplied input.
    - Use pickNextStepTool to generate a concrete action for a goal.
    - Use shrinkStepTool when a user says their action is too big.
    - Never invent goals that the user did not express.
    - Keep actions small, concrete, and encouraging.
    - Do not claim that a goal or action was saved unless the application confirms it.
  `,
  model: ollama(process.env.OLLAMA_MODEL ?? "gemma3:4b"),
  tools: {
    extractGoalsTool,
    pickNextStepTool,
    shrinkStepTool,
  },
});
