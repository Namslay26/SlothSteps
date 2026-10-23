import { randomUUID } from "node:crypto";
import { db } from "./db";
import { weekStart } from "./week";

export type StepStatus = "pending" | "done" | "skipped";

export type GoalRow = { id: string; text: string; source: "image" | "manual"; created_at: string };

export type StepRow = {
  id: string;
  goal_id: string;
  goal_text: string;
  text: string;
  minutes: number;
  week_start: string;
  status: StepStatus;
  shrink_count: number;
};

const STEP_SELECT = `
  SELECT s.id, s.goal_id, g.text AS goal_text, s.text, s.minutes,
         s.week_start, s.status, s.shrink_count
  FROM steps s JOIN goals g ON g.id = s.goal_id`;

export function listGoals(): GoalRow[] {
  return db
    .prepare("SELECT id, text, source, created_at FROM goals ORDER BY created_at ASC, rowid ASC")
    .all() as GoalRow[];
}

// A new scan REPLACES the old goals (and their steps, via ON DELETE CASCADE),
// so scanning twice never leaves duplicates behind.
export function replaceGoals(texts: string[], source: "image" | "manual"): void {
  const insert = db.prepare("INSERT INTO goals (id, text, source, created_at) VALUES (?, ?, ?, ?)");
  db.transaction(() => {
    db.prepare("DELETE FROM goals").run();
    const now = new Date().toISOString();
    for (const text of texts) insert.run(randomUUID(), text, source, now);
  })();
}

export function getLatestStep(): StepRow | null {
  return (db.prepare(`${STEP_SELECT} ORDER BY s.rowid DESC LIMIT 1`).get() as StepRow | undefined) ?? null;
}

export function getLatestStepForGoal(goalId: string): StepRow | null {
  return (
    (db.prepare(`${STEP_SELECT} WHERE s.goal_id = ? ORDER BY s.rowid DESC LIMIT 1`).get(goalId) as
      | StepRow
      | undefined) ?? null
  );
}

export function listGoalsWithSteps(): Array<GoalRow & { step: StepRow | null }> {
  return listGoals().map((goal) => ({ ...goal, step: getLatestStepForGoal(goal.id) }));
}

export function getStep(id: string): StepRow | null {
  return (db.prepare(`${STEP_SELECT} WHERE s.id = ?`).get(id) as StepRow | undefined) ?? null;
}

// Goals take turns: pick the goal with the fewest steps so far (oldest first),
// and hand back its earlier steps so the model does not repeat itself.
export function chooseGoalForNextStep(
  goalId?: string,
): { goalId: string; goal: string; previousSteps: string[] } | null {
  const goal = goalId
    ? (db.prepare("SELECT id, text FROM goals WHERE id = ?").get(goalId) as
        | { id: string; text: string }
        | undefined)
    : (db
        .prepare(
          `SELECT g.id, g.text FROM goals g
           LEFT JOIN steps s ON s.goal_id = g.id
           GROUP BY g.id
           HAVING SUM(CASE WHEN s.status = 'pending' THEN 1 ELSE 0 END) = 0
           ORDER BY COUNT(s.id) ASC, g.created_at ASC, g.rowid ASC LIMIT 1`,
        )
        .get() as { id: string; text: string } | undefined);
  if (!goal) return null;

  const previous = db
    .prepare("SELECT text FROM steps WHERE goal_id = ? ORDER BY rowid DESC LIMIT 10")
    .all(goal.id) as { text: string }[];

  return { goalId: goal.id, goal: goal.text, previousSteps: previous.map((r) => r.text) };
}

export function insertStep(goalId: string, text: string, minutes: number): StepRow {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO steps (id, goal_id, text, minutes, week_start, status, shrink_count, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)`,
  ).run(id, goalId, text, minutes, weekStart(), new Date().toISOString());
  return getStep(id)!;
}

// Optimistic concurrency: only applies if the step is still pending and unchanged.
export function applyShrink(id: string, text: string, minutes: number, expectedShrinkCount: number): boolean {
  const res = db
    .prepare(
      `UPDATE steps SET text = ?, minutes = ?, shrink_count = shrink_count + 1
       WHERE id = ? AND shrink_count = ? AND status = 'pending'`,
    )
    .run(text, minutes, id, expectedShrinkCount);
  return res.changes > 0;
}

export function setStatus(id: string, status: Exclude<StepStatus, "pending">): boolean {
  const res = db.prepare("UPDATE steps SET status = ? WHERE id = ? AND status = 'pending'").run(status, id);
  return res.changes > 0;
}
