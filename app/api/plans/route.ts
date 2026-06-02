// GET /api/plans
//   ?date_from=&date_to=  → look up plan for range (null if not found — never creates)
//   ?list=true            → all plans sorted by date_from ascending
//   (no params)           → most recent plan
//
// POST /api/plans { date_from, date_to } → find or create plan (only call from generate / add meal)
// DELETE /api/plans?id=  → delete plan and all its meals + shopping items
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");
  const list = searchParams.get("list");

  try {
    // Direct lookup by primary key — fastest, used for sharing
    if (id) {
      const { data, error } = await supabase
        .from("meal_plans")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json(data ?? null);
    }

    if (list === "true") {
      const { data, error } = await supabase
        .from("meal_plans")
        .select("*")
        .order("date_from", { ascending: true });
      if (error) throw error;
      return NextResponse.json(data ?? []);
    }

    if (dateFrom && dateTo) {
      // Look up only — never create. Returns null if no plan exists for this range.
      const { data, error } = await supabase
        .from("meal_plans")
        .select("*")
        .eq("date_from", dateFrom)
        .eq("date_to", dateTo)
        .maybeSingle();

      if (error) throw error;
      return NextResponse.json(data ?? null);
    }

    // Return most recent plan
    const { data, error } = await supabase
      .from("meal_plans")
      .select("*")
      .order("date_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/plans:", err);
    return NextResponse.json({ error: "Kunne ikke hente plan" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const { date_from, date_to } = await request.json();
    if (!date_from || !date_to) {
      return NextResponse.json({ error: "date_from and date_to required" }, { status: 400 });
    }

    // Find existing or create
    const { data: existing } = await supabase
      .from("meal_plans")
      .select("*")
      .eq("date_from", date_from)
      .eq("date_to", date_to)
      .maybeSingle();

    if (existing) return NextResponse.json(existing);

    const { data, error } = await supabase
      .from("meal_plans")
      .insert({ date_from, date_to })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("POST /api/plans:", err);
    return NextResponse.json({ error: "Kunne ikke opprette plan" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    // Delete meals and shopping items first (cascade may not be set up)
    await supabase.from("shopping_items").delete().eq("plan_id", id);
    await supabase.from("meals").delete().eq("plan_id", id);
    const { error } = await supabase.from("meal_plans").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/plans:", err);
    return NextResponse.json({ error: "Kunne ikke slette plan" }, { status: 500 });
  }
}
