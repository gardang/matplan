"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink, Loader2, Clock, Users, ChefHat } from "lucide-react";
import type { Meal, AiRecipe } from "@/lib/types";
import { DAY_LABELS_LONG } from "@/lib/constants";

interface RecipeModalProps {
  meal: Meal;
  recipeMode: "external" | "ai";
  onClose: () => void;
}

export function RecipeModal({ meal, recipeMode, onClose }: RecipeModalProps) {
  const [recipe, setRecipe] = useState<AiRecipe | null>(meal.ai_recipe ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const date = new Date(meal.meal_date.substring(0, 10) + "T12:00:00");
  const dayLabel = DAY_LABELS_LONG[date.getDay()];
  const dateLabel = `${date.getDate()}.${date.getMonth() + 1}`;

  useEffect(() => {
    if (recipeMode !== "ai" || recipe) return;

    setLoading(true);
    fetch("/api/meals/generate-recipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mealId: meal.id,
        meal_name: meal.meal_name,
        description: meal.description ?? undefined,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setRecipe(data);
      })
      .catch(() => setError("Kunne ikke generere oppskrift"))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 rounded-t-2xl px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                {dayLabel} {dateLabel}
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                {meal.meal_name}
              </h2>
              {meal.recipe_source && (
                <div className="text-sm text-gray-400 mt-0.5">{meal.recipe_source}</div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Description */}
          {meal.description && (
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {meal.description}
            </p>
          )}

          {/* ── EXTERNAL MODE ────────────────────────────────────────────── */}
          {recipeMode === "external" && (
            <>
              {meal.recipe_url ? (
                <a
                  href={meal.recipe_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Åpne oppskrift
                </a>
              ) : (
                <div className="text-sm text-gray-400 text-center py-4">
                  Laster oppskriftslenke…
                </div>
              )}
              <p className="text-xs text-gray-400 text-center">
                Ingredienser fra oppskriften er lagt til i handlelisten automatisk.
              </p>
            </>
          )}

          {/* ── AI MODE ──────────────────────────────────────────────────── */}
          {recipeMode === "ai" && (
            <>
              {loading && (
                <div className="flex flex-col items-center py-8 gap-3 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                  <span className="text-sm">Genererer oppskrift…</span>
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              {recipe && !loading && (
                <>
                  {/* Meta pills */}
                  <div className="flex gap-3 flex-wrap">
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-sm text-gray-600 dark:text-gray-300">
                      <Clock className="w-3.5 h-3.5" />
                      {recipe.time_minutes} min
                    </span>
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-sm text-gray-600 dark:text-gray-300">
                      <Users className="w-3.5 h-3.5" />
                      {recipe.portions} porsjoner
                    </span>
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-sm text-gray-600 dark:text-gray-300">
                      <ChefHat className="w-3.5 h-3.5" />
                      {recipe.difficulty}
                    </span>
                  </div>

                  {/* Ingredients */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                      Ingredienser
                    </h3>
                    <ul className="space-y-2">
                      {recipe.ingredients.map((ing, i) => (
                        <li key={i} className="flex justify-between items-baseline text-sm">
                          <span className="text-gray-800 dark:text-gray-200">{ing.name}</span>
                          <span className="text-gray-400 dark:text-gray-500 ml-4 shrink-0">
                            {ing.quantity}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Steps */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                      Fremgangsmåte
                    </h3>
                    <ol className="space-y-4">
                      {recipe.steps.map((step, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                            {i + 1}
                          </span>
                          <span className="text-gray-700 dark:text-gray-300 leading-relaxed">
                            {step}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
