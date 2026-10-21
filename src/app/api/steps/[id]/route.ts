
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stepStatusSchema } from "@/lib/schemas";

//export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = stepStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid step update" },
      { status: 400 }
    );
  }

  const existing = db.prepare(
    "SELECT id, shrink_count FROM steps WHERE id = ?"
  ).get(id) as
    | { id: string; shrink_count: number }
    | undefined;

  if (!existing) {
    return NextResponse.json(
      { error: "Step not found" },
      { status: 404 }
    );
  }

  if (parsed.data.shrink) {
    db.prepare(`
      UPDATE steps
      SET text = ?, minutes = ?, shrink_count = shrink_count + 1
      WHERE id = ?
    `).run(
      "Put your notebook on your desk",
      2,
      id
    );
  } else if (parsed.data.status) {
    db.prepare(`
      UPDATE steps SET status = ? WHERE id = ?
    `).run(parsed.data.status, id);
  }

  return NextResponse.json({ success: true });
}
