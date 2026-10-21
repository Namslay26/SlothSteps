
import { Mastra } from "@mastra/core";
import { slothStepsAgent } from "./agents/slothsteps-agent";

export const mastra = new Mastra({
  agents: {
    slothStepsAgent,
  },
});
