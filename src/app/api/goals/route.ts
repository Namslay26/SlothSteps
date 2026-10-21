
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { goalSchema } from "@/lib/schemas";
import { pickNextStep } from "@/lib/agent";

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
    LEFT JOIN steps s
      ON s.id = (
        SELECT s2.id
        FROM steps s2
        WHERE s2.goal_id = g.id
        ORDER BY s2.created_at DESC, s2.rowid DESC
        LIMIT 1
      )
    ORDER BY g.created_at DESC
  `).all();

  return NextResponse.json({ goals });
}

export async function POST(request: Request) {
  try {
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

    // Generate a valid tiny action before writing to the database.
    const firstStep = await pickNextStep({
      goal: parsed.data.text,
      previousSteps: [],
    });

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
        )
        VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)
      `).run(
        stepId,
        goalId,
        firstStep.text,
        firstStep.minutes,
        getWeekStart(),
        now
      );
    });

    saveGoal();

    return NextResponse.json(
      {
        goalId,
        stepId,
        step: firstStep,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create goal:", error);

    return NextResponse.json(
      { error: "Couldn't create a goal right now. Please try again." },
      { status: 502 }
    );
  }
}
