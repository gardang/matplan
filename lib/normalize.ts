// Item name normalization, quantity merging, sorting, and recipe URL matching
// Rules: _context/normalize.md

import { RECIPE_SITES } from "./constants";

// ─── Name normalization ───────────────────────────────────────────────────────

export function normalizeItemName(raw: string): string {
  let name = raw.trim();

  // Remove parenthetical qualifiers, keep first option
  name = name.replace(/\s*\(([^)]*)\)/g, "");
  // Remove "eller ..." constructs
  name = name.replace(/\s+eller\s+\S+/gi, "");
  // Strip fersk/tørket qualifiers
  name = name.replace(/\b(fersk|tørket)\s+/gi, "");
  // Strip "potte" unit from name
  name = name.replace(/\bpotte\b/gi, "").trim();

  // Paprika normalizations
  if (/paprika/i.test(name)) {
    if (/gul/i.test(name)) return "Gul paprika";
    if (/grønn/i.test(name)) return "Grønn paprika";
    return "Rød paprika";
  }

  // Løk: bare løk → rødløk
  if (/^løk$/i.test(name.trim())) return "Rødløk";

  // Salat → isbergsalat
  if (/^salat$/i.test(name.trim()) || /isbergsalat/i.test(name)) {
    return "Isbergsalat";
  }

  // Capitalize first letter
  name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  // But preserve proper case for multi-word (only capitalize first char, rest as-is)
  name = raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1);
  // Re-apply the single-word lower → capitalize
  if (!name.includes(" ")) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }

  return name.trim();
}

// ─── Quantity normalization ───────────────────────────────────────────────────

export function normalizeQuantity(q: string): string {
  if (!q) return "";
  let qty = q.trim();
  // "nett" → 3 stk
  if (/\bnett\b/i.test(qty)) {
    qty = qty.replace(/\d+/, "3").replace(/\bnett\b/i, "stk");
  }
  // potte → stk
  qty = qty.replace(/\bpotte\b/gi, "stk").trim();
  return qty;
}

// ─── Quantity merging ─────────────────────────────────────────────────────────

export function mergeQuantities(quantities: string[]): string {
  if (quantities.length === 0) return "";
  const nonEmpty = quantities.filter(Boolean);
  if (nonEmpty.length === 0) return "";
  if (nonEmpty.length === 1) return nonEmpty[0];

  // Parse each quantity into { number, unit }
  const parsed = nonEmpty.map((q) => {
    const m = q.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
    if (m) return { num: parseFloat(m[1].replace(",", ".")), unit: m[2].trim() };
    return { num: 1, unit: q.trim() };
  });

  // Check if all same unit
  const units = parsed.map((p) => p.unit.toLowerCase());
  const uniqueUnits = [...new Set(units)];

  if (uniqueUnits.length === 1) {
    const total = parsed.reduce((s, p) => s + p.num, 0);
    const unit = parsed[0].unit;
    return `${total % 1 === 0 ? total : total.toFixed(1)} ${unit}`.trim();
  }

  // Different units: sum numbers, pick most common unit
  const total = parsed.reduce((s, p) => s + p.num, 0);
  const unitCounts: Record<string, number> = {};
  for (const u of units) unitCounts[u] = (unitCounts[u] ?? 0) + 1;
  const mostCommonUnit = Object.entries(unitCounts).sort((a, b) => b[1] - a[1])[0][0];
  return `${total % 1 === 0 ? total : total.toFixed(1)} ${mostCommonUnit}`.trim();
}

// ─── Sort key ─────────────────────────────────────────────────────────────────

export function sortKey(name: string): string {
  const n = name.toLowerCase();
  if (/paprika/.test(n)) return "paprika " + n.replace(/paprika/, "").trim();
  if (/rødløk|rød løk/.test(n)) return "løk rød";
  if (/gul løk|gulløk/.test(n)) return "løk gul";
  if (/vårløk/.test(n)) return "løk vår";
  if (/^tomat/.test(n)) return "tomat " + n.slice(5).trim();
  if (/^salat/.test(n)) return "salat " + n.slice(5).trim();
  return n;
}

// ─── Recipe URL matching ──────────────────────────────────────────────────────

interface UrlCandidate {
  url: string;
  title?: string;
}

export function matchUrlToRecipe(
  recipeName: string,
  candidates: UrlCandidate[]
): string | null {
  if (!candidates.length) return null;

  const recipeWords = recipeName.toLowerCase().split(/\s+/);
  const recipeSiteDomains = Object.keys(RECIPE_SITES);

  let best: { url: string; score: number } | null = null;

  for (const { url, title } of candidates) {
    let score = 0;
    const urlLower = url.toLowerCase();
    const titleLower = (title ?? "").toLowerCase();

    // Word overlap with title × 2
    for (const word of recipeWords) {
      if (word.length > 3 && titleLower.includes(word)) score += 2;
    }
    // Word overlap with URL
    for (const word of recipeWords) {
      if (word.length > 3 && urlLower.includes(word)) score += 1;
    }
    // Recipe site bonus
    if (recipeSiteDomains.some((d) => urlLower.includes(d))) score += 3;

    if (!best || score > best.score) best = { url, score };
  }

  return best?.url ?? null;
}

// ─── Fallback search URL ──────────────────────────────────────────────────────

export function fallbackSearchUrl(mealName: string, site = "matprat.no"): string {
  const base = RECIPE_SITES[site] ?? RECIPE_SITES["matprat.no"];
  return base + encodeURIComponent(mealName);
}

// ─── Local date string (avoids toISOString UTC shift) ────────────────────────

export function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}
