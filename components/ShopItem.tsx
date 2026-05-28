"use client";

import { useState, useRef } from "react";
import { Check, Pencil, X } from "lucide-react";
import { DayPill } from "./DayPill";
import type { MergedItem } from "@/lib/types";

interface ShopItemProps {
  item: MergedItem;
  mealRecipeUrls: Record<string, string | null>; // date → recipe_url
  onToggle: () => void;
  onEdit: (name: string, quantity: string) => void;
  onDelete: () => void;
}

export function ShopItem({ item, mealRecipeUrls, onToggle, onEdit, onDelete }: ShopItemProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editQty, setEditQty] = useState(item.displayQty);
  const containerRef = useRef<HTMLDivElement>(null);
  const allChecked = item.checkedArr.every(Boolean);

  function handleContainerBlur(e: React.FocusEvent<HTMLDivElement>) {
    // Only save if focus left the container entirely
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      if (editing) handleSave();
    }
  }

  function handleSave() {
    onEdit(editName.trim() || item.name, editQty.trim());
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") { setEditing(false); setEditName(item.name); setEditQty(item.displayQty); }
  }

  return (
    <div
      className={`flex items-start gap-3 py-3 px-1 transition-opacity ${allChecked ? "opacity-50" : ""}`}
    >
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className="shrink-0 mt-0.5 min-h-[44px] min-w-[44px] flex items-center justify-center -ml-1"
        aria-label={allChecked ? "Fjern hake" : "Kryss av"}
      >
        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            allChecked
              ? "bg-emerald-600 border-emerald-600"
              : "border-gray-300 dark:border-gray-600"
          }`}
        >
          {allChecked && <Check className="w-3 h-3 text-white" />}
        </div>
      </button>

      {/* Content */}
      <div
        ref={containerRef}
        className="flex-1 min-w-0"
        onBlur={handleContainerBlur}
      >
        {editing ? (
          <div className="flex gap-2 items-start flex-wrap" onKeyDown={handleKeyDown}>
            <input
              autoFocus
              value={editQty}
              onChange={(e) => setEditQty(e.target.value)}
              className="w-20 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
              placeholder="Mengde"
            />
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
              placeholder="Navn"
            />
            <button
              onMouseDown={(e) => { e.preventDefault(); handleSave(); }}
              className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 min-h-[32px]"
            >
              OK
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); setEditing(false); setEditName(item.name); setEditQty(item.displayQty); }}
              className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 min-h-[32px]"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-left w-full"
          >
            <span className="text-sm text-gray-900 dark:text-gray-100">
              {item.displayQty && (
                <span className="font-medium">{item.displayQty} </span>
              )}
              <span className={allChecked ? "line-through" : ""}>{item.name}</span>
              {item.edited && (
                <span className="ml-1">
                  <Pencil className="inline w-2.5 h-2.5 text-gray-400" />
                </span>
              )}
            </span>
          </button>
        )}

        {/* Day pills */}
        {item.forDays.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-1">
            {item.forDays.map((d) => (
              <DayPill
                key={d}
                dateStr={d}
                recipeUrl={mealRecipeUrls[d]}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="shrink-0 p-2 text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Slett"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
