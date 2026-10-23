import { Agent } from "@mastra/core/agent";
import { createOllama } from "ollama-ai-provider-v2";

// Defaults to http://127.0.0.1:11434/api. Set OLLAMA_BASE_URL (ending in /api) to use another host.
const ollama = createOllama({ baseURL: process.env.OLLAMA_BASE_URL });

// One Mastra agent on a local open-weight Gemma model. The tools in
// ../tools call this agent with a structured-output schema each time, and the
// workflows in ../workflows decide the order of the steps.
//
// Why the agent has no `tools:` attached: small local models are unreliable at
// choosing tools, and some Gemma builds in Ollama don't support tool calling at
// all (check with `ollama show <model>`). So the order of operations lives in
// deterministic Mastra workflows, and the model is only ever asked for a typed
// object (structured output).
export const slothStepsAgent = new Agent({
  id: "slothsteps-agent",
  name: "SlothSteps Agent",
  instructions: `
You are SlothSteps, a gentle assistant that turns goals into tiny actions.

When reading a vision board or notes:
- Only report goals supported by words, pictures or symbols that are really there.
- Never invent goals. If nothing is readable, return an empty list.

When writing an action:
- It must be one specific thing someone can start immediately.
- Start with an action verb (Open, Write, Put, Call, Send...).
- Name the concrete object. Never use vague verbs like plan, think about or work on.
- It must fit in the stated number of minutes (1 to 10).
- Never repeat an earlier action.
- Keep it kind and almost too easy.

Always reply with exactly the JSON object that was asked for and nothing else.
`.trim(),
  model: ollama(process.env.OLLAMA_MODEL ?? "gemma3:4b"),
});
