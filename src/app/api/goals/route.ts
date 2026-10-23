import { NextResponse } from "next/server";
import { friendlyError } from "@/lib/planner";
import { saveGoalsSchema } from "@/lib/schemas";
import { chooseGoalForNextStep, getCurrentFocusStep, listGoals, replaceGoals } from "@/lib/store";

export async function GET() {
  return NextResponse.json({
    goals: listGoals(),
    step: getCurrentFocusStep(),
    suggestedGoalId: chooseGoalForNextStep()?.goalId ?? "",
  });
}

// Save goals first; the person chooses this week's focus before planning a step.
export async function POST(request: Request) {
  const parsed = saveGoalsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid goals" }, { status: 400 });
  }

  try {
    replaceGoals(parsed.data.goals, parsed.data.source);
    return NextResponse.json({
      goals: listGoals(),
      step: getCurrentFocusStep(),
      suggestedGoalId: chooseGoalForNextStep()?.goalId ?? "",
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to save goals:", error instanceof Error ? error.name : "error");
    return NextResponse.json(
      { error: friendlyError(error) },
      { status: 502 },
    );
  }
}
