"use client";

import { useState } from "react";
import { Pencil, Trash2, ArrowLeftRight, MoveRight } from "lucide-react";
import { RecipeLink } from "./RecipeLink";
import { EditPanel } from "./EditPanel";
import { MealRatingButtons } from "./MealRating";
import type { Meal, MealRating } from "@/lib/types";
import { DAY_COLORS, DAY_BORDER_CLASSES, DAY_LABELS_LONG } from "@/lib/constants";

interface MealCardProps {
  meal: Meal;
  ratings: Record<string, MealRating>;
  isSwapSource: boolean;
  isSwapTarget: boolean;
  swapMode: boolean;
  showRating: boolean;
  onEdit: (fields: Partial<Meal>) => Promise<void>;
  onDelete: () => void;
  onStartSwap: () => void;
  onConfirmSwap: () => void;
}

export function MealCard({
  meal,
  ratings,
  isSwapSource,
  isSwapTarget,
  swapMode,
  showRating,
  onEdit,
  onDelete,
  onStartSwap,
  onConfirmSwap,
}: MealCardProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const date = new Date(meal.meal_date + "T12:00:00");
  const dow = date.getDay();
  const colorName = DAY_COLORS[dow] ?? "gray";
  const borderClass = DAY_BORDER_CLASSES[colorName];
  const dayLabel = DAY_LABELS_LONG[dow];
  const dateLabel = `${date.getDate()}.${date.getMonth() + 1}`;
  const currentRating = ratings[meal.meal_name.toLowerCase()] ?? null;

  async function handleEditSave(fields: Partial<Meal>) {
    await onEdit(fields);
    setEditing(false);
  }

  // Swap target mode
  if (swapMode && isSwapTarget) {
    return (
      <button
        onClick={onConfirmSwap}
        className={`w-full text-left rounded-xl border-l-4 ${borderClass} bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 p-4 flex items-center gap-3 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors`}
      >
        <MoveRight className="w-5 h-5 text-emerald-600 shrink-0" />
        <div>
          <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {dayLabel} {dateLabel}
          </div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Flytt hit
          </div>
        </div>
      </button>
    );
  }

  return (
    <div
      className={`rounded-xl bg-white dark:bg-gray-800 shadow-sm border-l-4 ${borderClass} transition-all ${
        isSwapSource ? "ring-2 ring-emerald-500" : ""
      }`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-0.5">
              {dayLabel} {dateLabel}
            </div>
            <div className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
              {meal.meal_name}
            </div>
            {meal.description && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {meal.description}
              </div>
            )}
            <RecipeLink url={meal.recipe_url} mealName={meal.meal_name} className="mt-1" />
          </div>

          {/* Actions */}
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => setEditing(!editing)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Rediger"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={onStartSwap}
              className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                isSwapSource
                  ? "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
              title="Flytt"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
            {confirmDelete ? (
              <div className="flex gap-1">
                <button
                  onClick={onDelete}
                  className="px-2 py-1 rounded-lg text-xs bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 min-h-[44px]"
                >
                  Slett
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 rounded-lg text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 min-h-[44px]"
                >
                  Avbryt
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Slett"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Rating buttons (shown after the meal date) */}
        {showRating && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="text-xs text-gray-400 mb-2">Hvordan smakte det?</div>
            <MealRatingButtons
              mealName={meal.meal_name}
              recipeUrl={meal.recipe_url}
              currentRating={currentRating}
            />
          </div>
        )}
      </div>

      {/* Inline edit panel */}
      {editing && (
        <div className="px-4 pb-4">
          <EditPanel meal={meal} onSave={handleEditSave} onClose={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}
