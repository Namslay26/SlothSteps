
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stepStatusSchema } from "@/lib/schemas";
import { shrinkStep } from "@/lib/agent";

//export const runtime = "nodejs";

type ExistingStep = {
  id: string;
  goal_id: string;
  text: string;
  minutes: number;
  shrink_count: number;
  status: "pending" | "done" | "skipped";
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = stepStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid step update" },
        { status: 400 }
      );
    }

    const existing = db.prepare(`
      SELECT id, goal_id, text, minutes, shrink_count, status
      FROM steps
      WHERE id = ?
    `).get(id) as ExistingStep | undefined;

    if (!existing) {
      return NextResponse.json(
        { error: "Step not found" },
        { status: 404 }
      );
    }

    if (existing.status !== "pending") {
      return NextResponse.json(
        { error: "This step is no longer pending." },
        { status: 409 }
      );
    }

    if (parsed.data.shrink) {
      const smaller = await shrinkStep({
        currentStep: existing.text,
        minutes: existing.minutes,
        shrinkCount: existing.shrink_count,
      });

      const result = db.prepare(`
        UPDATE steps
        SET text = ?,
            minutes = ?,
            shrink_count = shrink_count + 1
        WHERE id = ?
          AND shrink_count = ?
          AND status = 'pending'
      `).run(
        smaller.text,
        smaller.minutes,
        id,
        existing.shrink_count
      );

      if (result.changes === 0) {
        return NextResponse.json(
          { error: "The step changed. Refresh and try again." },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        step: smaller,
        shrink_count: existing.shrink_count + 1,
      });
    }

    if (parsed.data.status) {
      const result = db.prepare(`
        UPDATE steps
        SET status = ?
        WHERE id = ?
          AND status = 'pending'
      `).run(parsed.data.status, id);

      if (result.changes === 0) {
        return NextResponse.json(
          { error: "The step changed. Refresh and try again." },
          { status: 409 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update step:", error);

    return NextResponse.json(
      { error: "Couldn't update this step. Please try again." },
      { status: 502 }
    );
  }
}
