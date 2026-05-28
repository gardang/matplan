"use client";

import { useEffect, useState, useCallback } from "react";
import { ShoppingCart, Plus, RefreshCw, CheckCheck, BookmarkPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { normalizeItemName, normalizeQuantity, mergeQuantities, sortKey } from "@/lib/normalize";
import { CATEGORIES, STAPLES } from "@/lib/constants";
import { ShopItem } from "@/components/ShopItem";
import { useToast } from "@/components/Toast";
import type { ShoppingItem, MergedItem, Meal } from "@/lib/types";

export default function ShoppingPage() {
  const [planId, setPlanId] = useState<string | null>(null);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast, ToastContainer } = useToast();

  // Load current plan
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Use the same date range as the plan page (stored in localStorage), or fall back to most recent plan
      const storedFrom = typeof window !== "undefined" ? localStorage.getItem("planDateFrom") : null;
      const storedTo = typeof window !== "undefined" ? localStorage.getItem("planDateTo") : null;
      const planUrl = storedFrom && storedTo
        ? `/api/plans?date_from=${storedFrom}&date_to=${storedTo}`
        : `/api/plans`;
      const planRes = await fetch(planUrl);
      const plan = await planRes.json();
      setPlanId(plan.id);

      const [itemsRes, mealsRes] = await Promise.all([
        fetch(`/api/shopping?plan_id=${plan.id}`),
        fetch(`/api/meals?plan_id=${plan.id}`),
      ]);

      const itemsData: ShoppingItem[] = await itemsRes.json();
      const mealsData: Meal[] = await mealsRes.json();
      setItems(itemsData);
      setMeals(mealsData);
    } catch {
      showToast("Kunne ikke laste handleliste", "error");
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time sync
  useEffect(() => {
    if (!planId) return;
    const channel = supabase
      .channel("shopping-" + planId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_items", filter: `plan_id=eq.${planId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setItems((prev) => [...prev, payload.new as ShoppingItem]);
          } else if (payload.eventType === "UPDATE") {
            setItems((prev) =>
              prev.map((i) => (i.id === (payload.new as ShoppingItem).id ? (payload.new as ShoppingItem) : i))
            );
          } else if (payload.eventType === "DELETE") {
            setItems((prev) => prev.filter((i) => i.id !== payload.old.id));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [planId]);

  // ── Merge items for display ─────────────────────────────────────────────────
  function buildMergedGroups(): Record<string, MergedItem[]> {
    const byCategory: Record<string, MergedItem[]> = {};

    // Group raw items by normalized name
    const byName: Record<string, ShoppingItem[]> = {};
    for (const item of items) {
      const key = normalizeItemName(item.item_name).toLowerCase();
      if (!byName[key]) byName[key] = [];
      byName[key].push(item);
    }

    for (const [normKey, group] of Object.entries(byName)) {
      const category = group[0].category ?? "Annet";
      const merged: MergedItem = {
        name: normalizeItemName(group[0].item_name),
        displayQty: mergeQuantities(
          group.map((i) => normalizeQuantity(i.quantity ?? "")).filter(Boolean)
        ),
        forDays: [...new Set(group.map((i) => i.for_day).filter(Boolean) as string[])].sort(),
        ids: group.map((i) => i.id),
        checkedArr: group.map((i) => i.checked),
        edited: group.some((i) => i.is_edited),
        category,
      };
      void normKey;
      if (!byCategory[category]) byCategory[category] = [];
      byCategory[category].push(merged);
    }

    // Sort within each category by sortKey
    for (const cat of Object.keys(byCategory)) {
      byCategory[cat].sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name), "nb-NO"));
    }

    return byCategory;
  }

  const mealRecipeUrls: Record<string, string | null> = {};
  for (const m of meals) {
    mealRecipeUrls[m.meal_date] = m.recipe_url;
  }

  async function handleToggle(item: MergedItem) {
    const allChecked = item.checkedArr.every(Boolean);
    const newChecked = !allChecked;
    await fetch("/api/shopping", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: item.ids, checked: newChecked }),
    });
    setItems((prev) =>
      prev.map((i) =>
        item.ids.includes(i.id) ? { ...i, checked: newChecked } : i
      )
    );
  }

  async function handleEdit(item: MergedItem, name: string, quantity: string) {
    // Update all underlying items
    await fetch("/api/shopping", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: item.ids, item_name: name, quantity, is_auto: false, is_edited: true }),
    });
    setItems((prev) =>
      prev.map((i) =>
        item.ids.includes(i.id) ? { ...i, item_name: name, quantity, is_edited: true, is_auto: false } : i
      )
    );
  }

  async function handleDelete(item: MergedItem) {
    for (const id of item.ids) {
      await fetch(`/api/shopping?id=${id}`, { method: "DELETE" });
    }
    setItems((prev) => prev.filter((i) => !item.ids.includes(i.id)));
  }

  async function handleAddItem() {
    const name = prompt("Legg til vare:");
    if (!name || !planId) return;
    const res = await fetch("/api/shopping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: planId,
        item_name: name,
        quantity: null,
        category: "Annet",
        is_auto: false,
        is_edited: false,
        is_staple: false,
        checked: false,
      }),
    });
    if (res.ok) {
      const newItem: ShoppingItem = await res.json();
      setItems((prev) => [...prev, newItem]);
    }
  }

  async function handleAddStaples() {
    if (!planId) return;
    const normalizedExisting = new Set(items.map((i) => normalizeItemName(i.item_name).toLowerCase()));
    const toAdd = STAPLES.filter(
      (s) => !normalizedExisting.has(normalizeItemName(s.name).toLowerCase())
    );
    if (toAdd.length === 0) {
      showToast("Alle basisvarer er allerede på listen", "success");
      return;
    }
    const inserts = toAdd.map((s) => ({
      plan_id: planId,
      item_name: s.name,
      quantity: s.quantity,
      category: s.category,
      is_auto: false,
      is_edited: false,
      is_staple: true,
      checked: false,
    }));
    const res = await fetch("/api/shopping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inserts),
    });
    if (res.ok) {
      showToast(`Lagt til ${toAdd.length} basisvarer`, "success");
      await loadData();
    }
  }

  async function handleRegenerate() {
    if (!planId) return;
    showToast("Regenererer handleliste…", "loading");
    try {
      const res = await fetch("/api/shopping/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, meals }),
      });
      const data: ShoppingItem[] = await res.json();
      setItems(data);
      showToast("Handleliste oppdatert!", "success");
    } catch {
      showToast("Kunne ikke regenerere listen", "error");
    }
  }

  async function handleComplete() {
    if (!planId) return;
    const checkedCount = items.filter((i) => i.checked).length;
    if (checkedCount === 0) { showToast("Ingen varer er krysset av", "error"); return; }

    showToast("Lagrer handlemønster…", "loading");
    try {
      await fetch("/api/shopping/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      setItems((prev) => prev.filter((i) => !i.checked));
      showToast("Handlingen fullført! 🛒", "success");
    } catch {
      showToast("Noe gikk galt", "error");
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg h-12" />
        ))}
      </div>
    );
  }

  const groups = buildMergedGroups();
  const totalItems = items.length;
  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <div className="space-y-4">
      <ToastContainer />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-emerald-600" />
          <h1 className="text-lg font-semibold">Handleliste</h1>
          {totalItems > 0 && (
            <span className="text-sm text-gray-400">{checkedCount}/{totalItems}</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRegenerate}
            disabled={meals.length === 0}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={meals.length === 0 ? "Ingen middager planlagt" : "Regenerer fra middager"}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleAddStaples}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Legg til basisvarer"
          >
            <BookmarkPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* No meals warning */}
      {meals.length === 0 && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          Ingen middager er planlagt denne uken. Gå til <strong>Plan</strong>-fanen og trykk «Generer» for å lage en middagsplan – handlelisten fylles ut automatisk.
        </div>
      )}

      {/* List by category */}
      {totalItems === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Handlelisten er tom</p>
          <p className="text-xs mt-1">Generer en middagsplan for å fylle den</p>
        </div>
      ) : (
        <div className="space-y-4">
          {CATEGORIES.map((cat) => {
            const catItems = groups[cat];
            if (!catItems || catItems.length === 0) return null;
            return (
              <div key={cat}>
                <div className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-2">
                  {cat}
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
                  {catItems.map((item) => (
                    <ShopItem
                      key={item.ids.join("-")}
                      item={item}
                      mealRecipeUrls={mealRecipeUrls}
                      onToggle={() => handleToggle(item)}
                      onEdit={(name, qty) => handleEdit(item, name, qty)}
                      onDelete={() => handleDelete(item)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleAddItem}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Legg til vare
        </button>
        {checkedCount > 0 && (
          <button
            onClick={handleComplete}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            Handlingen ferdig ({checkedCount})
          </button>
        )}
      </div>
    </div>
  );
}
