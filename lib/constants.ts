// ── AI models ─────────────────────────────────────────────────────────────────

export interface ModelOption {
  id: string;
  name: string;
  description: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    description: "Anbefalt – best balanse mellom kvalitet og hastighet",
  },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    description: "Raskere og billigere – bra for enkle spørsmål",
  },
];

export const DEFAULT_MODEL = "claude-sonnet-4-6";

// ── Shopping categories — used for grouping and AI prompts ────────────────────
export const CATEGORIES = [
  "Grønnsaker og frukt",
  "Kjøtt og fisk",
  "Meieri og egg",
  "Brød og bakevarer",
  "Tørrvarer",
  "Frysevarer",
  "Krydder og sauser",
  "Hermetikk",
  "Drikke",
  "Snacks og godteri",
  "Rengjøring",
  "Annet",
] as const;

export type Category = (typeof CATEGORIES)[number];

// Standard weekly staples
export const STAPLES: Array<{ name: string; quantity: string; category: Category }> = [
  { name: "Melk", quantity: "2 liter", category: "Meieri og egg" },
  { name: "Egg", quantity: "12 stk", category: "Meieri og egg" },
  { name: "Smør", quantity: "1 pk", category: "Meieri og egg" },
  { name: "Brød", quantity: "1 stk", category: "Brød og bakevarer" },
  { name: "Appelsinjuice", quantity: "1 liter", category: "Drikke" },
  { name: "Kaffe", quantity: "1 pk", category: "Drikke" },
  { name: "Bananer", quantity: "1 bunt", category: "Grønnsaker og frukt" },
];

// Recipe site fallback search URLs
export const RECIPE_SITES: Record<string, string> = {
  "matprat.no": "https://www.matprat.no/sok/?q=",
  "godt.no": "https://www.godt.no/sok?q=",
  "tine.no": "https://www.tine.no/oppskrifter/search?q=",
  "meny.no": "https://meny.no/oppskrifter?q=",
  "aperitif.no": "https://www.aperitif.no/sokeresultater?q=",
};

// Day-of-week color map (0=Sunday, 1=Monday, …)
export const DAY_COLORS: Record<number, string> = {
  1: "blue",
  2: "emerald",
  3: "orange",
  4: "teal",
  5: "pink",
  6: "violet",
  0: "gray",
};

// Tailwind border/bg/text classes by color name (must be literal for Tailwind JIT)
export const DAY_BORDER_CLASSES: Record<string, string> = {
  blue: "border-l-blue-500",
  emerald: "border-l-emerald-500",
  orange: "border-l-orange-500",
  teal: "border-l-teal-500",
  pink: "border-l-pink-500",
  violet: "border-l-violet-500",
  gray: "border-l-gray-400",
};

export const DAY_PILL_CLASSES: Record<string, string> = {
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  pink: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  gray: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

// Short day labels (Norwegian)
export const DAY_LABELS_SHORT: Record<number, string> = {
  1: "Man",
  2: "Tir",
  3: "Ons",
  4: "Tor",
  5: "Fre",
  6: "Lør",
  0: "Søn",
};

export const DAY_LABELS_LONG: Record<number, string> = {
  1: "Mandag",
  2: "Tirsdag",
  3: "Onsdag",
  4: "Torsdag",
  5: "Fredag",
  6: "Lørdag",
  0: "Søndag",
};
