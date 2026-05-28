// POST /api/meals/suggest — return AI meal suggestions with real recipe URLs
import { NextRequest, NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { getActiveModel } from "@/lib/app-settings";
import { matchUrlToRecipe, fallbackSearchUrl } from "@/lib/normalize";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  try {
    const { date, hint } = await request.json();

    const [systemPrompt, model] = await Promise.all([
      buildSystemPrompt(),
      getActiveModel(),
    ]);

    const hintLine = hint ? ` Ingredienser tilgjengelig: ${hint}.` : "";
    const userMessage = `Foreslå 3-4 middagsideer for ${date}.${hintLine}

Bruk web_search for å finne ekte oppskriftslenker fra matprat.no eller godt.no for hvert forslag.

Returner KUN dette JSON-objektet, ingen annen tekst:
{"suggestions":[{"name":"...","description":"...","source":"...","extraIngredients":"...","recipeUrl":"https://..."}]}`;

    const client = new Anthropic();
    const response = await client.messages.create({
      model,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
    });

    // Extract text and search result URLs
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

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
    let parsed: { suggestions?: Array<{ name: string; description?: string; source?: string; extraIngredients?: string; recipeUrl?: string }> } | null = null;
    const m = text.match(/\{"suggestions"\s*:\s*\[[\s\S]*\]\s*\}/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch {}
    }
    if (!parsed) {
      const start = text.indexOf("{");
      if (start !== -1) {
        try { parsed = JSON.parse(text.slice(start)); } catch {}
      }
    }

    if (!parsed?.suggestions) {
      return NextResponse.json({ error: "AI svarte ikke med gyldig JSON" }, { status: 500 });
    }

    // Resolve real URLs: use AI-provided URL if valid, else match from search results, else fallback
    const suggestions = parsed.suggestions.map((s) => ({
      ...s,
      recipeUrl:
        s.recipeUrl && s.recipeUrl.startsWith("http")
          ? s.recipeUrl
          : matchUrlToRecipe(s.name, searchUrls) ?? fallbackSearchUrl(s.name),
    }));

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("POST /api/meals/suggest:", err);
    return NextResponse.json({ error: "Kunne ikke hente forslag" }, { status: 500 });
  }
}
