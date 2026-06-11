// POST /api/receipts/sync — fetch new receipts from a connected store,
// store them, map product names, and update shopping_patterns.
// Body: { store: "trumf" }  (coop/rema: planned)
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import {
  fetchTrumfTransactions,
  fetchTrumfReceiptDetail,
  toNumber,
  toDateOnly,
  lineDiscount,
  isBonusConsumption,
  TrumfAuthError,
} from "@/lib/stores/trumf";
import { mapUnknownProducts, updatePatternsFromReceipts } from "@/lib/receipt-learning";
import { toLocalDateString } from "@/lib/normalize";
import type { StoreId } from "@/lib/types";

export const maxDuration = 300; // detail fetches are sequential and can be slow

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  let store: StoreId | undefined;
  try {
    ({ store } = (await request.json()) as { store: StoreId });

    if (store !== "trumf") {
      return NextResponse.json(
        { error: "Foreløpig støttes bare Trumf (Kiwi/Meny/Spar/Joker)" },
        { status: 400 }
      );
    }

    const { data: conn } = await supabase
      .from("store_connections")
      .select("*")
      .eq("store", store)
      .maybeSingle();

    if (!conn?.access_token) {
      return NextResponse.json(
        { error: "Ingen Trumf-tilkobling. Lim inn token under Innstillinger → Butikker." },
        { status: 400 }
      );
    }

    // Mark sync in progress so the Butikker panel reflects it across navigations.
    await supabase
      .from("store_connections")
      .update({
        status: "syncing",
        status_message: null,
        sync_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("store", store);

    // Sync window: from last sync minus 7 days (overlap is fine — sync is
    // idempotent on (store, external_id)), or 12 months back on first sync
    // (Trumf keeps 12 months of receipts).
    const today = new Date();
    const from = new Date(today);
    if (conn.last_sync_at) {
      from.setTime(new Date(conn.last_sync_at).getTime());
      from.setDate(from.getDate() - 7);
    } else {
      from.setMonth(from.getMonth() - 12);
      from.setDate(from.getDate() + 1);
    }
    const to = new Date(today);
    to.setDate(to.getDate() + 1); // 'til' is exclusive

    let transactions;
    try {
      transactions = await fetchTrumfTransactions(
        conn.access_token,
        toLocalDateString(from),
        toLocalDateString(to)
      );
    } catch (err) {
      if (err instanceof TrumfAuthError) {
        await supabase
          .from("store_connections")
          .update({
            status: "expired",
            status_message: "Token utløpt — lim inn nytt fra trumf.no",
            sync_started_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("store", store);
        return NextResponse.json(
          { error: "Trumf-token er utløpt. Lim inn et nytt token fra trumf.no." },
          { status: 401 }
        );
      }
      throw err;
    }

    // Skip already-synced receipts
    const { data: existingRows } = await supabase
      .from("receipts")
      .select("external_id")
      .eq("store", store);
    const existingIds = new Set((existingRows ?? []).map((r) => r.external_id));
    const newTransactions = transactions.filter(
      // Skip bonus withdrawals/redemptions (not grocery spend; empty batchId)
      // and anything already synced.
      (t) => !isBonusConsumption(t) && t.batchId && !existingIds.has(t.batchId)
    );

    let receiptsAdded = 0;
    let itemsAdded = 0;

    for (const trans of newTransactions) {
      // Fetch the digital receipt (header + line items) only when one exists.
      let detail = null;
      if (trans.harKvittering) {
        try {
          detail = await fetchTrumfReceiptDetail(conn.access_token, trans.batchId);
        } catch (err) {
          console.error(`sync — receipt detail failed for ${trans.batchId}:`, err);
          // fall through: still record the transaction header for spend tracking
        }
      }

      const purchaseDate =
        toDateOnly(detail?.transaksjonsTidspunkt) ??
        toDateOnly(trans.transaksjonsTidspunkt) ??
        toDateOnly(trans.bonusberegningTidspunkt);
      if (!purchaseDate) {
        console.error(`sync — no date for ${trans.batchId}, skipping`);
        continue;
      }

      const { data: receipt, error: insertErr } = await supabase
        .from("receipts")
        .insert({
          store,
          external_id: trans.batchId,
          chain: trans.partnerId ?? null,
          store_name: trans.beskrivelse ?? null,
          purchase_date: purchaseDate,
          total_amount: toNumber(trans.belop),
          bonus_amount: toNumber(trans.bonus),
          raw: { transaction: trans, detail },
        })
        .select("id")
        .single();

      if (insertErr || !receipt) {
        console.error(`sync — receipt insert failed for ${trans.batchId}:`, insertErr);
        continue;
      }
      receiptsAdded++;

      const lines = detail?.varelinjer ?? [];
      if (lines.length > 0) {
        const items = lines.map((v) => {
          const qty = toNumber(v.antall) ?? 1;
          const total = toNumber(v.belop);
          return {
            receipt_id: receipt.id,
            ean: null, // Trumf line items carry no EAN/barcode
            product_text: v.produktBeskrivelse,
            quantity: qty,
            unit: v.enhetsType ?? null,
            total_price: total,
            unit_price: total !== null && qty > 0 ? Number((total / qty).toFixed(2)) : null,
            discount: lineDiscount(v.besparelser),
          };
        });
        const { error: itemsErr } = await supabase.from("receipt_items").insert(items);
        if (itemsErr) console.error(`sync — items insert failed for ${trans.batchId}:`, itemsErr);
        else itemsAdded += items.length;
      }
    }

    // Learning pipeline
    const mapped = await mapUnknownProducts(supabase);
    const patternsUpdated = await updatePatternsFromReceipts(supabase);

    await supabase
      .from("store_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        status: "connected",
        status_message: null,
        sync_started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("store", store);

    return NextResponse.json({
      ok: true,
      receiptsAdded,
      itemsAdded,
      productsMapped: mapped,
      patternsUpdated,
    });
  } catch (err) {
    console.error("POST /api/receipts/sync:", err);
    // Don't leave the connection stuck in 'syncing' if something threw.
    if (store) {
      await supabase
        .from("store_connections")
        .update({
          status: "error",
          status_message: "Synkronisering feilet",
          sync_started_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("store", store);
    }
    return NextResponse.json({ error: "Synkronisering feilet" }, { status: 500 });
  }
}
