// POST /api/meals/fetch-links
// Phase 2: find verified recipe URLs via web search
// Phase 3 (optional): scrape recipe pages and extract real ingredients into shopping list
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { matchUrlToRecipe, fallbackSearchUrl } from "@/lib/normalize";
import { getActiveModel } from "@/lib/app-settings";
import Anthropic from "@anthropic-ai/sdk";

// Extract ingredient strings from schema.org JSON-LD on a recipe page
function extractFromJsonLd(html: string): string[] | null {
  const scriptTags = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  ) ?? [];

  for (const tag of scriptTags) {
    const inner = tag.match(/<script[^>]*>([\s\S]*?)<\/script>/i)?.[1];
    if (!inner) continue;
    try {
      const json = JSON.parse(inner);
      const candidates: unknown[] = Array.isArray(json["@graph"]) ? json["@graph"] : [json];
      for (const item of candidates) {
        const obj = item as Record<string, unknown>;
        const type = obj["@type"];
        if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) {
          if (Array.isArray(obj.recipeIngredient)) return obj.recipeIngredient as string[];
        }
      }
    } catch {}
  }
  return null;
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const body = await request.json() as {
      meals: Array<{ id: string; meal_name: string; meal_date?: string }>;
      planId?: string;
      extractIngredients?: boolean;
    };
    const { meals, planId, extractIngredients } = body;
    if (!meals?.length) return NextResponse.json({ ok: true });

    const client = new Anthropic();
    const model = await getActiveModel();

    // ── Phase 2: web search for recipe URLs ────────────────────────────────────
    const mealList = meals.map((m, i) => `${i + 1}. ${m.meal_name}`).join("\n");

    const searchResponse = await client.messages.create({
      model,
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Finn ekte oppskriftslenker på matprat.no eller godt.no for disse middagene. Søk etter hver rett:\n${mealList}\n\nReturner JSON-array: [{"name":"...","url":"https://..."}]\nSvar KUN med JSON.`,
        },
      ],
      tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
    });

    const searchUrls: Array<{ url: string; title?: string }> = [];
    for (const block of searchResponse.content) {
      if (
        block.type === "web_search_tool_result" &&
        Array.isArray((block as { type: string; content: unknown[] }).content)
      ) {
        for (const r of (block as { type: string; content: Array<{ type: string; url?: string; title?: string }> }).content) {
          if (r.type === "web_search_result" && r.url) {
            searchUrls.push({ url: r.url, title: r.title });
          }
        }
      }
    }

    const text = searchResponse.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    let parsed: Array<{ name: string; url: string }> | null = null;
    try {
      const m = text.match(/\[[\s\S]*\]/);
      if (m) parsed = JSON.parse(m[0]);
    } catch {}

    // Resolve best URL per meal and update DB
    const mealsWithUrls: Array<{ id: string; meal_name: string; meal_date: string; recipe_url: string }> = [];

    for (const meal of meals) {
      let recipeUrl: string | null = null;
      if (parsed) {
        const entry = parsed.find((p) =>
          p.url?.startsWith("http") &&
          p.name?.toLowerCase().includes(meal.meal_name.toLowerCase().split(" ")[0])
        );
        if (entry?.url) recipeUrl = entry.url;
      }
      if (!recipeUrl) recipeUrl = matchUrlToRecipe(meal.meal_name, searchUrls);
      if (!recipeUrl) recipeUrl = fallbackSearchUrl(meal.meal_name);

      if (recipeUrl) {
        await supabase.from("meals").update({ recipe_url: recipeUrl }).eq("id", meal.id);
        mealsWithUrls.push({
          id: meal.id,
          meal_name: meal.meal_name,
          meal_date: (meal.meal_date ?? "").substring(0, 10),
          recipe_url: recipeUrl,
        });
      }
    }

    // ── Phase 3: extract real ingredients from recipe pages ────────────────────
    if (extractIngredients && planId && mealsWithUrls.length > 0) {
      // Fetch all recipe HTML pages in parallel
      const htmlResults = await Promise.all(
        mealsWithUrls.map(async (meal) => {
          try {
            const html = await fetch(meal.recipe_url, {
              headers: { "User-Agent": "Mozilla/5.0 (compatible; MatplanBot/1.0)" },
              signal: AbortSignal.timeout(10000),
            }).then((r) => r.text());
            const ingredients = extractFromJsonLd(html);
            return { ...meal, ingredients };
          } catch {
            return { ...meal, ingredients: null };
          }
        })
      );

      // Collect meals that have extractable ingredients
      const withIngredients = htmlResults.filter((r) => r.ingredients && r.ingredients.length > 0);

      if (withIngredients.length > 0) {
        // One Claude call to categorize all meals' ingredients
        const ingredientBlock = withIngredients
          .map((m) => `=== ${m.id} | ${m.meal_name} ===\n${m.ingredients!.join("\n")}`)
          .join("\n\n");

        const categorizeResponse = await client.messages.create({
          model,
          max_tokens: 4000,
          messages: [
            {
              role: "user",
              content: `Kategoriser disse ingrediensene til handleliste-format. Svar KUN med JSON-array:\n[\n  {"mealId":"...","items":[{"name":"...","quantity":"...","category":"..."}]}\n]\n\nKategorier: Grønnsaker og frukt, Kjøtt og fisk, Meieri og egg, Brød og bakevarer, Tørrvarer, Frysevarer, Annet\n\n${ingredientBlock}`,
            },
          ],
        });

        const catText = categorizeResponse.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { type: "text"; text: string }).text)
          .join("");

        let categorized: Array<{
          mealId: string;
          items: Array<{ name: string; quantity: string; category: string }>;
        }> | null = null;
        try {
          const m = catText.match(/\[[\s\S]*\]/);
          if (m) categorized = JSON.parse(m[0]);
        } catch {}

        if (categorized?.length) {
          for (const { mealId, items } of categorized) {
            const meal = withIngredients.find((m) => m.id === mealId);
            if (!meal?.meal_date || !items?.length) continue;

            // Delete old auto items for this day
            await supabase
              .from("shopping_items")
              .delete()
              .eq("plan_id", planId)
              .eq("for_day", meal.meal_date)
              .eq("is_auto", true)
              .eq("is_edited", false);

            // Insert scraped ingredients
            await supabase.from("shopping_items").insert(
              items.map((item) => ({
                plan_id: planId,
                item_name: item.name,
                quantity: item.quantity || null,
                category: item.category || "Annet",
                for_day: meal.meal_date,
                is_auto: true,
                is_edited: false,
                is_staple: false,
                checked: false,
              }))
            );
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/meals/fetch-links:", err);
    return NextResponse.json({ error: "Kunne ikke hente oppskriftslenker" }, { status: 500 });
  }
}
