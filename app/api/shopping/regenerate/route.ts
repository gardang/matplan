// POST /api/shopping/regenerate — regenerate auto items, keep manual/edited
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { getActiveModel } from "@/lib/app-settings";
import { normalizeItemName } from "@/lib/normalize";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const { planId, meals } = await request.json();

    // Step 1: delete auto, non-edited items
    await supabase
      .from("shopping_items")
      .delete()
      .eq("plan_id", planId)
      .eq("is_auto", true)
      .eq("is_edited", false);

    // Step 2: get kept items (manual/edited/staples)
    const { data: keptItems } = await supabase
      .from("shopping_items")
      .select("item_name")
      .eq("plan_id", planId);

    const keptNormalized = new Set(
      (keptItems ?? []).map((i) => normalizeItemName(i.item_name).toLowerCase())
    );

    // Step 3: AI generate new items from current meals
    const client = new Anthropic();
    const [model, systemPrompt] = await Promise.all([
      getActiveModel(),
      buildSystemPrompt(),
    ]);
    const mealList = (meals ?? [])
      .map((m: { meal_name: string; meal_date: string }) => `- ${m.meal_name} (${m.meal_date})`)
      .join("\n");

    const response = await client.messages.create({
      model,
      max_tokens: 8000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Lag en handleliste for disse middagene:\n${mealList}\n\nReturner JSON: {"items":[{"name":"...","quantity":"...","category":"...","forDay":"YYYY-MM-DD"}]}\nSvar KUN med JSON.`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    let parsed: { items?: Array<{ name: string; quantity?: string; category?: string; forDay?: string }> } | null = null;
    try {
      const m = text.match(/\{"items"\s*:\s*\[[\s\S]*?\]\s*\}/);
      if (m) parsed = JSON.parse(m[0]);
      else parsed = JSON.parse(text.slice(text.indexOf("{")));
    } catch {}

    if (!parsed?.items) {
      return NextResponse.json({ error: "AI svarte ikke med gyldig JSON" }, { status: 500 });
    }

    // Step 4: deduplicate against kept items, insert new
    const toInsert = parsed.items.filter(
      (item) => !keptNormalized.has(normalizeItemName(item.name).toLowerCase())
    );

    if (toInsert.length > 0) {
      await supabase.from("shopping_items").insert(
        toInsert.map((item) => ({
          plan_id: planId,
          item_name: item.name,
          quantity: item.quantity ?? null,
          category: item.category ?? "Annet",
          for_day: item.forDay ?? null,
          is_auto: true,
          is_edited: false,
          is_staple: false,
          checked: false,
        }))
      );
    }

    // Return updated list
    const { data: allItems } = await supabase
      .from("shopping_items")
      .select("*")
      .eq("plan_id", planId)
      .order("created_at");

    return NextResponse.json(allItems ?? []);
  } catch (err) {
    console.error("POST /api/shopping/regenerate:", err);
    return NextResponse.json({ error: "Kunne ikke regenerere handleliste" }, { status: 500 });
  }
}
