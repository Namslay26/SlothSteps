import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { scanInput } from "../src/lib/planner";

const USAGE = `Usage:
  npm run extract -- path/to/board.jpg
  npm run extract -- --text "run a 10k; learn guitar; save for Japan"`;

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

// Same path the app uses: Mastra scanBoard workflow -> extract_goals tool -> agent.
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(USAGE);
    process.exit(1);
  }

  const goals =
    args[0] === "--text"
      ? await scanInput({ text: args.slice(1).join(" ") })
      : await scanInput({
          imageBase64: (await readFile(args[0])).toString("base64"),
          imageMimeType: MIME[extname(args[0]).toLowerCase()] ?? "image/jpeg",
        });

  console.log(JSON.stringify(goals, null, 2));
  if (goals.length === 0) console.error("No goals found. Try a clearer photo, or use --text.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  console.error("\nIs Ollama running, and is the model pulled? Try: ollama list");
  process.exit(1);
});
