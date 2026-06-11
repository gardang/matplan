"use client";

// Innsikt — shopping insights from synced receipts.
// Weekly spend vs budget, store breakdown, top items with buy intervals.

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, TrendingUp, Receipt, Coins, Store } from "lucide-react";

const WEEKLY_BUDGET = 4000;

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

interface Insights {
  months: number;
  receiptCount: number;
  totalSpent: number;
  totalBonus: number;
  weeklySpend: WeekSpend[];
  chainSpend: ChainSpend[];
  topItems: TopItem[];
  year: number | null;
  availableYears: number[];
}

const PERIODS = [
  { months: 1, label: "1 mnd" },
  { months: 3, label: "3 mnd" },
  { months: 6, label: "6 mnd" },
  { months: 12, label: "12 mnd" },
];

function nok(n: number): string {
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 0 }) + " kr";
}

function intervalLabel(days: number | null): string {
  if (days === null) return "–";
  if (days <= 9) return `~hver ${days}. dag`;
  if (days <= 18) return "~annenhver uke";
  if (days <= 40) return "~månedlig";
  return "sjelden";
}

export default function InsightsPage() {
  const [months, setMonths] = useState(3);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Intentional: reset load/error state when the selected window changes.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    const query = selectedYear ? `year=${selectedYear}` : `months=${months}`;
    fetch(`/api/insights?${query}`)
      .then((r) => r.json())
      .then((d: Insights & { error?: string }) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(() => setError("Kunne ikke laste innsikt"))
      .finally(() => setLoading(false));
  }, [months, selectedYear]);

  const weeks = data?.weeklySpend ?? [];
  const maxWeek = Math.max(WEEKLY_BUDGET, ...weeks.map((w) => w.total));
  // Average over completed weeks (exclude current, possibly partial, week)
  const completedWeeks = weeks.length > 1 ? weeks.slice(0, -1) : weeks;
  const avgPerWeek =
    completedWeeks.length > 0
      ? completedWeeks.reduce((s, w) => s + w.total, 0) / completedWeeks.length
      : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 lg:pt-20 pb-24 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-600" /> Innsikt
        </h1>
        <div className="flex flex-wrap gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {PERIODS.map((p) => {
            const active = selectedYear === null && months === p.months;
            return (
              <button
                key={p.months}
                onClick={() => {
                  setSelectedYear(null);
                  setMonths(p.months);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  active
                    ? "bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-300 shadow-sm"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {p.label}
              </button>
            );
          })}
          {(data?.availableYears ?? []).map((y) => {
            const active = selectedYear === y;
            return (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  active
                    ? "bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-300 shadow-sm"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {y}
              </button>
            );
          })}
        </div>
      </div>

      {loading && <p className="text-sm text-gray-400 py-12 text-center">Laster innsikt …</p>}
      {error && <p className="text-sm text-red-500 py-12 text-center">{error}</p>}

      {!loading && !error && data && data.receiptCount === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center space-y-2">
          <Receipt className="w-8 h-8 text-gray-300 mx-auto" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ingen kvitteringer ennå. Koble til en butikk og synkroniser under{" "}
            <Link href="/settings" className="text-emerald-600 underline">
              Innstillinger → Butikker
            </Link>
            .
          </p>
        </div>
      )}

      {!loading && !error && data && data.receiptCount > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard
              icon={<Coins className="w-4 h-4" />}
              label="Totalt brukt"
              value={nok(data.totalSpent)}
            />
            <SummaryCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="Snitt per uke"
              value={nok(avgPerWeek)}
              sub={
                avgPerWeek > WEEKLY_BUDGET
                  ? `${nok(avgPerWeek - WEEKLY_BUDGET)} over budsjett`
                  : `${nok(WEEKLY_BUDGET - avgPerWeek)} under budsjett`
              }
              warn={avgPerWeek > WEEKLY_BUDGET}
            />
            <SummaryCard
              icon={<Receipt className="w-4 h-4" />}
              label="Kvitteringer"
              value={String(data.receiptCount)}
            />
            <SummaryCard
              icon={<Coins className="w-4 h-4" />}
              label="Bonus opptjent"
              value={nok(data.totalBonus)}
            />
          </div>

          {/* Weekly spend bars */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Forbruk per uke <span className="text-xs font-normal text-gray-400">(budsjett {nok(WEEKLY_BUDGET)})</span>
            </h2>
            <div className="space-y-1.5">
              {weeks.map((w) => {
                const over = w.total > WEEKLY_BUDGET;
                const width = Math.max(2, (w.total / maxWeek) * 100);
                const d = new Date(w.weekStart + "T12:00:00");
                const label = `${d.getDate()}.${d.getMonth() + 1}`;
                return (
                  <div key={w.weekStart} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 w-10 shrink-0 text-right">{label}</span>
                    <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded relative overflow-hidden">
                      <div
                        className={`h-full rounded ${over ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${width}%` }}
                      />
                      {/* budget marker */}
                      <div
                        className="absolute top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-500"
                        style={{ left: `${(WEEKLY_BUDGET / maxWeek) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 w-14 shrink-0">{nok(w.total)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per chain */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <Store className="w-4 h-4 text-gray-400" /> Per butikkjede
            </h2>
            <div className="space-y-2">
              {data.chainSpend.map((c) => (
                <div key={c.chain} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-200">{c.chain}</span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {nok(c.total)} <span className="text-xs text-gray-400">({c.receipts} kvitteringer)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top items */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Toppvarer <span className="text-xs font-normal text-gray-400">(etter totalbeløp)</span>
            </h2>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.topItems.slice(0, 25).map((item) => (
                <div key={item.name} className="py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 dark:text-gray-100 truncate">{item.name}</div>
                    <div className="text-xs text-gray-400">
                      {item.timesBought}× · {intervalLabel(item.avgIntervalDays)}
                      {item.avgPrice !== null && ` · ~${nok(item.avgPrice)}/kjøp`}
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200 shrink-0">
                    {nok(item.totalSpent)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}

function SummaryCard({ icon, label, value, sub, warn }: SummaryCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
      <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
        {icon} {label}
      </div>
      <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</div>
      {sub && (
        <div className={`text-xs mt-0.5 ${warn ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}
