"use client";

import { DAY_LABELS_SHORT, DAY_PILL_CLASSES, DAY_COLORS } from "@/lib/constants";

interface DayPillProps {
  dateStr: string; // YYYY-MM-DD
  recipeUrl?: string | null;
  onClick?: () => void;
}

export function DayPill({ dateStr, recipeUrl, onClick }: DayPillProps) {
  const date = new Date(dateStr + "T12:00:00"); // noon to avoid DST edge
  const dow = date.getDay();
  const colorName = DAY_COLORS[dow] ?? "gray";
  const classes = DAY_PILL_CLASSES[colorName];
  const label = DAY_LABELS_SHORT[dow] ?? "?";
  const day = date.getDate();

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (recipeUrl) window.open(recipeUrl, "_blank", "noopener");
    else if (onClick) onClick();
  }

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${classes}`}
    >
      {label} {day}.
    </button>
  );
}
