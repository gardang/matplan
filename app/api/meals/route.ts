// GET /api/meals?plan_id=... — fetch meals for a plan
// POST /api/meals — AI generate or manual create
// PUT /api/meals — update meal
// DELETE /api/meals?id=... — delete meal
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { matchUrlToRecipe, fallbackSearchUrl, toLocalDateString } from "@/lib/normalize";
import { DAY_LABELS_LONG } from "@/lib/constants";
import { getActiveModel } from "@/lib/app-settings";
import Anthropic from "@anthropic-ai/sdk";

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const planId = searchParams.get("plan_id");
  if (!planId) return NextResponse.json({ error: "plan_id required" }, { status: 400 });

  try {
    const { data, error } = await supabase
      .from("meals")
      .select("*")
      .eq("plan_id", planId)
      .order("meal_date");
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("GET /api/meals:", err);
    return NextResponse.json({ error: "Kunne ikke hente måltider" }, { status: 500 });
  }
}

// ── POST — AI generation ──────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const body = await request.json();
    const { planId, dateFrom, dateTo, existingMeals, generate } = body;

    // Manual create (no AI)
    if (!generate) {
      const { meal_date, meal_name, description, recipe_url, recipe_source, notes } = body;
      const { data, error } = await supabase
        .from("meals")
        .insert({ plan_id: planId, meal_date, meal_name, description, recipe_url, recipe_source, notes })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data);
    }

    // AI generation
    const client = new Anthropic();

    // Build day list
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const days: Date[] = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    const plannedByDate: Record<string, string> = {};
    for (const m of existingMeals ?? []) {
      plannedByDate[m.meal_date] = m.meal_name;
    }

    const dayLines = days
      .map((d, i) => {
        const ds = toLocalDateString(d);
        const label = `${DAY_LABELS_LONG[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
        const planned = plannedByDate[ds];
        return planned
          ? `${i + 1}. ${ds} (${label}) → ALLEREDE PLANLAGT: ${planned}`
          : `${i + 1}. ${ds} (${label}) → TRENGER MIDDAG`;
      })
      .join("\n");

    const neededCount = days.filter((d) => !plannedByDate[toLocalDateString(d)]).length;

    const userMessage = `Du skal planlegge middager for NØYAKTIG ${neededCount} dager (ikke 7 — ${neededCount}!).

${dayLines}

Returner et JSON-objekt med BÅDE "meals" og "items":
{
  "meals": [{"date":"YYYY-MM-DD","name":"...","description":"...","source":"...","recipeUrl":"..."}],
  "items": [{"name":"...","quantity":"...","category":"...","forDay":"YYYY-MM-DD"}]
}

Bruk web_search for å finne ekte oppskriftslenker til matprat.no eller godt.no.
Svar KUN med JSON, ingen annen tekst.`;

    const [systemPrompt, model] = await Promise.all([
      buildSystemPrompt(dateFrom, dateTo),
      getActiveModel(),
    ]);

    const response = await client.messages.create({
      model,
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
    });

    // Extract text and search URLs
    const textBlocks = response.content.filter((b) => b.type === "text");
    const text = textBlocks.map((b) => (b as { type: "text"; text: string }).text).join("");

    const searchUrls: Array<{ url: string; title?: string }> = [];
    for (const block of response.content) {
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

    // Parse JSON
    let parsed: { meals?: Array<{ date: string; name: string; description?: string; source?: string; recipeUrl?: string }>; items?: Array<{ name: string; quantity?: string; category?: string; forDay?: string }> } | null = null;
    const patterns = [
      /\{"meals"\s*:\s*\[[\s\S]*?\](?:\s*,\s*"items"\s*:\s*\[[\s\S]*?\])?\s*\}/,
      /\{[\s\S]*"meals"[\s\S]*\}/,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
          break;
        } catch {}
      }
    }
    if (!parsed) {
      const first = text.indexOf("{");
      if (first !== -1) {
        try {
          parsed = JSON.parse(text.slice(first));
        } catch {}
      }
    }

    if (!parsed?.meals) {
      return NextResponse.json({ error: "AI svarte ikke med gyldig JSON" }, { status: 500 });
    }

    // Safety: fix dates where AI guessed the wrong year
    const expectedYear = new Date(dateFrom + "T12:00:00").getFullYear();
    for (const m of parsed.meals) {
      if (m.date?.length >= 10 && parseInt(m.date.substring(0, 4)) !== expectedYear) {
        m.date = String(expectedYear) + m.date.substring(4);
      }
    }

    // Insert meals — upsert on (plan_id, meal_date) so re-generating never fails on duplicates
    const insertedMeals = [];
    for (const m of parsed.meals) {
      const recipeUrl =
        m.recipeUrl && m.recipeUrl.startsWith("http")
          ? m.recipeUrl
          : matchUrlToRecipe(m.name, searchUrls) ?? fallbackSearchUrl(m.name);

      // Try upsert first; fall back to plain insert if no unique constraint exists yet
      let data = null;
      let error = null;

      ({ data, error } = await supabase
        .from("meals")
        .upsert(
          {
            plan_id: planId,
            meal_date: m.date,
            meal_name: m.name,
            description: m.description ?? null,
            recipe_url: recipeUrl,
            recipe_source: m.source ?? null,
          },
          { onConflict: "plan_id,meal_date", ignoreDuplicates: false }
        )
        .select()
        .single());

      if (error) {
        // No unique constraint — fall back to delete-then-insert
        console.warn(`upsert failed for ${m.date}, trying delete+insert:`, error.message);
        await supabase.from("meals").delete().eq("plan_id", planId).eq("meal_date", m.date);
        ({ data, error } = await supabase
          .from("meals")
          .insert({
            plan_id: planId,
            meal_date: m.date,
            meal_name: m.name,
            description: m.description ?? null,
            recipe_url: recipeUrl,
            recipe_source: m.source ?? null,
          })
          .select()
          .single());
      }

      if (error) {
        console.error(`Failed to insert meal for ${m.date}:`, error);
      } else if (data) {
        insertedMeals.push(data);
      }
    }

    if (insertedMeals.length === 0 && parsed.meals.length > 0) {
      console.error("All meal insertions failed — check DB constraints or RLS");
    }

    return NextResponse.json({ meals: insertedMeals, items: parsed.items ?? [] });
  } catch (err) {
    console.error("POST /api/meals:", err);
    return NextResponse.json({ error: "Kunne ikke generere middager" }, { status: 500 });
  }
}

// ── PUT ───────────────────────────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const { id, ...fields } = await request.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const { data, error } = await supabase
      .from("meals")
      .update(fields)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("PUT /api/meals:", err);
    return NextResponse.json({ error: "Kunne ikke oppdatere middag" }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const { error } = await supabase.from("meals").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/meals:", err);
    return NextResponse.json({ error: "Kunne ikke slette middag" }, { status: 500 });
  }
}
