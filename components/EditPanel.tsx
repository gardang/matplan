"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { RecipeLink } from "./RecipeLink";
import type { Meal, AiMealSuggestion } from "@/lib/types";

interface EditPanelProps {
  meal: Meal;
  onSave: (fields: Partial<Meal>) => Promise<void>;
  onClose: () => void;
}

export function EditPanel({ meal, onSave, onClose }: EditPanelProps) {
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [date, setDate] = useState(meal.meal_date);
  const [name, setName] = useState(meal.meal_name);
  const [description, setDescription] = useState(meal.description ?? "");
  const [source, setSource] = useState(meal.recipe_source ?? "");
  const [recipeUrl, setRecipeUrl] = useState(meal.recipe_url ?? "");
  const [ingredientHint, setIngredientHint] = useState("");
  const [suggestions, setSuggestions] = useState<AiMealSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ meal_date: date, meal_name: name, description, recipe_source: source, recipe_url: recipeUrl });
    setSaving(false);
    onClose();
  }

  async function fetchSuggestions() {
    setLoadingSuggestions(true);
    setSuggestions([]);
    try {
      const res = await fetch("/api/meals/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: meal.meal_date, hint: ingredientHint || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      }
    } catch {}
    setLoadingSuggestions(false);
  }

  function selectSuggestion(s: AiMealSuggestion) {
    setName(s.name);
    setDescription(s.description);
    setSource(s.source ?? "");
    setRecipeUrl(s.recipeUrl ?? "");
    setMode("manual");
  }

  return (
    <div className="mt-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4 space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("manual")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            mode === "manual"
              ? "bg-emerald-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
          }`}
        >
          Skriv selv
        </button>
        <button
          onClick={() => setMode("ai")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            mode === "ai"
              ? "bg-emerald-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
          }`}
        >
          Forslag fra AI
        </button>
      </div>

      {mode === "manual" && (
        <div className="space-y-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Middagnavn"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Beskrivelse (valgfritt)"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
          />
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Kilde (matprat.no, godt.no, ...)"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
          />
          <input
            value={recipeUrl}
            onChange={(e) => setRecipeUrl(e.target.value)}
            placeholder="Oppskriftslenke (valgfritt)"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
          />
          {(name || recipeUrl) && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              Forhåndsvisning:{" "}
              <RecipeLink url={recipeUrl || null} mealName={name} />
            </div>
          )}
        </div>
      )}

      {mode === "ai" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={ingredientHint}
              onChange={(e) => setIngredientHint(e.target.value)}
              placeholder="Ingredienser du har (valgfritt)"
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
            />
            <button
              onClick={fetchSuggestions}
              disabled={loadingSuggestions}
              className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-wait flex items-center gap-2"
            >
              {loadingSuggestions ? <Loader2 className="w-4 h-4 animate-spin" /> : "Foreslå"}
            </button>
          </div>

          {loadingSuggestions && (
            <div className="flex gap-1 py-2">
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </div>
          )}

          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => selectSuggestion(s)}
              className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-600 p-3 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors space-y-1"
            >
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{s.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{s.description}</div>
              {s.extraIngredients && (
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  Trenger: {s.extraIngredients}
                </div>
              )}
              <RecipeLink url={s.recipeUrl ?? null} mealName={s.name} />
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          Lagre
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Avbryt
        </button>
      </div>
    </div>
  );
}
