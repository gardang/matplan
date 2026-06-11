// Receipt learning pipeline:
// 1. mapUnknownProducts — map raw receipt texts to clean item names (AI + cache)
// 2. updatePatternsFromReceipts — aggregate receipt_items into shopping_patterns
//
// Rules: skills/shopping-logic/SKILL.md, _context/normalize.md

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveModel } from "./app-settings";

const MAP_BATCH_SIZE = 60;

interface MappedProduct {
  product_text: string;
  item_name: string;
  category: string;
}

/**
 * Map receipt product texts without a normalized_name.
 * Cache-first via product_mappings (manual mappings always win),
 * then AI for the rest, persisting new mappings.
 * Returns number of items mapped.
 */
export async function mapUnknownProducts(supabase: SupabaseClient): Promise<number> {
  const { data: unmapped } = await supabase
    .from("receipt_items")
    .select("id, ean, product_text")
    .is("normalized_name", null)
    .limit(2000);

  if (!unmapped || unmapped.length === 0) return 0;

  // ── 1. Apply cached mappings ──────────────────────────────────────────────
  const { data: mappings } = await supabase
    .from("product_mappings")
    .select("match_text, item_name");

  const cache = new Map<string, string>(
    (mappings ?? []).map((m: { match_text: string; item_name: string }) => [
      m.match_text.toLowerCase(),
      m.item_name,
    ])
  );

  let mapped = 0;
  const stillUnknown: { id: string; product_text: string }[] = [];

  for (const item of unmapped) {
    const hit = cache.get(item.product_text.toLowerCase());
    if (hit) {
      await supabase.from("receipt_items").update({ normalized_name: hit }).eq("id", item.id);
      mapped++;
    } else {
      stillUnknown.push(item);
    }
  }

  if (stillUnknown.length === 0) return mapped;

  // ── 2. AI-map distinct unknown texts in batches ───────────────────────────
  const distinctTexts = [...new Set(stillUnknown.map((i) => i.product_text))];
  const { data: catRows } = await supabase
    .from("shopping_categories")
    .select("name")
    .eq("active", true)
    .order("sort_order");
  const categories = (catRows ?? []).map((c: { name: string }) => c.name);

  const client = new Anthropic();
  const model = await getActiveModel();

  for (let i = 0; i < distinctTexts.length; i += MAP_BATCH_SIZE) {
    const batch = distinctTexts.slice(i, i + MAP_BATCH_SIZE);

    const prompt = `Du får rå varetekster fra norske butikk-kvitteringer (Kiwi, Obs, Rema).
Oversett hver til et kort, rent varenavn slik det ville stått på en handleliste, og velg kategori.

Regler:
- Fjern merkenavn der det ikke er meningsbærende ("GILDE KJØTTDEIG 400G" → "Kjøttdeig"), men behold det når varianten betyr noe ("Pepsi Max", "Norvegia")
- Fjern vekt/volum/pakkestørrelse fra navnet
- Paprika alltid med farge (standard rød). Løk alltid med type (standard rødløk)
- Norsk navn, stor forbokstav
- Kategorier (velg én per vare): ${categories.join(", ")}

Varetekster:
${batch.map((t, idx) => `${idx + 1}. ${t}`).join("\n")}

Returner KUN dette JSON-objektet, ingen annen tekst:
{"products":[{"product_text":"...","item_name":"...","category":"..."}]}`;

    let parsed: { products: MappedProduct[] };
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      });
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("");
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;
      parsed = JSON.parse(jsonMatch[0]) as { products: MappedProduct[] };
    } catch (err) {
      console.error("mapUnknownProducts — AI batch failed:", err);
      continue; // leave batch unmapped; next sync retries
    }

    for (const p of parsed.products ?? []) {
      if (!p.product_text || !p.item_name) continue;

      // Persist mapping (first EAN seen for this text, if any)
      const ean = unmapped.find((u) => u.product_text === p.product_text)?.ean ?? null;

      await supabase
        .from("product_mappings")
        .upsert(
          {
            match_text: p.product_text,
            ean,
            item_name: p.item_name,
            category: categories.includes(p.category) ? p.category : null,
            source: "ai",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "match_text", ignoreDuplicates: true }
        );

      // Apply to all receipt_items with this text
      const ids = stillUnknown
        .filter((u) => u.product_text === p.product_text)
        .map((u) => u.id);
      if (ids.length > 0) {
        await supabase
          .from("receipt_items")
          .update({ normalized_name: p.item_name })
          .in("id", ids);
        mapped += ids.length;
      }
    }
  }

  return mapped;
}

