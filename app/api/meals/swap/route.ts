// POST /api/meals/swap — swap two meals' dates and update shopping_items for_day
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const { mealAId, mealBId, dateA, dateB } = await request.json();

    // Swap meal dates
    const [resA, resB] = await Promise.all([
      supabase.from("meals").update({ meal_date: dateB }).eq("id", mealAId),
      supabase.from("meals").update({ meal_date: dateA }).eq("id", mealBId),
    ]);

    if (resA.error) throw resA.error;
    if (resB.error) throw resB.error;

    // Update shopping_items for_day (dateA items → dateB, dateB → dateA)
    // Use a temp sentinel to avoid collision
    const TEMP = "1970-01-01";

    await supabase
      .from("shopping_items")
      .update({ for_day: TEMP })
      .eq("for_day", dateA);

    await supabase
      .from("shopping_items")
      .update({ for_day: dateA })
      .eq("for_day", dateB);

    await supabase
      .from("shopping_items")
      .update({ for_day: dateB })
      .eq("for_day", TEMP);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/meals/swap:", err);
    return NextResponse.json({ error: "Kunne ikke bytte middager" }, { status: 500 });
  }
}
