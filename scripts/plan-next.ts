import { planNextStep } from "../src/lib/planner";

// Plans this week's step. Run it on a schedule (see README) or by hand:
//   npm run plan-next            only plans if there is no current weekly focus
//   npm run plan-next -- --show  also prints the step text (it is personal, so off by default)
async function main() {
  const args = process.argv.slice(2);
  const result = await planNextStep();

  if (result.created) {
    console.log(`Planned a new ${result.step?.minutes}-minute step.`);
    if (args.includes("--show")) console.log(result.step?.text);
  } else {
    console.log(`Nothing to do (${result.reason}).`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  console.error("\nIs Ollama running, and is the model pulled? Try: ollama list");
  process.exit(1);
});
