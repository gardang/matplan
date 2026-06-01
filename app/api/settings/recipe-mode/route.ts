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

  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "recipe_mode", value: mode }, { onConflict: "key" });

  if (error) {
    console.error("PUT /api/settings/recipe-mode:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ mode });
}
