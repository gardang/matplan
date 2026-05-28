// GET /api/settings/model — read active model
// PUT /api/settings/model — update active model
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getActiveModel } from "@/lib/app-settings";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "@/lib/constants";

export async function GET() {
  const model = await getActiveModel();
  return NextResponse.json({ model });
}

export async function PUT(request: NextRequest) {
  const { model } = await request.json();

  const valid = AVAILABLE_MODELS.some((m) => m.id === model);
  if (!valid) {
    return NextResponse.json({ error: "Ugyldig modell" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error } = await supabase.from("app_settings").upsert(
    { key: "model", value: model, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );

  if (error) {
    console.error("PUT /api/settings/model:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ model });
}
