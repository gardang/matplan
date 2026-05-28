// GET /api/shopping?plan_id=... — fetch items for a plan
// POST /api/shopping — add item
// PUT /api/shopping — update item (check/uncheck/edit)
// DELETE /api/shopping?id=... — delete item
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const planId = searchParams.get("plan_id");
  if (!planId) return NextResponse.json({ error: "plan_id required" }, { status: 400 });

  try {
    const { data, error } = await supabase
      .from("shopping_items")
      .select("*")
      .eq("plan_id", planId)
      .order("created_at");
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("GET /api/shopping:", err);
    return NextResponse.json({ error: "Kunne ikke hente handleliste" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const body = await request.json();
    const { data, error } = await supabase
      .from("shopping_items")
      .insert(body)
      .select();
    if (error) throw error;
    // Return single object for single inserts, array for bulk
    return NextResponse.json(Array.isArray(body) ? (data ?? []) : (data?.[0] ?? null));
  } catch (err) {
    console.error("POST /api/shopping:", err);
    return NextResponse.json({ error: "Kunne ikke legge til vare" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const { ids, ...fields } = await request.json();
    // ids: string[] — update multiple rows at once
    const idList: string[] = Array.isArray(ids) ? ids : [ids];

    const { data, error } = await supabase
      .from("shopping_items")
      .update(fields)
      .in("id", idList)
      .select();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("PUT /api/shopping:", err);
    return NextResponse.json({ error: "Kunne ikke oppdatere vare" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const { error } = await supabase.from("shopping_items").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/shopping:", err);
    return NextResponse.json({ error: "Kunne ikke slette vare" }, { status: 500 });
  }
}
