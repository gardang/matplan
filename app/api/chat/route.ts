// POST /api/chat — conversational AI endpoint
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { getActiveModel } from "@/lib/app-settings";
import Anthropic from "@anthropic-ai/sdk";

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const planId = searchParams.get("plan_id");

  try {
    const query = supabase.from("chat_messages").select("*").order("created_at");
    if (planId) query.eq("plan_id", planId);
    const { data, error } = await query.limit(100);
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("GET /api/chat:", err);
    return NextResponse.json({ error: "Kunne ikke hente meldinger" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const { message, planId, history } = await request.json();

    // Save user message
    await supabase.from("chat_messages").insert({
      plan_id: planId ?? null,
      role: "user",
      content: message,
    });

    const client = new Anthropic();
    const [systemPrompt, model] = await Promise.all([
      buildSystemPrompt(),
      getActiveModel(),
    ]);

    // Build message history for API call
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...(history ?? []).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const response = await client.messages.create({
      model,
      max_tokens: 8000,
      system: systemPrompt,
      messages,
      tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
    });

    const assistantText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    // Save assistant message
    await supabase.from("chat_messages").insert({
      plan_id: planId ?? null,
      role: "assistant",
      content: assistantText,
    });

    return NextResponse.json({ message: assistantText });
  } catch (err) {
    console.error("POST /api/chat:", err);
    return NextResponse.json(
      { error: "Kunne ikke sende melding. Prøv igjen." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const planId = searchParams.get("plan_id");

  try {
    const query = supabase.from("chat_messages").delete();
    if (planId) query.eq("plan_id", planId);
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/chat:", err);
    return NextResponse.json({ error: "Kunne ikke slette chat" }, { status: 500 });
  }
}
