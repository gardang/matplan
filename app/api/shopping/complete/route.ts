// POST /api/shopping/complete — record shopping patterns, clear checked items
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { normalizeItemName } from "@/lib/normalize";

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const { planId } = await request.json();

    // Get all checked items
    const { data: checkedItems, error: fetchError } = await supabase
      .from("shopping_items")
      .select("*")
      .eq("plan_id", planId)
      .eq("checked", true);

    if (fetchError) throw fetchError;
    if (!checkedItems || checkedItems.length === 0) {
      return NextResponse.json({ ok: true, learned: 0 });
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    // Upsert into shopping_patterns for each checked item
    for (const item of checkedItems) {
      const normalized = normalizeItemName(item.item_name).toLowerCase();

      // Get existing pattern
      const { data: existing } = await supabase
        .from("shopping_patterns")
        .select("*")
        .ilike("normalized_name", normalized)
        .maybeSingle();

      if (existing) {
        const timesBought = (existing.times_bought ?? 0) + 1;
        const lastBought = existing.last_bought;

        // Calculate frequency
        let frequency = existing.typical_frequency;
        if (lastBought) {
          const lastDate = new Date(lastBought);
          const daysBetween = Math.round(
            (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysBetween < 8) frequency = "weekly";
          else if (daysBetween < 16) frequency = "biweekly";
          else if (daysBetween < 36) frequency = "monthly";
          else frequency = "occasional";
        }

        await supabase
          .from("shopping_patterns")
          .update({
            times_bought: timesBought,
            last_bought: todayStr,
            typical_frequency: frequency,
            avg_quantity: item.quantity ?? existing.avg_quantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("shopping_patterns").insert({
          item_name: item.item_name,
          normalized_name: normalized,
          avg_quantity: item.quantity ?? null,
          times_bought: 1,
          last_bought: todayStr,
          category: item.category ?? null,
          typical_frequency: null,
        });
      }
    }

    // Delete checked items
    await supabase
      .from("shopping_items")
      .delete()
      .eq("plan_id", planId)
      .eq("checked", true);

    return NextResponse.json({ ok: true, learned: checkedItems.length });
  } catch (err) {
    console.error("POST /api/shopping/complete:", err);
    return NextResponse.json({ error: "Kunne ikke fullføre handlingen" }, { status: 500 });
  }
}
