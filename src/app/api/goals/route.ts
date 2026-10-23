import { NextResponse } from "next/server";
import { friendlyError, planNextStep } from "@/lib/planner";
import { saveGoalsSchema } from "@/lib/schemas";
import { listGoals, listGoalsWithSteps, replaceGoals } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ goals: listGoalsWithSteps() });
}

// Save the reviewed goals (replacing any earlier scan) and plan one step per goal.
export async function POST(request: Request) {
  const parsed = saveGoalsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid goals" }, { status: 400 });
  }

  try {
    replaceGoals(parsed.data.goals, parsed.data.source);
    for (const goal of listGoals()) {
      await planNextStep({ force: true, goalId: goal.id });
    }
    return NextResponse.json({ goals: listGoalsWithSteps() }, { status: 201 });
  } catch (error) {
    console.error("Failed to plan the first step:", error instanceof Error ? error.name : "error");
    // The goals are saved; only the first step is missing. "Plan" can be retried.
    return NextResponse.json(
      { error: friendlyError(error), goals: listGoalsWithSteps() },
      { status: 502 },
    );
  }
}
