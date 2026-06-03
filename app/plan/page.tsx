"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, CalendarDays, Wand2, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toLocalDateString } from "@/lib/normalize";
import { DAY_LABELS_LONG } from "@/lib/constants";
import { MealCard } from "@/components/MealCard";
import { RecipeModal } from "@/components/RecipeModal";
import { useToast } from "@/components/Toast";
import type { Meal, MealPlan, MealRating } from "@/lib/types";

export default function PlanPage() {
  return (
    <Suspense fallback={<div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl h-24" />)}</div>}>
      <PlanPageInner />
    </Suspense>
  );
}

function PlanPageInner() {
  const searchParams = useSearchParams();

  const today = new Date();
  const defaultFrom = toLocalDateString(today);
  const defaultTo = toLocalDateString(new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000));

  // Plan ID drives data loading: URL ?id → localStorage → null (most recent)
  const [planId, setPlanId] = useState<string | null>(() => {
    const urlId = searchParams.get("id");
    if (urlId) return urlId;
    if (typeof window !== "undefined") return localStorage.getItem("activePlanId");
    return null;
  });

  // Date pickers: local UI state only — populated from the loaded plan
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);

  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [ratings, setRatings] = useState<Record<string, MealRating>>({});
  // Background task tracking: two independent keys so concurrent tasks don't cancel each other
  function anyBgTaskRunning() {
    return !!localStorage.getItem("generatingPlanId") || !!localStorage.getItem("regeneratingPlanId");
  }

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  // Initialize synchronously so the banner appears immediately on mount/navigation
  const [backgroundGenerating, setBackgroundGenerating] = useState(() =>
    typeof window !== "undefined" && anyBgTaskRunning()
  );
  const [allPlans, setAllPlans] = useState<MealPlan[]>([]);
  const [currentPlanIndex, setCurrentPlanIndex] = useState(-1);
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null);
  const [addingMeal, setAddingMeal] = useState<string | null>(null);
  const [recipeMode, setRecipeMode] = useState<"external" | "ai">("external");
  const [recipeModalMeal, setRecipeModalMeal] = useState<Meal | null>(null);
  const { showToast, dismissToast, ToastContainer } = useToast();

  // On mount: read localStorage immediately (handles SSR hydration edge cases),
  // then listen for completion events.
  // "generation-complete": same-tab signal; "storage": other-tab localStorage changes.
  useEffect(() => {
    setBackgroundGenerating(anyBgTaskRunning());
    const handler = () => setBackgroundGenerating(anyBgTaskRunning());
    const storageHandler = (e: StorageEvent) => {
      if (e.key === "generatingPlanId" || e.key === "regeneratingPlanId") {
        setBackgroundGenerating(anyBgTaskRunning());
      }
    };
    window.addEventListener("generation-complete", handler);
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener("generation-complete", handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync URL and localStorage after knowing the plan — does NOT trigger a reload
  function syncContext(p: MealPlan, plansList?: MealPlan[]) {
    localStorage.setItem("activePlanId", p.id);
    window.history.replaceState(null, "", `/plan?id=${p.id}`);
    if (plansList) {
      setAllPlans(plansList);
      setCurrentPlanIndex(plansList.findIndex((pl) => pl.id === p.id));
    }
  }

  // Load plan by ID (or most recent when planId is null)
  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, ratingsRes, recipeModeRes, plansListRes] = await Promise.all([
        fetch(planId ? `/api/plans?id=${planId}` : `/api/plans`),
        fetch("/api/ratings"),
        fetch("/api/settings/recipe-mode"),
        fetch("/api/plans?list=true"),
      ]);

      const planData: MealPlan | null = await planRes.json();
      const ratingsData: MealRating[] = await ratingsRes.json();
      const { mode } = await recipeModeRes.json();
      const plansList: MealPlan[] = await plansListRes.json();

      setPlan(planData);
      setRecipeMode(mode ?? "external");
      setAllPlans(plansList);

      if (planData) {
        setDateFrom(planData.date_from);
        setDateTo(planData.date_to);
        setCurrentPlanIndex(plansList.findIndex((p) => p.id === planData.id));
        localStorage.setItem("activePlanId", planData.id);
        window.history.replaceState(null, "", `/plan?id=${planData.id}`);
        setBackgroundGenerating(anyBgTaskRunning());

        const mealsRes = await fetch(`/api/meals?plan_id=${planData.id}`);
        const mealsData: Meal[] = await mealsRes.json();
        setMeals(mealsData);
      } else {
        setCurrentPlanIndex(-1);
        setMeals([]);
        localStorage.removeItem("activePlanId");
        window.history.replaceState(null, "", `/plan`);
      }

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
  }, [planId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  // Real-time meals sync — granular updates to avoid loading spinner on background writes
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

  // Commit date inputs: look up existing plan for the selected range
  async function commitDates() {
    if (dateFrom.length !== 10 || dateTo.length !== 10) return;
    const res = await fetch(`/api/plans?date_from=${dateFrom}&date_to=${dateTo}`);
    const found: MealPlan | null = await res.json();
    if (found) {
      // Navigate to this plan — triggers full reload via planId change
      setPlanId(found.id);
    } else {
      // No plan yet for these dates — clear view, keep dates for generate
      setPlan(null);
      setMeals([]);
      setCurrentPlanIndex(-1);
      localStorage.removeItem("activePlanId");
      window.history.replaceState(null, "", `/plan`);
    }
  }

  // Navigate to adjacent plan
  function navigatePlan(direction: "prev" | "next") {
    const target = direction === "prev" ? allPlans[currentPlanIndex - 1] : allPlans[currentPlanIndex + 1];
    if (!target) return;
    setPlanId(target.id);
  }

  async function handleGenerate() {
    setGenerating(true);
    const toastId = showToast("Genererer middagsplan…", "loading");
    // Track whether we own the generatingPlanId key so we can clean up on error
    let bgStarted = false;

    try {
      // Create plan if it doesn't exist yet for these dates
      let activePlan = plan;
      if (!activePlan) {
        const planRes = await fetch("/api/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date_from: dateFrom, date_to: dateTo }),
        });
        activePlan = await planRes.json();
        setPlan(activePlan);
        // Sync URL/localStorage and refresh plan list without triggering a full reload
        if (activePlan) {
          const plansListRes = await fetch("/api/plans?list=true");
          const updatedList: MealPlan[] = await plansListRes.json();
          syncContext(activePlan, updatedList);
        }
      }

      // Set the background flag BEFORE the AI call — banner shows immediately
      // on this tab and on any other tab the user navigates to while generation runs.
      localStorage.setItem("generatingPlanId", activePlan!.id);
      setBackgroundGenerating(true);
      bgStarted = true;

      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: activePlan!.id,
          dateFrom,
          dateTo,
          existingMeals: meals,
          generate: true,
          recipeMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "billing" && data.billingUrl) {
          showToast(data.error, "error", { label: "Fyll på kreditter →", href: data.billingUrl });
          return; // finally block will clean up bgStarted
        }
        throw new Error(data.error);
      }

      if (Array.isArray(data.meals) && data.meals.length === 0) {
        throw new Error("Middager ble ikke lagret. Sjekk server-logger for detaljer.");
      }

      if (Array.isArray(data.meals) && data.meals.length > 0) {
        setMeals((prev) => {
          const newIds = new Set((data.meals as Meal[]).map((m) => m.id));
          return [
            ...prev.filter((m) => !newIds.has(m.id)),
            ...(data.meals as Meal[]),
          ].sort((a, b) => a.meal_date.localeCompare(b.meal_date));
        });

        // localStorage key already set above — hand off ownership to the fire-and-forget task
        bgStarted = false;

        const finishGeneration = () => {
          localStorage.removeItem("generatingPlanId");
          window.dispatchEvent(new Event("generation-complete"));
        };

        if (recipeMode === "external") {
          fetch("/api/meals/fetch-links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              meals: (data.meals as Meal[]).map((m) => ({
                id: m.id,
                meal_name: m.meal_name,
                meal_date: m.meal_date.substring(0, 10),
              })),
              planId: activePlan!.id,
              extractIngredients: true,
            }),
          }).finally(finishGeneration);
        } else {
          fetch("/api/meals/generate-all-recipes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ planId: activePlan!.id }),
          }).then(async (r) => {
            finishGeneration();
            const d = await r.json().catch(() => ({}));
            if (!r.ok && d.code === "billing" && d.billingUrl) {
              showToast(d.error, "error", { label: "Fyll på kreditter →", href: d.billingUrl });
            }
          }).catch(finishGeneration);
        }
      }

      if (data.items && data.items.length > 0) {
        await fetch("/api/shopping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            data.items.map((item: { name: string; quantity?: string; category?: string; forDay?: string }) => ({
              plan_id: activePlan!.id,
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
      // If we claimed the localStorage key but never handed off to a fire-and-forget, clean up now
      if (bgStarted) {
        localStorage.removeItem("generatingPlanId");
        window.dispatchEvent(new Event("generation-complete"));
      }
      setGenerating(false);
      dismissToast(toastId);
    }
  }

  function regenerateShopping(updatedMeals: Meal[]) {
    if (!plan) return;
    localStorage.setItem("regeneratingPlanId", plan.id);
    setBackgroundGenerating(true);
    fetch("/api/shopping/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, meals: updatedMeals }),
    }).finally(() => {
      localStorage.removeItem("regeneratingPlanId");
      window.dispatchEvent(new Event("generation-complete"));
    });
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
      // Only regenerate shopping if meal content changed — not for date-only edits
      const contentChanged = "meal_name" in fields || "description" in fields;
      if (contentChanged) regenerateShopping(updatedMeals);
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
          disabled={generating || backgroundGenerating}
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

      {/* Date range picker + prev/next navigation */}
      <div className="flex gap-2 items-center">
        <button
          onClick={() => navigatePlan("prev")}
          disabled={currentPlanIndex <= 0}
          className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Forrige plan"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex gap-2 items-center flex-1">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            onBlur={commitDates}
            onKeyDown={(e) => { if (e.key === "Enter") commitDates(); }}
            className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <span className="text-gray-400 shrink-0">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            onBlur={commitDates}
            onKeyDown={(e) => { if (e.key === "Enter") commitDates(); }}
            className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <button
          onClick={() => navigatePlan("next")}
          disabled={currentPlanIndex < 0 || currentPlanIndex >= allPlans.length - 1}
          className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Neste plan"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Background generation banner */}
      {backgroundGenerating && (
        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 px-4 py-2.5 text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>Henter oppskrifter og oppdaterer handlelisten…</span>
        </div>
      )}

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

      {/* Add manual meal */}
      {plan && (
        <>
          <button
            onClick={() => {
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
                let activePlan = plan;
                if (!activePlan) {
                  const planRes = await fetch("/api/plans", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ date_from: dateFrom, date_to: dateTo }),
                  });
                  activePlan = await planRes.json();
                  setPlan(activePlan);
                  if (activePlan) syncContext(activePlan);
                }
                const res = await fetch("/api/meals", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    planId: activePlan!.id,
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
