"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, CalendarDays, Wand2, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toLocalDateString } from "@/lib/normalize";
import { DAY_LABELS_LONG } from "@/lib/constants";
import { MealCard } from "@/components/MealCard";
import { RecipeModal } from "@/components/RecipeModal";
import { useToast } from "@/components/Toast";
import type { Meal, MealPlan, MealRating } from "@/lib/types";

export default function PlanPage() {
  const today = new Date();
  const defaultFrom = toLocalDateString(today);
  const defaultTo = toLocalDateString(new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000));

  // Input state — updates freely as user types or navigates the calendar
  const [dateFrom, setDateFrom] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("planDateFrom") ?? defaultFrom;
    return defaultFrom;
  });
  const [dateTo, setDateTo] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("planDateTo") ?? defaultTo;
    return defaultTo;
  });
  // Applied state — triggers data load only when user commits (blur / Enter)
  const [appliedFrom, setAppliedFrom] = useState(dateFrom);
  const [appliedTo, setAppliedTo] = useState(dateTo);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [ratings, setRatings] = useState<Record<string, MealRating>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null);
  const [addingMeal, setAddingMeal] = useState<string | null>(null); // null = closed, string = pre-selected date
  const [recipeMode, setRecipeMode] = useState<"external" | "ai">("external");
  const [recipeModalMeal, setRecipeModalMeal] = useState<Meal | null>(null);
  const { showToast, dismissToast, ToastContainer } = useToast();

  // Commit date inputs → save to localStorage + trigger data load
  function commitDates() {
    const from = dateFrom.length === 10 ? dateFrom : appliedFrom;
    const to = dateTo.length === 10 ? dateTo : appliedTo;
    localStorage.setItem("planDateFrom", from);
    localStorage.setItem("planDateTo", to);
    setAppliedFrom(from);
    setAppliedTo(to);
  }

  // Load or create plan + meals
  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const planRes = await fetch(`/api/plans?date_from=${appliedFrom}&date_to=${appliedTo}`);
      const planData: MealPlan = await planRes.json();
      setPlan(planData);

      const [mealsRes, ratingsRes, recipeModeRes] = await Promise.all([
        fetch(`/api/meals?plan_id=${planData.id}`),
        fetch("/api/ratings"),
        fetch("/api/settings/recipe-mode"),
      ]);

      const mealsData: Meal[] = await mealsRes.json();
      const ratingsData: MealRating[] = await ratingsRes.json();
      const { mode } = await recipeModeRes.json();

      setMeals(mealsData);
      setRecipeMode(mode ?? "external");
      const ratingsMap: Record<string, MealRating> = {};
      for (const r of ratingsData) {
        ratingsMap[r.meal_name.toLowerCase()] = r;
      }
      setRatings(ratingsMap);
    } catch {
      showToast("Kunne ikke laste plan", "error");
    } finally {
      setLoading(false);
    }
  }, [appliedFrom, appliedTo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  // Real-time meals sync — update individual records instead of full reload
  // to avoid loading spinner on background updates (Phase 2 URLs, AI recipe writes)
  useEffect(() => {
    if (!plan) return;
    const channel = supabase
      .channel("meals-" + plan.id)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "meals", filter: `plan_id=eq.${plan.id}` },
        (payload) => {
          const updated = payload.new as Meal;
          setMeals((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "meals", filter: `plan_id=eq.${plan.id}` },
        (payload) => {
          const inserted = payload.new as Meal;
          setMeals((prev) => {
            if (prev.some((m) => m.id === inserted.id)) return prev;
            return [...prev, inserted].sort((a, b) => a.meal_date.localeCompare(b.meal_date));
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "meals", filter: `plan_id=eq.${plan.id}` },
        (payload) => {
          const deleted = payload.old as { id: string };
          setMeals((prev) => prev.filter((m) => m.id !== deleted.id));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [plan]);

  async function handleGenerate() {
    if (!plan) return;
    setGenerating(true);
    const toastId = showToast("Genererer middagsplan…", "loading");
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          dateFrom: appliedFrom,
          dateTo: appliedTo,
          existingMeals: meals,
          generate: true,
          recipeMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Meals returned empty even though AI generated them — DB insertion failed
      if (Array.isArray(data.meals) && data.meals.length === 0) {
        throw new Error("Middager ble ikke lagret. Sjekk server-logger for detaljer.");
      }

      // Phase 1 done — show meals immediately
      if (Array.isArray(data.meals) && data.meals.length > 0) {
        setMeals((prev) => {
          const newIds = new Set((data.meals as Meal[]).map((m) => m.id));
          return [
            ...prev.filter((m) => !newIds.has(m.id)),
            ...(data.meals as Meal[]),
          ].sort((a, b) => a.meal_date.localeCompare(b.meal_date));
        });

        if (recipeMode === "external") {
          // Phase 2: fetch verified recipe links + scrape ingredients
          fetch("/api/meals/fetch-links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              meals: (data.meals as Meal[]).map((m) => ({
                id: m.id,
                meal_name: m.meal_name,
                meal_date: m.meal_date.substring(0, 10),
              })),
              planId: plan.id,
              extractIngredients: true,
            }),
          }).catch(() => {});
        } else {
          // AI mode: generate all recipes in background — updates cards one by one via real-time
          fetch("/api/meals/generate-all-recipes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ planId: plan.id }),
          }).catch(() => {});
        }
      }

      // Insert shopping items from generation
      if (data.items && data.items.length > 0 && plan) {
        await fetch("/api/shopping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            data.items.map((item: { name: string; quantity?: string; category?: string; forDay?: string }) => ({
              plan_id: plan.id,
              item_name: item.name,
              quantity: item.quantity ?? null,
              category: item.category ?? "Annet",
              for_day: item.forDay ?? null,
              is_auto: true,
              is_edited: false,
              is_staple: false,
              checked: false,
            }))
          ),
        });
      }

      showToast("Middagsplan generert! Henter oppskriftslenker…", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Noe gikk galt", "error");
    } finally {
      setGenerating(false);
      dismissToast(toastId);
    }
  }

  // Fire-and-forget: update shopping list in background after any meal change
  function regenerateShopping(updatedMeals: Meal[]) {
    if (!plan) return;
    fetch("/api/shopping/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, meals: updatedMeals }),
    }).catch(() => {});
  }

  async function handleEditMeal(mealId: string, fields: Partial<Meal>) {
    const res = await fetch("/api/meals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: mealId, ...fields }),
    });
    if (res.ok) {
      const updated: Meal = await res.json();
      const updatedMeals = meals.map((m) => (m.id === updated.id ? updated : m));
      setMeals(updatedMeals);
      regenerateShopping(updatedMeals);
    }
  }

  async function handleDeleteMeal(mealId: string) {
    const res = await fetch(`/api/meals?id=${mealId}`, { method: "DELETE" });
    if (res.ok) setMeals((prev) => prev.filter((m) => m.id !== mealId));
  }

  async function handleSwap(targetId: string) {
    if (!swapSourceId || swapSourceId === targetId) { setSwapSourceId(null); return; }
    const source = meals.find((m) => m.id === swapSourceId);
    const target = meals.find((m) => m.id === targetId);
    if (!source || !target) return;

    await fetch("/api/meals/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mealAId: source.id,
        mealBId: target.id,
        dateA: source.meal_date,
        dateB: target.meal_date,
      }),
    });
    setSwapSourceId(null);
    await loadPlan();
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl h-24" />
        ))}
      </div>
    );
  }

  const todayStr = toLocalDateString(today);

  return (
    <div className="space-y-4">
      <ToastContainer />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-emerald-600" />
          <h1 className="text-lg font-semibold">Middagsplan</h1>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-wait transition-colors"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Wand2 className="w-4 h-4" />
          )}
          Generer
        </button>
      </div>

      {/* Date range picker */}
      <div className="flex gap-2 items-center text-sm">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          onBlur={commitDates}
          onKeyDown={(e) => { if (e.key === "Enter") commitDates(); }}
          className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <span className="text-gray-400">→</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          onBlur={commitDates}
          onKeyDown={(e) => { if (e.key === "Enter") commitDates(); }}
          className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Swap mode banner */}
      {swapSourceId && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <span>Velg dagen du vil bytte med</span>
          <button onClick={() => setSwapSourceId(null)} className="text-xs underline">Avbryt</button>
        </div>
      )}

      {/* Meal cards + placeholder slots */}
      {meals.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Ingen middager planlagt ennå</p>
          <p className="text-xs mt-1">Trykk «Generer» for å lage en plan</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(() => {
            // Build slots from dateFrom up to the last meal's date — show placeholders for missing days
            // Normalize to YYYY-MM-DD in case Supabase returns timestamps with time component
            const mealsByDate: Record<string, Meal> = {};
            for (const m of meals) mealsByDate[m.meal_date.substring(0, 10)] = m;
            const lastDate = meals[meals.length - 1].meal_date.substring(0, 10);

            const slots: string[] = [];
            const cursor = new Date(dateFrom + "T12:00:00");
            const end = new Date(lastDate + "T12:00:00");
            while (cursor <= end) {
              slots.push(toLocalDateString(cursor));
              cursor.setDate(cursor.getDate() + 1);
            }

            return slots.map((ds) => {
              const meal = mealsByDate[ds];
              if (meal) {
                return (
                  <MealCard
                    key={meal.id}
                    meal={meal}
                    ratings={ratings}
                    isSwapSource={meal.id === swapSourceId}
                    isSwapTarget={!!swapSourceId && meal.id !== swapSourceId}
                    swapMode={!!swapSourceId}
                    showRating={true}
                    onEdit={(fields) => handleEditMeal(meal.id, fields)}
                    onDelete={() => handleDeleteMeal(meal.id)}
                    onStartSwap={() =>
                      setSwapSourceId((prev) => (prev === meal.id ? null : meal.id))
                    }
                    onConfirmSwap={() => handleSwap(meal.id)}
                    onOpenRecipe={() => setRecipeModalMeal(meal)}
                  />
                );
              }
              // Empty slot — show placeholder
              const d = new Date(ds + "T12:00:00");
              const dow = d.getDay();
              const dayLabel = DAY_LABELS_LONG[dow];
              const dateLabel = `${d.getDate()}.${d.getMonth() + 1}`;
              return (
                <button
                  key={ds}
                  onClick={() => setAddingMeal(ds)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-left hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors group"
                >
                  <Plus className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-emerald-500 shrink-0" />
                  <span className="text-sm text-gray-400 dark:text-gray-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                    {dayLabel} {dateLabel} — ingen middag
                  </span>
                </button>
              );
            });
          })()}
        </div>
      )}

      {/* Add manual */}
      {plan && (
        <>
          <button
            onClick={() => {
              // Default: day after last meal
              if (meals.length === 0) { setAddingMeal(dateTo); return; }
              const last = meals[meals.length - 1].meal_date;
              const d = new Date(last + "T12:00:00");
              d.setDate(d.getDate() + 1);
              setAddingMeal(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
            }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-600 dark:hover:text-emerald-400 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Legg til middag
          </button>

          {addingMeal !== null && (
            <AddMealModal
              defaultDate={addingMeal}
              onSave={async (mealDate, mealName, recipeUrl) => {
                const res = await fetch("/api/meals", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    planId: plan.id,
                    meal_date: mealDate,
                    meal_name: mealName,
                    recipe_url: recipeUrl || null,
                  }),
                });
                if (res.ok) {
                  const newMeal: Meal = await res.json();
                  const updatedMeals = [...meals, newMeal].sort((a, b) =>
                    a.meal_date.localeCompare(b.meal_date)
                  );
                  setMeals(updatedMeals);
                  setAddingMeal(null);
                  regenerateShopping(updatedMeals);
                }
              }}
              onClose={() => setAddingMeal(null)}
            />
          )}
        </>
      )}

      {recipeModalMeal && (
        <RecipeModal
          meal={recipeModalMeal}
          recipeMode={recipeMode}
          onClose={() => setRecipeModalMeal(null)}
        />
      )}
    </div>
  );
}

// ── Add meal modal ────────────────────────────────────────────────────────────

interface AddMealModalProps {
  defaultDate: string;
  onSave: (date: string, name: string, recipeUrl: string) => Promise<void>;
  onClose: () => void;
}

function AddMealModal({ defaultDate, onSave, onClose }: AddMealModalProps) {
  const [date, setDate] = useState(defaultDate);
  const [name, setName] = useState("");
  const [recipeUrl, setRecipeUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave(date, name.trim(), recipeUrl.trim());
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4"
      >
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Legg til middag</h3>

        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Dato</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Middagnavn</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="f.eks. Pasta Bolognese"
            required
            autoFocus
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            Oppskriftslenke <span className="text-gray-400">(valgfritt)</span>
          </label>
          <input
            value={recipeUrl}
            onChange={(e) => setRecipeUrl(e.target.value)}
            placeholder="https://www.matprat.no/..."
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? "Legger til…" : "Legg til"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Avbryt
          </button>
        </div>
      </form>
    </div>
  );
}
