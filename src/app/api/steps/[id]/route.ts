import { NextResponse } from "next/server";
import { friendlyError, shrinkStepById } from "@/lib/planner";
import { stepStatusSchema } from "@/lib/schemas";
import { getStep, setStatus } from "@/lib/store";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = stepStatusSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid step update" }, { status: 400 });
    }

    const existing = getStep(id);
    if (!existing) return NextResponse.json({ error: "Step not found" }, { status: 404 });
    if (existing.status !== "pending") {
      return NextResponse.json({ error: "This step is no longer pending." }, { status: 409 });
    }

    if (parsed.data.shrink) {
      const applied = await shrinkStepById(id);
      if (!applied) {
        return NextResponse.json({ error: "The step changed. Refresh and try again." }, { status: 409 });
      }
    } else if (parsed.data.status) {
      if (!setStatus(id, parsed.data.status)) {
        return NextResponse.json({ error: "The step changed. Refresh and try again." }, { status: 409 });
      }
    }

    return NextResponse.json({ success: true, step: getStep(id) });
  } catch (error) {
    console.error("Failed to update step:", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: friendlyError(error) }, { status: 502 });
  }
}
