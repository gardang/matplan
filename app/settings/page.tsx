"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings, Plus, Trash2, Check, Bot, Pencil, BookOpen, CalendarDays, ChevronDown, Star, Tag, ChevronUp, PackageSearch, X, Store, Wallet } from "lucide-react";
import { useToast } from "@/components/Toast";
import { StoreConnections } from "@/components/StoreConnections";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "@/lib/constants";
import type { FamilyMember, FamilyPreference, MealPlan, MealRating, ShoppingCategory, ShoppingPattern } from "@/lib/types";

export default function SettingsPage() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [prefs, setPrefs] = useState<FamilyPreference[]>([]);
  const [activeModel, setActiveModel] = useState(DEFAULT_MODEL);
  const [savingModel, setSavingModel] = useState(false);
  const [recipeMode, setRecipeMode] = useState<"external" | "ai">("external");
  const [savingRecipeMode, setSavingRecipeMode] = useState(false);
  const [weeklyBudget, setWeeklyBudget] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [editingPref, setEditingPref] = useState<FamilyPreference | null>(null);
  const [editingRating, setEditingRating] = useState<MealRating | null>(null);
  const [editingCategory, setEditingCategory] = useState<ShoppingCategory | null>(null);
  const [ratings, setRatings] = useState<MealRating[]>([]);
  const [plans, setPlans] = useState<(MealPlan & { meal_count: number })[]>([]);
  const [categories, setCategories] = useState<ShoppingCategory[]>([]);
  const [patterns, setPatterns] = useState<ShoppingPattern[]>([]);
  const { showToast, ToastContainer } = useToast();

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/members").then((r) => r.json()),
      fetch("/api/settings/preferences").then((r) => r.json()),
      fetch("/api/settings/model").then((r) => r.json()),
      fetch("/api/settings/recipe-mode").then((r) => r.json()),
      fetch("/api/plans?list=true").then((r) => r.json()),
      fetch("/api/meals/counts").then((r) => r.json()),
      fetch("/api/ratings").then((r) => r.json()),
      fetch("/api/settings/categories").then((r) => r.json()),
      fetch("/api/shopping/patterns").then((r) => r.json()),
    ])
      .then(([m, p, { model }, rm, plansList, counts, ratingsList, catList, patternList]: [FamilyMember[], FamilyPreference[], { model: string }, { mode: string }, MealPlan[], Record<string, number>, MealRating[], ShoppingCategory[], ShoppingPattern[]]) => {
        setMembers(m);
        setPrefs(p);
        if (model) setActiveModel(model);
        if (rm?.mode) setRecipeMode(rm.mode as "external" | "ai");
        setPlans(
          [...plansList]
            .reverse() // newest first for the settings list
            .map((pl) => ({ ...pl, meal_count: counts[pl.id] ?? 0 }))
        );
        setRatings(ratingsList ?? []);
        setCategories(catList ?? []);
        setPatterns(patternList ?? []);
      })
      .catch(() => showToast("Kunne ikke laste innstillinger", "error"))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/settings/budget")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.budget === "number") setWeeklyBudget(String(d.budget));
      })
      .catch(() => {});
  }, []);

  async function handleBudgetSave() {
    const value = Number(weeklyBudget);
    if (!Number.isFinite(value) || value <= 0) {
      showToast("Ugyldig budsjett", "error");
      return;
    }
    setSavingBudget(true);
    try {
      const res = await fetch("/api/settings/budget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget: value }),
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setWeeklyBudget(String(d.budget));
      showToast("Budsjett lagret", "success");
    } catch {
      showToast("Kunne ikke lagre budsjett", "error");
    } finally {
      setSavingBudget(false);
    }
  }

  async function handleRecipeModeChange(mode: "external" | "ai") {
    setSavingRecipeMode(true);
    try {
      await fetch("/api/settings/recipe-mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      setRecipeMode(mode);
      showToast("Oppskriftsmodus lagret", "success");
    } catch {
      showToast("Kunne ikke lagre", "error");
    } finally {
      setSavingRecipeMode(false);
    }
  }

  async function handleModelChange(modelId: string) {
    setSavingModel(true);
    try {
      const res = await fetch("/api/settings/model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelId }),
      });
      if (!res.ok) throw new Error();
      setActiveModel(modelId);
      showToast("Modell lagret", "success");
    } catch {
      showToast("Kunne ikke lagre modell", "error");
    } finally {
      setSavingModel(false);
    }
  }

  async function deletePlan(id: string, label: string) {
    if (!confirm(`Slett plan "${label}" og alle måltider og handlevarer i den?`)) return;
    const res = await fetch(`/api/plans?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setPlans((prev) => prev.filter((p) => p.id !== id));
      showToast("Plan slettet", "success");
    } else {
      showToast("Kunne ikke slette plan", "error");
    }
  }

  async function deleteMember(id: string) {
    if (!confirm("Slett familiemedlem?")) return;
    await fetch(`/api/settings/members?id=${id}`, { method: "DELETE" });
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  async function deletePref(id: string) {
    await fetch(`/api/settings/preferences?id=${id}`, { method: "DELETE" });
    setPrefs((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleEditMember(id: string, fields: Partial<FamilyMember>) {
    const res = await fetch("/api/settings/members", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
    if (res.ok) {
      const updated: FamilyMember = await res.json();
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setEditingMember(null);
    }
  }

  async function handleEditPref(id: string, fields: Partial<FamilyPreference>) {
    const res = await fetch("/api/settings/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
    if (res.ok) {
      const updated: FamilyPreference = await res.json();
      setPrefs((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditingPref(null);
    }
  }

  async function togglePref(pref: FamilyPreference) {
    const res = await fetch("/api/settings/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pref.id, active: !pref.active }),
    });
    if (res.ok) {
      const updated: FamilyPreference = await res.json();
      setPrefs((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    }
  }

  async function handleEditRating(id: string, fields: Partial<MealRating>) {
    const res = await fetch("/api/ratings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
    if (res.ok) {
      const updated: MealRating = await res.json();
      setRatings((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditingRating(null);
    }
  }

  async function deleteRating(id: string) {
    if (!confirm("Slett vurdering?")) return;
    const res = await fetch(`/api/ratings?id=${id}`, { method: "DELETE" });
    if (res.ok) setRatings((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleAddCategory(name: string) {
    const res = await fetch("/api/settings/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const cat: ShoppingCategory = await res.json();
      setCategories((prev) => [...prev, cat]);
      showToast("Kategori lagt til", "success");
    } else {
      showToast("Kunne ikke legge til kategori", "error");
    }
  }

  async function handleRenameCategory(id: string, name: string) {
    const res = await fetch("/api/settings/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    });
    if (res.ok) {
      const updated: ShoppingCategory = await res.json();
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingCategory(null);
    } else {
      showToast("Kunne ikke oppdatere kategori", "error");
    }
  }

  async function toggleCategory(cat: ShoppingCategory) {
    const res = await fetch("/api/settings/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cat.id, active: !cat.active }),
    });
    if (res.ok) {
      const updated: ShoppingCategory = await res.json();
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm("Slett kategori? Varer med denne kategorien vises ikke lenger i listen.")) return;
    const res = await fetch(`/api/settings/categories?id=${id}`, { method: "DELETE" });
    if (res.ok) setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  async function moveCategoryUp(index: number) {
    if (index === 0) return;
    const a = categories[index - 1];
    const b = categories[index];
    // Swap sort_order values
    await Promise.all([
      fetch("/api/settings/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id, sort_order: b.sort_order }),
      }),
      fetch("/api/settings/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: b.id, sort_order: a.sort_order }),
      }),
    ]);
    setCategories((prev) => {
      const next = [...prev];
      next[index - 1] = { ...a, sort_order: b.sort_order };
      next[index] = { ...b, sort_order: a.sort_order };
      return next.sort((x, y) => x.sort_order - y.sort_order);
    });
  }

  async function moveCategoryDown(index: number) {
    if (index >= categories.length - 1) return;
    await moveCategoryUp(index + 1);
  }

  async function setPatternOverride(pattern: ShoppingPattern, category_override: string | null) {
    const res = await fetch("/api/shopping/patterns", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pattern.id, category_override }),
    });
    if (res.ok) {
      const updated: ShoppingPattern = await res.json();
      setPatterns((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    }
  }

  async function setStapleOverride(pattern: ShoppingPattern, staple_override: boolean | null) {
    const res = await fetch("/api/shopping/patterns", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pattern.id, staple_override }),
    });
    if (res.ok) {
      const updated: ShoppingPattern = await res.json();
      setPatterns((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    }
  }

  const PREF_LABELS: Record<string, string> = {
    dislikes: "Liker ikke",
    never_use: "Aldri",
    prefers: "Foretrekker",
    allergy: "Allergi",
    max_per_week: "Maks/uke",
    min_per_week: "Minst/uke",
    default_choice: "Standard",
    cooking_rule: "Regel",
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ToastContainer />

      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-emerald-600" />
        <h1 className="text-lg font-semibold">Innstillinger</h1>
      </div>

      {/* AI model */}
      <CollapsibleSection icon={<Bot className="w-4 h-4" />} title="AI-modell">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
          {AVAILABLE_MODELS.map((m) => {
            const isActive = activeModel === m.id;
            return (
              <button
                key={m.id}
                onClick={() => !isActive && handleModelChange(m.id)}
                disabled={savingModel}
                className={`w-full flex items-center gap-4 p-4 text-left transition-colors disabled:opacity-60 ${
                  isActive ? "bg-emerald-50 dark:bg-emerald-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isActive ? "border-emerald-600 bg-emerald-600" : "border-gray-300 dark:border-gray-600"}`}>
                  {isActive && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{m.name}</span>
                    {m.id === DEFAULT_MODEL && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">Anbefalt</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{m.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* Weekly budget */}
      <CollapsibleSection icon={<Wallet className="w-4 h-4" />} title="Ukesbudsjett">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-2">
          <p className="text-xs text-gray-400">
            Brukes i Innsikt-fanen og når AI-en estimerer kostnader. Inkluderer alle dagligvarer.
          </p>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              inputMode="numeric"
              value={weeklyBudget}
              onChange={(e) => setWeeklyBudget(e.target.value)}
              className="w-32 text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">NOK / uke</span>
            <button
              onClick={handleBudgetSave}
              disabled={savingBudget}
              className="ml-auto px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              Lagre
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* Recipe mode */}
      <CollapsibleSection icon={<BookOpen className="w-4 h-4" />} title="Oppskriftsmodus">
        <div className="space-y-3">
          <div className="flex gap-2">
            {(["external", "ai"] as const).map((m) => (
              <button
                key={m}
                onClick={() => handleRecipeModeChange(m)}
                disabled={savingRecipeMode}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  recipeMode === m
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {m === "external" ? "Ekte oppskrifter" : "AI-oppskrifter"}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            {recipeMode === "external"
              ? "Henter ingredienser direkte fra matprat.no / godt.no. Trykk på et måltidskort for å åpne oppskriften."
              : "AI lager en komplett oppskrift med fremgangsmåte. Trykk på et måltidskort for å se den."}
          </p>
        </div>
      </CollapsibleSection>

      {/* Plans */}
      <CollapsibleSection icon={<CalendarDays className="w-4 h-4" />} title="Planer" badge={plans.length > 0 ? String(plans.length) : undefined}>
        {plans.length === 0 ? (
          <p className="text-sm text-gray-400">Ingen planer ennå.</p>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
            {plans.map((pl) => {
              const label = `${pl.date_from} → ${pl.date_to}`;
              return (
                <div key={pl.id} className="flex items-center gap-3 p-4">
                  <Link
                    href={`/plan?id=${pl.id}`}
                    className="flex-1 min-w-0 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                    onClick={() => {
                      localStorage.setItem("activePlanId", pl.id);
                    }}
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {pl.meal_count === 0 ? "Ingen måltider" : `${pl.meal_count} måltid${pl.meal_count !== 1 ? "er" : ""}`}
                    </div>
                  </Link>
                  <button
                    onClick={() => deletePlan(pl.id, label)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Slett plan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      {/* Shopping categories */}
      <CollapsibleSection
        icon={<Tag className="w-4 h-4" />}
        title="Handlekategorier"
        badge={String(categories.length)}
        action={
          <AddCategoryButton
            onAdd={handleAddCategory}
          />
        }
      >
        {categories.length === 0 ? (
          <p className="text-sm text-gray-400">Ingen kategorier ennå.</p>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
            {categories.map((cat, idx) => (
              <div key={cat.id} className={`flex items-center gap-2 px-4 py-3 ${!cat.active ? "opacity-50" : ""}`}>
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveCategoryUp(idx)}
                    disabled={idx === 0}
                    className="text-gray-300 dark:text-gray-600 hover:text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Flytt opp"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveCategoryDown(idx)}
                    disabled={idx === categories.length - 1}
                    className="text-gray-300 dark:text-gray-600 hover:text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Flytt ned"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">{cat.name}</span>
                <button
                  onClick={() => toggleCategory(cat)}
                  className={`px-2 py-1 rounded-lg text-xs ${cat.active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}
                >
                  {cat.active ? "Aktiv" : "Skjult"}
                </button>
                <button
                  onClick={() => setEditingCategory(cat)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Gi nytt navn"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteCategory(cat.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Slett"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        {editingCategory && (
          <EditCategoryModal
            category={editingCategory}
            onSave={(name) => handleRenameCategory(editingCategory.id, name)}
            onClose={() => setEditingCategory(null)}
          />
        )}
      </CollapsibleSection>

      {/* Category overrides */}
      {(() => {
        const overrides = patterns.filter((p) => p.category_override);
        const categoryNames = categories.filter((c) => c.active).map((c) => c.name);
        return (
          <CollapsibleSection
            icon={<PackageSearch className="w-4 h-4" />}
            title="Kategori-overstyringer"
            badge={overrides.length > 0 ? String(overrides.length) : undefined}
          >
            <p className="text-xs text-gray-400">
              Sett kategori på en vare i handlelisten — den huskes for alltid. Administrer dem her.
            </p>

            {overrides.length > 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
                {overrides.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex-1 text-sm text-gray-900 dark:text-gray-100 truncate">{p.item_name}</span>
                    <select
                      value={p.category_override ?? ""}
                      onChange={(e) => setPatternOverride(p, e.target.value || null)}
                      className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
                    >
                      {categoryNames.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setPatternOverride(p, null)}
                      title="Fjern overstyring"
                      className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Ingen overstyringer ennå. Endre kategori på en vare i handlelisten for å opprette en.</p>
            )}
          </CollapsibleSection>
        );
      })()}

      {/* Staples */}
      {(() => {
        const known = patterns.filter((p) => (p.times_bought ?? 0) >= 3);
        const effStaple = (p: ShoppingPattern) => (p.staple_override ?? p.is_staple) === true;
        const stapleCount = known.filter(effStaple).length;
        return (
          <CollapsibleSection
            icon={<PackageSearch className="w-4 h-4" />}
            title="Faste varer"
            badge={stapleCount > 0 ? String(stapleCount) : undefined}
          >
            <p className="text-xs text-gray-400">
              Faste varer legges alltid i handlelisten, uansett middager (melk, brød, pålegg). Andre varer kommer kun med når en middag krever dem. ✓ = fast vare. Trykk for å endre; X tilbakestiller til automatisk.
            </p>
            {known.length > 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
                {known.map((p) => {
                  const eff = effStaple(p);
                  const overridden = p.staple_override !== null && p.staple_override !== undefined;
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <button
                        onClick={() => setStapleOverride(p, !eff)}
                        className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${eff ? "bg-emerald-600 border-emerald-600 text-white" : "border-gray-300 dark:border-gray-600 text-transparent"}`}
                        title={eff ? "Fast vare" : "Ikke fast vare"}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <span className="flex-1 text-sm text-gray-900 dark:text-gray-100 truncate">
                        {p.item_name}
                        {p.category && <span className="text-xs text-gray-400"> · {p.category}</span>}
                      </span>
                      {overridden && (
                        <button
                          onClick={() => setStapleOverride(p, null)}
                          title="Tilbakestill til automatisk"
                          className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Ingen varemønstre ennå. Synkroniser kvitteringer eller fullfør noen handleturer.</p>
            )}
          </CollapsibleSection>
        );
      })()}

      {/* Family members */}
      <CollapsibleSection
        icon={<Settings className="w-4 h-4" />}
        title="Familiemedlemmer"
        action={
          <AddMemberButton
            onAdd={async (data) => {
              const res = await fetch("/api/settings/members", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
              });
              if (res.ok) {
                const m: FamilyMember = await res.json();
                setMembers((prev) => [...prev, m]);
              }
            }}
          />
        }
      >
        {members.length === 0 ? (
          <p className="text-sm text-gray-400">Ingen familiemedlemmer lagt til ennå.</p>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{m.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {m.role}{m.birthdate ? ` · ${m.birthdate}` : ""}{m.cooks_independently ? " · Lager mat selv" : ""}
                  </div>
                  {m.notes && <div className="text-xs text-gray-400 mt-0.5">{m.notes}</div>}
                </div>
                <div className="flex gap-1 items-center">
                  <button
                    onClick={() => {
                      const active = !m.active;
                      fetch("/api/settings/members", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: m.id, active }),
                      }).then((r) => r.json()).then((updated: FamilyMember) => {
                        setMembers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                      });
                    }}
                    className={`px-2 py-1 rounded-lg text-xs ${m.active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}
                  >
                    {m.active ? "Aktiv" : "Inaktiv"}
                  </button>
                  <button onClick={() => setEditingMember(m)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center" title="Rediger">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteMember(m.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {editingMember && (
          <EditMemberModal
            member={editingMember}
            onSave={(fields) => handleEditMember(editingMember.id, fields)}
            onClose={() => setEditingMember(null)}
          />
        )}
      </CollapsibleSection>

      {/* Preferences */}
      <CollapsibleSection
        icon={<Check className="w-4 h-4" />}
        title="Preferanser og regler"
        action={
          <AddPrefButton
            members={members}
            onAdd={async (data) => {
              const res = await fetch("/api/settings/preferences", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
              });
              if (res.ok) {
                const p: FamilyPreference = await res.json();
                setPrefs((prev) => [...prev, p]);
              }
            }}
          />
        }
      >
        {prefs.length === 0 ? (
          <p className="text-sm text-gray-400">Ingen preferanser lagt til ennå.</p>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
            {prefs.map((p) => (
              <div key={p.id} className={`flex items-center gap-3 p-4 ${!p.active ? "opacity-50" : ""}`}>
                <button onClick={() => togglePref(p)} className="shrink-0">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${p.active ? "bg-emerald-600 border-emerald-600" : "border-gray-300 dark:border-gray-600"}`}>
                    {p.active && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">{PREF_LABELS[p.category] ?? p.category}</span>
                    <span className="text-xs text-gray-400">{p.who}</span>
                  </div>
                  <div className="text-sm text-gray-900 dark:text-gray-100 mt-0.5">{p.rule}</div>
                  {p.details && <div className="text-xs text-gray-400">{p.details}</div>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditingPref(p)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center" title="Rediger">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deletePref(p.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {editingPref && (
          <EditPrefModal
            pref={editingPref}
            members={members}
            onSave={(fields) => handleEditPref(editingPref.id, fields)}
            onClose={() => setEditingPref(null)}
          />
        )}
      </CollapsibleSection>

      {/* Ratings */}
      <CollapsibleSection
        icon={<Star className="w-4 h-4" />}
        title="Vurderinger"
        badge={ratings.length > 0 ? String(ratings.length) : undefined}
      >
        {ratings.length === 0 ? (
          <p className="text-sm text-gray-400">Ingen vurderinger ennå.</p>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
            {(["loved", "ok", "disliked", "never_again"] as const).map((group) => {
              const groupItems = ratings.filter((r) => r.rating === group);
              if (groupItems.length === 0) return null;
              return groupItems.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-4">
                  <span className="text-lg shrink-0" title={RATING_LABELS[r.rating]}>
                    {RATING_EMOJI[r.rating]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{r.meal_name}</div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RATING_PILL[r.rating]}`}>
                        {RATING_LABELS[r.rating]}
                      </span>
                      {r.notes && <span className="text-xs text-gray-400 truncate max-w-[160px]">{r.notes}</span>}
                      {r.last_made && <span className="text-xs text-gray-300 dark:text-gray-600">{r.last_made}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setEditingRating(r)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Rediger"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteRating(r.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ));
            })}
          </div>
        )}
        {editingRating && (
          <EditRatingModal
            rating={editingRating}
            onSave={(fields) => handleEditRating(editingRating.id, fields)}
            onClose={() => setEditingRating(null)}
          />
        )}
      </CollapsibleSection>

      {/* Store connections (receipt sync) */}
      <CollapsibleSection icon={<Store className="w-4 h-4" />} title="Butikker">
        <StoreConnections showToast={showToast} />
      </CollapsibleSection>
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────

interface CollapsibleSectionProps {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ icon, title, badge, action, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <span className="text-gray-400 shrink-0">{icon}</span>
        <span className="flex-1 text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</span>
        {badge && (
          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-gray-700 pt-3">
          {action && <div className="flex justify-end">{action}</div>}
          {children}
        </div>
      )}
    </div>
  );
}

// ── Add member form ────────────────────────────────────────────────────────────

interface AddMemberButtonProps {
  onAdd: (data: Partial<FamilyMember>) => Promise<void>;
}

function AddMemberButton({ onAdd }: AddMemberButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<"far" | "mor" | "barn">("barn");
  const [birthdate, setBirthdate] = useState("");
  const [cooks, setCooks] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await onAdd({ name, role, birthdate: birthdate || null, cooks_independently: cooks, active: true });
    setName(""); setBirthdate(""); setCooks(false); setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium"
      >
        <Plus className="w-4 h-4" /> Legg til
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold">Nytt familiemedlem</h3>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Navn" className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100" />
            <select value={role} onChange={(e) => setRole(e.target.value as "far" | "mor" | "barn")} className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100">
              <option value="far">Far</option>
              <option value="mor">Mor</option>
              <option value="barn">Barn</option>
            </select>
            <input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} placeholder="Fødselsdato" className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100" />
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={cooks} onChange={(e) => setCooks(e.target.checked)} />
              <div className="w-5 h-5 rounded border-2 border-gray-300 peer-checked:bg-emerald-600 peer-checked:border-emerald-600 flex items-center justify-center transition-colors">
                {cooks && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-sm">Lager mat selv</span>
            </label>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Lagre</button>
              <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600">Avbryt</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

// ── Edit member modal ─────────────────────────────────────────────────────────

interface EditMemberModalProps {
  member: FamilyMember;
  onSave: (fields: Partial<FamilyMember>) => Promise<void>;
  onClose: () => void;
}

function EditMemberModal({ member, onSave, onClose }: EditMemberModalProps) {
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState<"far" | "mor" | "barn">(member.role);
  const [birthdate, setBirthdate] = useState(member.birthdate ?? "");
  const [cooks, setCooks] = useState(member.cooks_independently);
  const [notes, setNotes] = useState(member.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave({
      name,
      role,
      birthdate: birthdate || null,
      cooks_independently: cooks,
      notes: notes || null,
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h3 className="font-semibold">Rediger {member.name}</h3>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Navn"
          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "far" | "mor" | "barn")}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
        >
          <option value="far">Far</option>
          <option value="mor">Mor</option>
          <option value="barn">Barn</option>
        </select>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Fødselsdato</label>
          <input
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
          />
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="sr-only peer" checked={cooks} onChange={(e) => setCooks(e.target.checked)} />
          <div className="w-5 h-5 rounded border-2 border-gray-300 peer-checked:bg-emerald-600 peer-checked:border-emerald-600 flex items-center justify-center transition-colors">
            {cooks && <Check className="w-3 h-3 text-white" />}
          </div>
          <span className="text-sm">Lager mat selv</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notater (valgfritt, f.eks. «foretrekker enkel mat»)"
          rows={2}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100 resize-none"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Lagrer…" : "Lagre"}
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

// ── Edit preference modal ─────────────────────────────────────────────────────

interface EditPrefModalProps {
  pref: FamilyPreference;
  members: FamilyMember[];
  onSave: (fields: Partial<FamilyPreference>) => Promise<void>;
  onClose: () => void;
}

function EditPrefModal({ pref, members, onSave, onClose }: EditPrefModalProps) {
  const [who, setWho] = useState(pref.who);
  const [category, setCategory] = useState(pref.category);
  const [rule, setRule] = useState(pref.rule);
  const [details, setDetails] = useState(pref.details ?? "");
  const [saving, setSaving] = useState(false);

  const whoOptions = ["Familie", ...members.filter((m) => m.active).map((m) => m.name)];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rule.trim()) return;
    setSaving(true);
    await onSave({ who, category, rule, details: details || null });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h3 className="font-semibold">Rediger preferanse</h3>
        <select value={who} onChange={(e) => setWho(e.target.value)} className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100">
          {whoOptions.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value as FamilyPreference["category"])} className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100">
          <option value="dislikes">Liker ikke</option>
          <option value="never_use">Aldri bruk</option>
          <option value="prefers">Foretrekker</option>
          <option value="allergy">Allergi</option>
          <option value="max_per_week">Maks per uke</option>
          <option value="min_per_week">Minst per uke</option>
          <option value="default_choice">Standard valg</option>
          <option value="cooking_rule">Matlagingsregel</option>
        </select>
        <input
          required
          value={rule}
          onChange={(e) => setRule(e.target.value)}
          placeholder="Regel"
          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
        />
        <input
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Detaljer (valgfritt)"
          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
        />
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">
            {saving ? "Lagrer…" : "Lagre"}
          </button>
          <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600">
            Avbryt
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Rating display helpers ────────────────────────────────────────────────────

const RATING_EMOJI: Record<string, string> = {
  loved: "🟢",
  ok: "🟡",
  disliked: "🔴",
  never_again: "⛔",
};

const RATING_LABELS: Record<string, string> = {
  loved: "Elsker",
  ok: "OK",
  disliked: "Liker ikke",
  never_again: "Aldri igjen",
};

const RATING_PILL: Record<string, string> = {
  loved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  ok: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  disliked: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  never_again: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

// ── Edit rating modal ─────────────────────────────────────────────────────────

interface EditRatingModalProps {
  rating: MealRating;
  onSave: (fields: Partial<MealRating>) => Promise<void>;
  onClose: () => void;
}

function EditRatingModal({ rating, onSave, onClose }: EditRatingModalProps) {
  const [ratingVal, setRatingVal] = useState<MealRating["rating"]>(rating.rating);
  const [notes, setNotes] = useState(rating.notes ?? "");
  const [recipeUrl, setRecipeUrl] = useState(rating.recipe_url ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({ rating: ratingVal, notes: notes || null, recipe_url: recipeUrl || null });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h3 className="font-semibold truncate">{rating.meal_name}</h3>

        {/* Rating picker */}
        <div className="grid grid-cols-2 gap-2">
          {(["loved", "ok", "disliked", "never_again"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRatingVal(r)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                ratingVal === r
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                  : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
              }`}
            >
              <span>{RATING_EMOJI[r]}</span>
              <span>{RATING_LABELS[r]}</span>
            </button>
          ))}
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notater (valgfritt)"
          rows={2}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100 resize-none"
        />
        <input
          value={recipeUrl}
          onChange={(e) => setRecipeUrl(e.target.value)}
          placeholder="Oppskrift URL (valgfritt)"
          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
        />

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Lagrer…" : "Lagre"}
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

// ── Add preference form ───────────────────────────────────────────────────────

interface AddPrefButtonProps {
  members: FamilyMember[];
  onAdd: (data: Partial<FamilyPreference>) => Promise<void>;
}

function AddPrefButton({ members, onAdd }: AddPrefButtonProps) {
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState("Familie");
  const [category, setCategory] = useState("dislikes");
  const [rule, setRule] = useState("");
  const [details, setDetails] = useState("");

  const whoOptions = ["Familie", ...members.filter((m) => m.active).map((m) => m.name)];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rule.trim()) return;
    await onAdd({ who, category: category as FamilyPreference["category"], rule, details: details || null, active: true });
    setRule(""); setDetails(""); setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium"
      >
        <Plus className="w-4 h-4" /> Legg til
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold">Ny preferanse</h3>
            <select value={who} onChange={(e) => setWho(e.target.value)} className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100">
              {whoOptions.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100">
              <option value="dislikes">Liker ikke</option>
              <option value="never_use">Aldri bruk</option>
              <option value="prefers">Foretrekker</option>
              <option value="allergy">Allergi</option>
              <option value="max_per_week">Maks per uke</option>
              <option value="min_per_week">Minst per uke</option>
              <option value="default_choice">Standard valg</option>
              <option value="cooking_rule">Matlagingsregel</option>
            </select>
            <input required value={rule} onChange={(e) => setRule(e.target.value)} placeholder="Regel (f.eks. Ikke fisk på fredager)" className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100" />
            <input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Detaljer (valgfritt)" className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100" />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Lagre</button>
              <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600">Avbryt</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

// ── Add category button ───────────────────────────────────────────────────────

interface AddCategoryButtonProps {
  onAdd: (name: string) => Promise<void>;
}

function AddCategoryButton({ onAdd }: AddCategoryButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onAdd(name.trim());
    setName("");
    setSaving(false);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium"
      >
        <Plus className="w-4 h-4" /> Legg til
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold">Ny kategori</h3>
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kategorinavn (f.eks. Pålegg)"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
            />
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
                onClick={() => setOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Avbryt
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

// ── Edit category modal ───────────────────────────────────────────────────────

interface EditCategoryModalProps {
  category: ShoppingCategory;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}

function EditCategoryModal({ category, onSave, onClose }: EditCategoryModalProps) {
  const [name, setName] = useState(category.name);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave(name.trim());
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h3 className="font-semibold">Gi nytt navn</h3>
        <input
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Kategorinavn"
          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-gray-100"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Lagrer…" : "Lagre"}
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
