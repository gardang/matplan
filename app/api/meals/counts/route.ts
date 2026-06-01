// GET /api/meals/counts — returns { [plan_id]: meal_count } for all plans
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("meals")
    .select("plan_id");

  if (error) return NextResponse.json({}, { status: 500 });

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.plan_id] = (counts[row.plan_id] ?? 0) + 1;
  }
  return NextResponse.json(counts);
}
