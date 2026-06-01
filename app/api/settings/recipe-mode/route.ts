// GET /api/settings/recipe-mode — read recipe mode
// PUT /api/settings/recipe-mode — update recipe mode
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "recipe_mode")
    .maybeSingle();
  return NextResponse.json({ mode: data?.value ?? "external" });
}

export async function PUT(request: NextRequest) {
  const supabase = createServerClient();
  const { mode } = await request.json();

  const { data: existing } = await supabase
    .from("app_settings")
    .select("key")
    .eq("key", "recipe_mode")
    .maybeSingle();

  if (existing) {
    await supabase.from("app_settings").update({ value: mode, updated_at: new Date().toISOString() }).eq("key", "recipe_mode");
  } else {
    await supabase.from("app_settings").insert({ key: "recipe_mode", value: mode });
  }

  return NextResponse.json({ mode });
}
