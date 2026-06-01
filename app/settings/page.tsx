"use client";

import { useEffect, useState } from "react";
import { Settings, Plus, Trash2, Check, Bot, Pencil, BookOpen } from "lucide-react";
import { useToast } from "@/components/Toast";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "@/lib/constants";
import type { FamilyMember, FamilyPreference } from "@/lib/types";

export default function SettingsPage() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [prefs, setPrefs] = useState<FamilyPreference[]>([]);
  const [activeModel, setActiveModel] = useState(DEFAULT_MODEL);
  const [savingModel, setSavingModel] = useState(false);
  const [recipeMode, setRecipeMode] = useState<"external" | "ai">("external");
  const [savingRecipeMode, setSavingRecipeMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const { showToast, ToastContainer } = useToast();

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/members").then((r) => r.json()),
      fetch("/api/settings/preferences").then((r) => r.json()),
      fetch("/api/settings/model").then((r) => r.json()),
      fetch("/api/settings/recipe-mode").then((r) => r.json()),
    ])
      .then(([m, p, { model }, rm]) => {
        setMembers(m);
        setPrefs(p);
        if (model) setActiveModel(model);
        if (rm?.mode) setRecipeMode(rm.mode);
      })
      .catch(() => showToast("Kunne ikke laste innstillinger", "error"))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="space-y-6">
      <ToastContainer />

      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-emerald-600" />
        <h1 className="text-lg font-semibold">Innstillinger</h1>
      </div>

      {/* AI model */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            AI-modell
          </h2>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
          {AVAILABLE_MODELS.map((m) => {
            const isActive = activeModel === m.id;
            return (
              <button
                key={m.id}
                onClick={() => !isActive && handleModelChange(m.id)}
                disabled={savingModel}
                className={`w-full flex items-center gap-4 p-4 text-left transition-colors disabled:opacity-60 ${
                  isActive
                    ? "bg-emerald-50 dark:bg-emerald-900/20"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isActive
                      ? "border-emerald-600 bg-emerald-600"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {isActive && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {m.name}
                    </span>
                    {m.id === DEFAULT_MODEL && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                        Anbefalt
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {m.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Recipe mode */}
      <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-600" />
          <h2 className="font-semibold text-sm">Oppskriftsmodus</h2>
        </div>
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

      {/* Family members */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Familiemedlemmer
          </h2>
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
        </div>

        {members.length === 0 ? (
          <p className="text-sm text-gray-400">Ingen familiemedlemmer lagt til ennå.</p>
        ) : (
          <>
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
                  <button
                    onClick={() => setEditingMember(m)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Rediger"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteMember(m.id)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Edit member modal */}
          {editingMember && (
            <EditMemberModal
              member={editingMember}
              onSave={(fields) => handleEditMember(editingMember.id, fields)}
              onClose={() => setEditingMember(null)}
            />
          )}
          </>
        )}
      </section>

      {/* Preferences */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Preferanser og regler
          </h2>
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
        </div>

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
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                      {PREF_LABELS[p.category] ?? p.category}
                    </span>
                    <span className="text-xs text-gray-400">{p.who}</span>
                  </div>
                  <div className="text-sm text-gray-900 dark:text-gray-100 mt-0.5">{p.rule}</div>
                  {p.details && <div className="text-xs text-gray-400">{p.details}</div>}
                </div>
                <button
                  onClick={() => deletePref(p.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
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
