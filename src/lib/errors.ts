// Turn low-level failures (Mastra wraps them) into something a person can act on.
export function errorText(err: unknown): string {
  const parts: string[] = [];
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur; i++) {
    if (cur instanceof Error) {
      parts.push(cur.message);
      cur = (cur as Error & { cause?: unknown }).cause;
    } else {
      parts.push(String(cur));
      break;
    }
  }
  return parts.join(" | ");
}

export function friendlyError(err: unknown): string {
  const t = errorText(err).toLowerCase();
  if (t.includes("econnrefused") || t.includes("fetch failed") || t.includes("cannot connect")) {
    return "Can't reach Ollama. Open the Ollama app (or run `ollama serve`) and try again.";
  }
  if (t.includes("not found") && t.includes("model")) {
    return "That model isn't pulled yet. Run `ollama pull gemma3:4b` (or check `ollama list`).";
  }
  if (t.includes("does not support")) {
    return "This Gemma model doesn't support that feature. Pick a vision-capable model with OLLAMA_MODEL.";
  }
  if (t.includes("stepvalidationfailed")) {
    return "The model kept returning steps that were too vague. Try again.";
  }
  return "Something went wrong while talking to the model. Please try again.";
}
