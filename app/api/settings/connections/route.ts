// GET/POST/DELETE /api/settings/connections — store integrations (Trumf/Coop/Rema)
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import type { StoreId } from "@/lib/types";

const VALID_STORES: StoreId[] = ["trumf", "coop", "rema"];

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("store_connections")
    .select("id, store, token_expires_at, last_sync_at, sync_started_at, status, status_message, updated_at")
    .order("store");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Note: access_token deliberately excluded from the response
  return NextResponse.json({ connections: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const { store, accessToken } = (await request.json()) as {
      store: StoreId;
      accessToken: string;
    };

    if (!VALID_STORES.includes(store)) {
      return NextResponse.json({ error: "Ukjent butikk" }, { status: 400 });
    }
    if (!accessToken || accessToken.trim().length < 20) {
      return NextResponse.json({ error: "Ugyldig token" }, { status: 400 });
    }

    const { error } = await supabase.from("store_connections").upsert(
      {
        store,
        access_token: accessToken.trim(),
        status: "connected",
        status_message: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "store" }
    );

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/settings/connections:", err);
    return NextResponse.json({ error: "Kunne ikke lagre tilkobling" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerClient();
  const store = request.nextUrl.searchParams.get("store");
  if (!store || !VALID_STORES.includes(store as StoreId)) {
    return NextResponse.json({ error: "Ukjent butikk" }, { status: 400 });
  }

  const { error } = await supabase
    .from("store_connections")
    .update({
      access_token: null,
      status: "disconnected",
      status_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("store", store);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