/**
 * Aggregate all mapped receipt_items into shopping_patterns.
 * Computes: times_bought, last_bought, buys_per_month, typical_frequency,
 * avg_price, last_price. Marks pattern_source receipt/both.
 */
export async function updatePatternsFromReceipts(supabase: SupabaseClient): Promise<number> {
  const { data: rows } = await supabase
    .from("receipt_items")
    .select("normalized_name, quantity, unit, total_price, receipts!inner(purchase_date)")
    .not("normalized_name", "is", null);

  if (!rows || rows.length === 0) return 0;

  interface Agg {
    displayName: string;
    dates: string[];
    totalQty: number;
    totalSpent: number;
    pricedLines: number;
    lastPrice: number | null;
    lastDate: string;
    unitCounts: Record<string, number>;
  }

  const byName = new Map<string, Agg>();

  for (const r of rows) {
    const receipt = r.receipts as unknown as { purchase_date: string };
    const key = (r.normalized_name as string).toLowerCase();
    const date = receipt.purchase_date;
    const price = r.total_price as number | null;

    let agg = byName.get(key);
    if (!agg) {
      agg = {
        displayName: r.normalized_name as string,
        dates: [],
        totalQty: 0,
        totalSpent: 0,
        pricedLines: 0,
        lastPrice: null,
        lastDate: "",
        unitCounts: {},
      };
      byName.set(key, agg);
    }
    agg.dates.push(date);
    agg.totalQty += Number(r.quantity ?? 1);
    const unit = ((r.unit as string | null) ?? "stk").toLowerCase();
    agg.unitCounts[unit] = (agg.unitCounts[unit] ?? 0) + 1;
    if (price !== null) {
      agg.totalSpent += Number(price);
      agg.pricedLines++;
      if (date >= agg.lastDate) agg.lastPrice = Number(price);
    }
    if (date >= agg.lastDate) agg.lastDate = date;
  }

  let updated = 0;

  for (const [key, agg] of byName) {
    const uniqueDates = [...new Set(agg.dates)].sort();
    const timesBought = uniqueDates.length;
    const first = new Date(uniqueDates[0] + "T12:00:00");
    const last = new Date(uniqueDates[uniqueDates.length - 1] + "T12:00:00");
    const spanDays = Math.max(
      1,
      Math.round((last.getTime() - first.getTime()) / 86_400_000)
    );

    // buys per month over the observed span (needs ≥2 purchases for a rate)
    const buysPerMonth =
      timesBought >= 2 ? Number(((timesBought - 1) / (spanDays / 30.44) + 0).toFixed(2)) : null;

    let frequency: "weekly" | "biweekly" | "monthly" | "occasional" | null = null;
    if (timesBought >= 2) {
      const avgInterval = spanDays / (timesBought - 1);
      if (avgInterval < 8) frequency = "weekly";
      else if (avgInterval < 16) frequency = "biweekly";
      else if (avgInterval < 36) frequency = "monthly";
      else frequency = "occasional";
    }

    const avgPrice =
      agg.pricedLines > 0 ? Number((agg.totalSpent / agg.pricedLines).toFixed(2)) : null;
    const avgQtyNum = agg.totalQty / Math.max(1, agg.dates.length);
    // Use the item's dominant unit (kg vs stk) so weight and count buys aren't
    // conflated — quantities are still summed numerically above per item.
    const dominantUnit =
      Object.entries(agg.unitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "stk";
    const avgQuantity =
      avgQtyNum % 1 === 0 ? `${avgQtyNum} ${dominantUnit}` : `${avgQtyNum.toFixed(1)} ${dominantUnit}`;

    const { data: existing } = await supabase
      .from("shopping_patterns")
      .select("id, times_bought, pattern_source, avg_quantity")
      .ilike("normalized_name", key)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("shopping_patterns")
        .update({
          times_bought: Math.max(existing.times_bought ?? 0, timesBought),
          last_bought: agg.lastDate,
          typical_frequency: frequency,
          buys_per_month: buysPerMonth,
          avg_price: avgPrice,
          last_price: agg.lastPrice,
          pattern_source: existing.pattern_source === "app" ? "both" : existing.pattern_source ?? "both",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("shopping_patterns").insert({
        item_name: agg.displayName,
        normalized_name: key,
        avg_quantity: avgQuantity,
        times_bought: timesBought,
        last_bought: agg.lastDate,
        typical_frequency: frequency,
        buys_per_month: buysPerMonth,
        avg_price: avgPrice,
        last_price: agg.lastPrice,
        pattern_source: "receipt",
      });
    }
    updated++;
  }

  return updated;
}
