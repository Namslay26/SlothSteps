import { extractGoals } from "../src/lib/extract-goals";

const USAGE = `Usage:
  npm run extract -- path/to/board.jpg
  npm run extract -- --text "run a 10k; learn guitar; save for Japan"`;

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(USAGE);
    process.exit(1);
  }

  const input =
    args[0] === "--text" ? { text: args.slice(1).join(" ") } : { imagePath: args[0] };

  const { goals, metrics } = await extractGoals(input);

  // JSON goes to stdout, run stats to stderr, so you can pipe the JSON.
  console.log(JSON.stringify(goals, null, 2));
  console.error("\nrun metrics:", metrics);

  if (goals.goals.length === 0) {
    console.error("No goals found. Try a clearer or closer photo, or use --text.");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  console.error("\nIs Ollama running, and is the model pulled? Try: ollama list");
  process.exit(1);
});
