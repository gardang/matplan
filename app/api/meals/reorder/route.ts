// POST /api/meals/reorder — bulk-update dates after drag-and-drop reorder
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const { updates, planId } = await request.json() as {
      updates: Array<{ id: string; old_date: string; meal_date: string }>;
      planId?: string;
    };
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ ok: true });
    }

    // Update shopping_items.for_day atomically (single SQL statement — no collision risk
    // even when dates rotate, because array_position evaluation uses pre-update values).
    if (planId) {
      const oldDates = updates.map((u) => u.old_date);
      const newDates = updates.map((u) => u.meal_date);
      const { error: rpcError } = await supabase.rpc("reorder_shopping_for_day", {
        p_plan_id: planId,
        p_old_dates: oldDates,
        p_new_dates: newDates,
      });
      if (rpcError) {
        console.error("POST /api/meals/reorder — reorder_shopping_for_day RPC failed:", rpcError);
      }
    }

    // Update meal dates
    await Promise.all(
      updates.map(({ id, meal_date }) =>
        supabase.from("meals").update({ meal_date }).eq("id", id)
      )
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/meals/reorder:", err);
    return NextResponse.json({ error: "Kunne ikke oppdatere rekkefølge" }, { status: 500 });
  }
}
