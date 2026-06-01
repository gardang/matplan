// POST /api/meals/generate-recipe — generate AI recipe card and store in meals.ai_recipe
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { getActiveModel } from "@/lib/app-settings";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const { mealId, meal_name, description } = await request.json() as {
      mealId: string;
      meal_name: string;
      description?: string;
    };

    const client = new Anthropic();
    const [model, systemPrompt] = await Promise.all([getActiveModel(), buildSystemPrompt()]);

    const response = await client.messages.create({
      model,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Lag en komplett norsk oppskrift for "${meal_name}"${description ? ` (${description})` : ""}.

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
Svar KUN med JSON.`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    let recipe = null;
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) recipe = JSON.parse(m[0]);
    } catch {}

    if (!recipe) {
      return NextResponse.json({ error: "AI svarte ikke med gyldig JSON" }, { status: 500 });
    }

    // Look up meal's plan_id and meal_date so we can sync the shopping list
    const { data: mealRow } = await supabase
      .from("meals")
      .select("plan_id, meal_date")
      .eq("id", mealId)
      .single();

    // Store recipe in DB
    await supabase.from("meals").update({ ai_recipe: recipe }).eq("id", mealId);

    // Sync shopping list: replace auto items for this day with the recipe's ingredients
    if (mealRow?.plan_id && mealRow?.meal_date) {
      const mealDate = (mealRow.meal_date as string).substring(0, 10);

      await supabase
        .from("shopping_items")
        .delete()
        .eq("plan_id", mealRow.plan_id)
        .eq("for_day", mealDate)
        .eq("is_auto", true)
        .eq("is_edited", false);

      const ingredients = (recipe.ingredients as Array<{ name: string; quantity: string; category?: string }>) ?? [];
      if (ingredients.length > 0) {
        await supabase.from("shopping_items").insert(
          ingredients.map((ing) => ({
            plan_id: mealRow.plan_id,
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
    }

    return NextResponse.json(recipe);
  } catch (err) {
    console.error("POST /api/meals/generate-recipe:", err);
    return NextResponse.json({ error: "Kunne ikke generere oppskrift" }, { status: 500 });
  }
}
