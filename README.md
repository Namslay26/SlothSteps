# SlothSteps 🦥

**Tiny actions for every goal, planned for you by an AI that never leaves your laptop.**

Photograph your vision board (or paste a few notes). A local Gemma model reads it and finds your goals. Each week SlothSteps hands you **one** ten-minute action. You answer with one tap: **Done**, **Make it smaller**, or **Later**. Tapping *Make it smaller* shrinks the step until it is almost too easy to skip.

Built for the [DEV Hacktoberfest Open-Source AI Challenge, Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19).

<!-- TODO: add screenshots or a GIF of the two screens here -->

## How it works

1. **Scan.** Upload a board photo and/or paste notes. Gemma extracts the goals.
2. **Review.** Edit or remove goals before saving. Saving a new scan replaces the old goals.
3. **One step per goal.** SlothSteps writes one concrete action of 1 to 10 minutes for each saved goal.
4. **Tap.** Done, Later, or Make it smaller. Smaller steps are re-written by the model and must be different from the last one.
5. **Keep going.** Plan another step for any goal after finishing or skipping its current one. A scheduled job continues the rotation among goals without an unfinished step.

## Built with open models and Mastra

| Piece | What it does |
| --- | --- |
| **Gemma** (via [Ollama](https://ollama.com)) | Reads the board image and writes every step, fully local |
| **Mastra agent** | `slothStepsAgent` holds the rules for good steps and always returns typed objects (structured output) |
| **Mastra tools** | `extract_goals`, `pick_next_step`, `shrink_step`; each validates the model's answer and retries once with feedback |
| **Mastra workflows** | `scanBoard`, `planWeek`, `shrinkStep` decide the order of the steps; tools run directly as workflow steps |
| **SQLite** (better-sqlite3) | Goals, steps and run metadata, stored in `./data` on your machine |
| **Next.js + TypeScript** | The two screens and the API routes |

The model is only asked for typed objects. The order of operations is decided by deterministic workflows rather than by the model choosing tool calls, which keeps a small local model reliable.

## Privacy

- Models run locally through Ollama. Your photo and goals are not sent to any server.
- The photo is held in memory for the request and is never written to disk.
- The database lives in `./data` and is gitignored, as is `samples/`.
- The `runs` table stores **metadata only** (duration, token counts, retries, error class), never goal text or images.

## Run it locally

**Prerequisites:** Node.js 22.13 or newer, [Ollama](https://ollama.com/download), Git.

```bash
git clone https://github.com/Namslay26/SlothSteps.git
cd SlothSteps
ollama pull gemma3:4b      # any vision-capable Gemma works for photos
npm install
npm run dev                # http://localhost:3000
```

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_MODEL` | `gemma3:4b` | Which Ollama model to use |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434/api` | Point at Ollama on another host |

### Scripts

```bash
npm run extract -- samples/board.jpg                       # goals from a photo
npm run extract -- --text "run a 10k; learn guitar"        # goals from text
npm run plan-next                                          # plan this week's step if there isn't one
npm run plan-next -- --force                               # plan another one right now
```

`plan-next` leaves an unfinished step alone and only creates a new one once per week, so it is safe to run every night.

### The overnight job

Schedule `npm run plan-next` to run nightly.

```cron
# macOS / Linux: every night at 03:00
0 3 * * * cd /path/to/SlothSteps && npm run plan-next >> plan-next.log 2>&1
```

On Windows, create a Task Scheduler task that runs `npm run plan-next` in the project folder.

## Project layout

```
src/app/                 UI and API routes (goals, steps, plan)
src/mastra/agents/       the Mastra agent (Gemma via Ollama)
src/mastra/tools/        extract_goals, pick_next_step, shrink_step
src/mastra/workflows/    scanBoard, planWeek, shrinkStep
src/lib/                 SQLite, validators, planner, metrics
scripts/                 extract-goals.ts, plan-next.ts
```

## License

MIT
