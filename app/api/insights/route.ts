// GET /api/insights — aggregated shopping stats from synced receipts.
// Query: ?months=3 (default 3, max 12)
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { toLocalDateString } from "@/lib/normalize";
import { getWeeklyBudget } from "@/lib/app-settings";

interface WeekSpend {
  weekStart: string;
  total: number;
}

interface ChainSpend {
  chain: string;
  total: number;
  receipts: number;
}

interface TopItem {
  name: string;
  timesBought: number;
  totalSpent: number;
  avgPrice: number | null;
  avgIntervalDays: number | null;
  lastBought: string;
}

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  try {
    // Window: either a calendar year (?year=2025) or the last N months (?months=3).
    const yearParam = request.nextUrl.searchParams.get("year");
    const year = yearParam && /^\d{4}$/.test(yearParam) ? yearParam : null;
    let months = 0;
    let fromStr: string;
    let toStr: string | null = null;
    if (year) {
      fromStr = `${year}-01-01`;
      toStr = `${year}-12-31`;
    } else {
      months = Math.min(12, Math.max(1, Number(request.nextUrl.searchParams.get("months") ?? 3)));
      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - months);
      fromStr = toLocalDateString(fromDate);
    }

    let receiptsQuery = supabase
      .from("receipts")
      .select("id, chain, store_name, purchase_date, total_amount, bonus_amount")
      .gte("purchase_date", fromStr);
    if (toStr) receiptsQuery = receiptsQuery.lte("purchase_date", toStr);
    const { data: receipts, error: rErr } = await receiptsQuery.order("purchase_date");
    if (rErr) throw rErr;

    let itemsQuery = supabase
      .from("receipt_items")
      .select("normalized_name, quantity, total_price, receipts!inner(purchase_date)")
      .not("normalized_name", "is", null)
      .gte("receipts.purchase_date", fromStr);
    if (toStr) itemsQuery = itemsQuery.lte("receipts.purchase_date", toStr);
    const { data: items, error: iErr } = await itemsQuery;
    if (iErr) throw iErr;

    // Full date range (not windowed) → list of years for the UI selector.
    const { data: earliest } = await supabase
      .from("receipts").select("purchase_date").order("purchase_date", { ascending: true }).limit(1).maybeSingle();
    const { data: latest } = await supabase
      .from("receipts").select("purchase_date").order("purchase_date", { ascending: false }).limit(1).maybeSingle();
    const availableYears: number[] = [];
    if (earliest?.purchase_date && latest?.purchase_date) {
      const y0 = Number(String(earliest.purchase_date).slice(0, 4));
      const y1 = Number(String(latest.purchase_date).slice(0, 4));
      for (let y = y1; y >= y0; y--) availableYears.push(y);
    }

    // ── Spend per week ────────────────────────────────────────────────────────
    const weekMap = new Map<string, number>();
    for (const r of receipts ?? []) {
      const d = new Date(r.purchase_date + "T12:00:00");
      const day = (d.getDay() + 6) % 7; // Monday = 0
      d.setDate(d.getDate() - day);
      const weekStart = toLocalDateString(d);
      weekMap.set(weekStart, (weekMap.get(weekStart) ?? 0) + Number(r.total_amount ?? 0));
    }
    const weeklySpend: WeekSpend[] = [...weekMap.entries()]
      .map(([weekStart, total]) => ({ weekStart, total: Number(total.toFixed(2)) }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

    // ── Spend per chain ───────────────────────────────────────────────────────
    const chainMap = new Map<string, { total: number; receipts: number }>();
    for (const r of receipts ?? []) {
      const chain = r.chain ?? "Ukjent";
      const agg = chainMap.get(chain) ?? { total: 0, receipts: 0 };
      agg.total += Number(r.total_amount ?? 0);
      agg.receipts++;
      chainMap.set(chain, agg);
    }
    const chainSpend: ChainSpend[] = [...chainMap.entries()]
      .map(([chain, v]) => ({ chain, total: Number(v.total.toFixed(2)), receipts: v.receipts }))
      .sort((a, b) => b.total - a.total);

    // ── Top items ─────────────────────────────────────────────────────────────
    interface ItemAgg {
      name: string;
      dates: string[];
      spent: number;
      pricedLines: number;
    }
    const itemMap = new Map<string, ItemAgg>();
    for (const it of items ?? []) {
      const receipt = it.receipts as unknown as { purchase_date: string };
      const key = (it.normalized_name as string).toLowerCase();
      const agg = itemMap.get(key) ?? {
        name: it.normalized_name as string,
        dates: [],
        spent: 0,
        pricedLines: 0,
      };
      agg.dates.push(receipt.purchase_date);
      if (it.total_price !== null) {
        agg.spent += Number(it.total_price);
        agg.pricedLines++;
      }
      itemMap.set(key, agg);
    }

    const topItems: TopItem[] = [...itemMap.values()]
      .map((agg) => {
        const uniqueDates = [...new Set(agg.dates)].sort();
        const timesBought = uniqueDates.length;
        let avgIntervalDays: number | null = null;
        if (timesBought >= 2) {
          const first = new Date(uniqueDates[0] + "T12:00:00");
          const last = new Date(uniqueDates[uniqueDates.length - 1] + "T12:00:00");
          avgIntervalDays = Math.round(
            (last.getTime() - first.getTime()) / 86_400_000 / (timesBought - 1)
          );
        }
        return {
          name: agg.name,
          timesBought,
          totalSpent: Number(agg.spent.toFixed(2)),
          avgPrice: agg.pricedLines > 0 ? Number((agg.spent / agg.pricedLines).toFixed(2)) : null,
          avgIntervalDays,
          lastBought: uniqueDates[uniqueDates.length - 1],
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 50);

    const totalSpent = (receipts ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
    const totalBonus = (receipts ?? []).reduce((s, r) => s + Number(r.bonus_amount ?? 0), 0);

    return NextResponse.json({
      months,
      year: year ? Number(year) : null,
      availableYears,
      weeklyBudget: await getWeeklyBudget(),
      receiptCount: (receipts ?? []).length,
      totalSpent: Number(totalSpent.toFixed(2)),
      totalBonus: Number(totalBonus.toFixed(2)),
      weeklySpend,
      chainSpend,
      topItems,
    });
  } catch (err) {
    console.error("GET /api/insights:", err);
    return NextResponse.json({ error: "Kunne ikke hente innsikt" }, { status: 500 });
  }
}
