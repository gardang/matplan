"use client";

import { useState } from "react";
import type { MealRating } from "@/lib/types";

interface MealRatingProps {
  mealName: string;
  recipeUrl?: string | null;
  currentRating?: MealRating | null;
  onRated?: (rating: MealRating) => void;
}

const RATINGS = [
  { value: "loved", emoji: "👍", label: "Elsket" },
  { value: "ok", emoji: "👌", label: "OK" },
  { value: "disliked", emoji: "👎", label: "Likte ikke" },
  { value: "never_again", emoji: "🚫", label: "Aldri igjen" },
] as const;

export function MealRatingButtons({ mealName, recipeUrl, currentRating, onRated }: MealRatingProps) {
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState<string | null>(currentRating?.rating ?? null);

  async function handleRate(rating: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meal_name: mealName, rating, recipe_url: recipeUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        setActive(rating);
        onRated?.(data);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {RATINGS.map(({ value, emoji, label }) => (
        <button
          key={value}
          onClick={() => handleRate(value)}
          disabled={saving}
          title={label}
          className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-all min-h-[32px] ${
            active === value
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-medium"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
          } disabled:opacity-50`}
        >
          {emoji} <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
