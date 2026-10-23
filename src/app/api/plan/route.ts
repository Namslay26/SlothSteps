import { NextResponse } from "next/server";
import { friendlyError, planNextStep } from "@/lib/planner";
import { planSchema } from "@/lib/schemas";

// Same function the weekly job (scripts/plan-next.ts) calls.
export async function POST(request: Request) {
  const parsed = planSchema.safeParse(await request.json().catch(() => ({})));
  try {
    const result = await planNextStep({
      goalId: parsed.success ? parsed.data.goalId : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Planning failed:", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: friendlyError(error) }, { status: 502 });
  }
}
