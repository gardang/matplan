// GET/POST/PUT/DELETE shopping categories
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("shopping_categories")
    .select("*")
    .order("sort_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const { name } = await request.json() as { name: string };
    if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

    // Place new category last
    const { data: last } = await supabase
      .from("shopping_categories")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sort_order = (last?.sort_order ?? 0) + 1;

    const { data, error } = await supabase
      .from("shopping_categories")
      .insert({ name: name.trim(), sort_order, active: true })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Kunne ikke legge til kategori" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const { id, ...fields } = await request.json() as { id: string; [k: string]: unknown };
    const { data, error } = await supabase
      .from("shopping_categories")
      .update(fields)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Kunne ikke oppdatere kategori" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabase.from("shopping_categories").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
