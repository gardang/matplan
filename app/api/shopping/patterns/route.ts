// GET /api/shopping/patterns — list known patterns (for pre-fill + Settings)
// PUT /api/shopping/patterns — update category_override (and optionally other fields)
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { normalizeItemName } from "@/lib/normalize";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("shopping_patterns")
    .select("*")
    .order("times_bought", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PUT(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const body = await request.json() as {
      normalized_name?: string;
      id?: string;
      category_override?: string | null;
      [k: string]: unknown;
    };

    const { id, normalized_name, ...fields } = body;

    if (!id && !normalized_name) {
      return NextResponse.json({ error: "id or normalized_name required" }, { status: 400 });
    }

    if (id) {
      const { data, error } = await supabase
        .from("shopping_patterns")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data);
    }

    // Upsert by normalized_name — create pattern row if it doesn't exist yet
    const norm = normalizeItemName(normalized_name!).toLowerCase();
    const { data: existing } = await supabase
      .from("shopping_patterns")
      .select("*")
      .ilike("normalized_name", norm)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from("shopping_patterns")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data);
    } else {
      // First time we see this item — create a minimal pattern row
      const { data, error } = await supabase
        .from("shopping_patterns")
        .insert({
          item_name: normalized_name,
          normalized_name: norm,
          times_bought: 0,
          ...fields,
        })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data);
    }
  } catch (err) {
    console.error("PUT /api/shopping/patterns:", err);
    return NextResponse.json({ error: "Kunne ikke oppdatere varemønster" }, { status: 500 });
  }
}
