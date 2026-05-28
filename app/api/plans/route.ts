// GET /api/plans — get or create the active plan for a date range
// POST /api/plans — create a new plan
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");

  try {
    if (dateFrom && dateTo) {
      // Find existing plan in this range
      const { data, error } = await supabase
        .from("meal_plans")
        .select("*")
        .eq("date_from", dateFrom)
        .eq("date_to", dateTo)
        .maybeSingle();

      if (error) throw error;
      if (data) return NextResponse.json(data);

      // Create new plan
      const { data: created, error: createError } = await supabase
        .from("meal_plans")
        .insert({ date_from: dateFrom, date_to: dateTo })
        .select()
        .single();

      if (createError) throw createError;
      return NextResponse.json(created);
    }

    // Return most recent plan
    const { data, error } = await supabase
      .from("meal_plans")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/plans:", err);
    return NextResponse.json({ error: "Kunne ikke hente plan" }, { status: 500 });
  }
}
