// GET /api/settings/budget — read weekly grocery budget (NOK)
// PUT /api/settings/budget — update it
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getWeeklyBudget } from "@/lib/app-settings";

export async function GET() {
  const budget = await getWeeklyBudget();
  return NextResponse.json({ budget });
}

export async function PUT(request: NextRequest) {
  const { budget } = await request.json();
  const value = Number(budget);

  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) {
    return NextResponse.json({ error: "Ugyldig budsjett" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error } = await supabase.from("app_settings").upsert(
    { key: "weekly_budget", value: String(Math.round(value)), updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );

  if (error) {
    console.error("PUT /api/settings/budget:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ budget: Math.round(value) });
}
