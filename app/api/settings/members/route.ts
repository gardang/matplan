// GET/POST/PUT/DELETE family members
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase.from("family_members").select("*").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const body = await request.json();
    const { data, error } = await supabase.from("family_members").insert(body).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Kunne ikke legge til familiemedlem" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const { id, ...fields } = await request.json();
    const { data, error } = await supabase.from("family_members").update(fields).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Kunne ikke oppdatere familiemedlem" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabase.from("family_members").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
