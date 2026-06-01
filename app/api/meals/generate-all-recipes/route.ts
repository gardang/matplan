// POST /api/meals/generate-all-recipes
// Generates AI recipes for all meals in a plan that don't have one yet.
// Runs sequentially so the real-time subscription updates cards one by one.
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { getActiveModel } from "@/lib/app-settings";
import Anthropic from "@anthropic-ai/sdk";
import type { AiRecipe } from "@/lib/types";

const RECIPE_PROMPT = (meal_name: string, description?: string | null) =>
  `Lag en komplett norsk oppskrift for "${meal_name}"${description ? ` (${description})` : ""}.

Returner KUN JSON:
{
  "portions": 4,
  "time_minutes": 30,
  "difficulty": "Enkel",
  "ingredients": [
    {"name": "Kyllingfilet", "quantity": "600 g", "category": "Kjøtt og fisk"}
  ],
  "steps": [
    "Skjær kyllingfileten i strimler og krydre med salt og pepper.",
    "Varm olje i en wokpanne på høy varme..."
  ]
}

Difficulty: Enkel, Middels eller Krevende.
Steps: 4-8 tydelige steg på norsk.
Category per ingredient — én av: Grønnsaker og frukt, Kjøtt og fisk, Meieri og egg, Brød og bakevarer, Tørrvarer, Frysevarer, Annet
Svar KUN med JSON.`;

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const { planId } = await request.json() as { planId: string };
    if (!planId) return NextResponse.json({ error: "planId required" }, { status: 400 });

    // Fetch meals that still need a recipe
    const { data: meals, error } = await supabase
      .from("meals")
      .select("id, meal_name, description, meal_date")
      .eq("plan_id", planId)
      .is("ai_recipe", null)
      .order("meal_date");

    if (error) throw error;
    if (!meals || meals.length === 0) {
      return NextResponse.json({ generated: 0 });
    }

    const client = new Anthropic();
    const [model, systemPrompt] = await Promise.all([getActiveModel(), buildSystemPrompt()]);

    // Run all recipe generations in parallel — each updates the DB independently
    // so real-time subscriptions on the client see cards populate as they finish
    const results = await Promise.allSettled(
      meals.map(async (meal) => {
        const response = await client.messages.create({
          model,
          max_tokens: 3000,
          system: systemPrompt,
          messages: [{ role: "user", content: RECIPE_PROMPT(meal.meal_name, meal.description) }],
        });

        const text = response.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { type: "text"; text: string }).text)
          .join("");

        let recipe: AiRecipe | null = null;
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
          try { recipe = JSON.parse(m[0]); } catch {}
        }
        if (!recipe) throw new Error(`ugyldig JSON fra AI for ${meal.meal_name}`);

        // Store recipe — triggers real-time subscription on the client
        await supabase.from("meals").update({ ai_recipe: recipe }).eq("id", meal.id);

        // Sync shopping list for this day
        const mealDate = (meal.meal_date as string).substring(0, 10);

        await supabase
          .from("shopping_items")
          .delete()
          .eq("plan_id", planId)
          .eq("for_day", mealDate)
          .eq("is_auto", true)
          .eq("is_edited", false);

        const ingredients = (recipe.ingredients ?? []) as Array<{ name: string; quantity: string; category?: string }>;
        if (ingredients.length > 0) {
          await supabase.from("shopping_items").insert(
            ingredients.map((ing) => ({
              plan_id: planId,
              item_name: ing.name,
              quantity: ing.quantity || null,
              category: ing.category || "Annet",
              for_day: mealDate,
              is_auto: true,
              is_edited: false,
              is_staple: false,
              checked: false,
            }))
          );
        }
      })
    );

    const generated = results.filter((r) => r.status === "fulfilled").length;
    const errors = results
      .map((r, i) => (r.status === "rejected" ? meals[i].meal_name : null))
      .filter(Boolean) as string[];

    if (errors.length) console.error("generate-all-recipes errors:", errors);

    return NextResponse.json({ generated, errors });
  } catch (err) {
    console.error("POST /api/meals/generate-all-recipes:", err);
    return NextResponse.json({ error: "Kunne ikke generere oppskrifter" }, { status: 500 });
  }
}
