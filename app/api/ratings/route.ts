// GET /api/ratings — all ratings
// POST /api/ratings — upsert rating by meal_name
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = createServerClient();
  try {
    const { data, error } = await supabase
      .from("meal_ratings")
      .select("*")
      .order("meal_name");
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("GET /api/ratings:", err);
    return NextResponse.json({ error: "Kunne ikke hente vurderinger" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const { meal_name, rating, rated_by, notes, recipe_url } = await request.json();

    const fields = {
      meal_name,
      rating,
      rated_by: rated_by ?? null,
      notes: notes ?? null,
      recipe_url: recipe_url ?? null,
      updated_at: new Date().toISOString(),
    };

    // Check if a rating already exists for this meal_name
    const { data: existing } = await supabase
      .from("meal_ratings")
      .select("id")
      .eq("meal_name", meal_name)
      .maybeSingle();

    let result;
    if (existing?.id) {
      // Update existing row
      const { data, error } = await supabase
        .from("meal_ratings")
        .update(fields)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      // Insert new row
      const { data, error } = await supabase
        .from("meal_ratings")
        .insert(fields)
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/ratings:", err);
    return NextResponse.json({ error: "Kunne ikke lagre vurdering" }, { status: 500 });
  }
}
