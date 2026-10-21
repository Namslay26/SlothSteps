
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { goalSchema } from "@/lib/schemas";

//export const runtime = "nodejs";

function getWeekStart() {
  const date = new Date();
  const day = date.getDay();
  date.setDate(date.getDate() - ((day + 6) % 7));
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

export async function GET() {
  const goals = db.prepare(`
    SELECT
      g.id AS goal_id,
      g.text AS goal_text,
      g.source,
      g.created_at AS goal_created_at,
      s.id AS step_id,
      s.text AS step_text,
      s.minutes,
      s.status,
      s.shrink_count
    FROM goals g
    LEFT JOIN steps s ON s.goal_id = g.id
    ORDER BY g.created_at DESC
  `).all();

  return NextResponse.json({ goals });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = goalSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid goal", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const goalId = randomUUID();
  const stepId = randomUUID();
  const now = new Date().toISOString();

  const saveGoal = db.transaction(() => {
    db.prepare(`
      INSERT INTO goals (id, text, source, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      goalId,
      parsed.data.text,
      parsed.data.source,
      now
    );

    db.prepare(`
      INSERT INTO steps (
        id, goal_id, text, minutes, week_start,
        status, shrink_count, created_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)
    `).run(
      stepId,
      goalId,
      "Write down one tiny action for this goal",
      5,
      getWeekStart(),
      now
    );
  });

  saveGoal();

  return NextResponse.json(
    { goalId, stepId },
    { status: 201 }
  );
}
