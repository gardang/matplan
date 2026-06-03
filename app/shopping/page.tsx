"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ShoppingCart, Plus, RefreshCw, CheckCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { normalizeItemName, normalizeQuantity, mergeQuantities, sortKey } from "@/lib/normalize";
import { CATEGORIES } from "@/lib/constants";
import { ShopItem } from "@/components/ShopItem";
import { useToast } from "@/components/Toast";
import type { ShoppingItem, MergedItem, Meal } from "@/lib/types";

export default function ShoppingPage() {
  return (
    <Suspense fallback={<div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg h-12" />)}</div>}>
      <ShoppingPageInner />
    </Suspense>
  );
}

function ShoppingPageInner() {
  const searchParams = useSearchParams();

  const [planId, setPlanId] = useState<string | null>(null);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  // Initialize synchronously so the banner appears immediately on mount/navigation
  const [backgroundGenerating, setBackgroundGenerating] = useState(() =>
    typeof window !== "undefined" &&
    (!!localStorage.getItem("generatingPlanId") || !!localStorage.getItem("regeneratingPlanId"))
  );
  const [addModalOpen, setAddModalOpen] = useState(false);
  const { showToast, ToastContainer } = useToast();

  // Refs so event handlers can read current values without stale closures
  const bgGeneratingRef = useRef(
    typeof window !== "undefined" &&
      (!!localStorage.getItem("generatingPlanId") || !!localStorage.getItem("regeneratingPlanId"))
  );
  const planIdRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => { bgGeneratingRef.current = backgroundGenerating; }, [backgroundGenerating]);
  useEffect(() => { planIdRef.current = planId; }, [planId]);

  useEffect(() => {
    const check = () => {
      const running =
        !!localStorage.getItem("generatingPlanId") || !!localStorage.getItem("regeneratingPlanId");
      const wasRunning = bgGeneratingRef.current;
      bgGeneratingRef.current = running;
      setBackgroundGenerating(running);
      // Regeneration just finished — do one bulk refresh instead of relying on individual real-time events
      if (wasRunning && !running && planIdRef.current) {
        fetch(`/api/shopping?plan_id=${planIdRef.current}`)
          .then((r) => r.json())
          .then((data: ShoppingItem[]) => setItems(data))
          .catch(() => {});
      }
    };
    // Immediate read on mount — handles SSR hydration where useState ran with window=undefined
    check();
    const storageHandler = (e: StorageEvent) => {
      if (e.key === "generatingPlanId" || e.key === "regeneratingPlanId") check();
    };
    window.addEventListener("generation-complete", check);
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener("generation-complete", check);
      window.removeEventListener("storage", storageHandler);
    };
  }, []);

  // Load plan: URL ?id → localStorage activePlanId → most recent
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const urlId = searchParams.get("id");
      const localId = typeof window !== "undefined" ? localStorage.getItem("activePlanId") : null;
      const id = urlId ?? localId ?? null;

      const planRes = await fetch(id ? `/api/plans?id=${id}` : `/api/plans`);
      const plan = await planRes.json();
      if (!plan?.id) { setLoading(false); return; }

      setPlanId(plan.id);
      localStorage.setItem("activePlanId", plan.id);
      window.history.replaceState(null, "", `/shopping?id=${plan.id}`);
      setBackgroundGenerating(
        !!localStorage.getItem("generatingPlanId") || !!localStorage.getItem("regeneratingPlanId")
      );

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

  // Real-time sync — suppressed during background regeneration to avoid flicker;
  // a bulk refresh happens when generation-complete fires instead.
  useEffect(() => {
    if (!planId) return;
    const channel = supabase
      .channel("shopping-" + planId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_items", filter: `plan_id=eq.${planId}` },
        (payload) => {
          if (bgGeneratingRef.current) return;
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

  async function handleAddItem(name: string, quantity: string, category: string) {
    if (!planId) return;
    const res = await fetch("/api/shopping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: planId,
        item_name: name,
        quantity: quantity || null,
        category,
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

  async function handleRegenerate() {
    if (!planId) return;
    showToast("Regenererer handleliste…", "loading");
    try {
      const res = await fetch("/api/shopping/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, meals }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "billing" && data.billingUrl) {
          showToast(data.error, "error", { label: "Fyll på kreditter →", href: data.billingUrl });
          return;
        }
        throw new Error(data.error ?? "Kunne ikke regenerere listen");
      }
      setItems(data as ShoppingItem[]);
      showToast("Handleliste oppdatert!", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Kunne ikke regenerere listen", "error");
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

  if (loading) return null; // Suspense fallback handles the skeleton

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
        <button
          onClick={handleRegenerate}
          disabled={meals.length === 0}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={meals.length === 0 ? "Ingen middager planlagt" : "Regenerer fra middager"}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Background generation banner */}
      {backgroundGenerating && (
        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 px-4 py-2.5 text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
          <span>Handlelisten oppdateres automatisk mens oppskrifter hentes…</span>
        </div>
      )}

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
          onClick={() => setAddModalOpen(true)}
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

      {addModalOpen && (
        <AddItemModal
          onAdd={async (name, quantity, category) => {
            await handleAddItem(name, quantity, category);
            setAddModalOpen(false);
          }}
          onClose={() => setAddModalOpen(false)}
        />
      )}
    </div>
  );
}

// ── Add item modal ────────────────────────────────────────────────────────────

function AddItemModal({
  onAdd,
  onClose,
}: {
  onAdd: (name: string, quantity: string, category: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState("Annet");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onAdd(name.trim(), quantity.trim(), category);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4"
      >
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Legg til vare</h3>
        <input
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Varenavn"
          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
        />
        <input
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Mengde (valgfritt, f.eks. 2 stk)"
          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
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
