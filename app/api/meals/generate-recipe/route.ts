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
    {"name": "Kyllingfilet", "quantity": "600 g"}
  ],
  "steps": [
    "Skjær kyllingfileten i strimler og krydre med salt og pepper.",
    "Varm olje i en wokpanne på høy varme..."
  ]
}

Difficulty skal være en av: Enkel, Middels, Krevende
Steps skal være 4-8 tydelige steg på norsk.
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

    // Store in DB
    await supabase.from("meals").update({ ai_recipe: recipe }).eq("id", mealId);

    return NextResponse.json(recipe);
  } catch (err) {
    console.error("POST /api/meals/generate-recipe:", err);
    return NextResponse.json({ error: "Kunne ikke generere oppskrift" }, { status: 500 });
  }
}
