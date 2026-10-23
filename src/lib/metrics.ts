import { randomUUID } from "node:crypto";
import { db } from "./db";

export type RunKind = "extract" | "pick" | "shrink";
export type RunStats = { tokensIn?: number; tokensOut?: number; retries?: number };

// Wraps one model run and records METADATA ONLY (duration, token counts,
// retries, error class) in the local `runs` table. Never the image or goal
// text. This is also the single place to hang Sentry spans on Day 4.
export async function trackRun<T>(kind: RunKind, fn: (stats: RunStats) => Promise<T>): Promise<T> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const stats: RunStats = {};
  let errorName: string | null = null;

  try {
    return await fn(stats);
  } catch (err) {
    errorName = err instanceof Error ? err.name : "Error";
    throw err;
  } finally {
    try {
      db.prepare(
        `INSERT INTO runs (id, kind, started_at, latency_ms, tokens_in, tokens_out, retries, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        randomUUID(),
        kind,
        startedAt,
        Date.now() - t0,
        stats.tokensIn ?? null,
        stats.tokensOut ?? null,
        stats.retries ?? 0,
        errorName,
      );
    } catch {
      // Metrics must never break the app.
    }
  }
}
