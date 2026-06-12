// Dynamic system prompt builder — reads family data from Supabase at request time
// Rules: skills/claude-api/SKILL.md

import { createServerClient } from "./supabase-server";
import { toLocalDateString } from "./normalize";
import { DAY_LABELS_LONG, CATEGORIES } from "./constants";
import { getWeeklyBudget } from "./app-settings";

const BASE_PROMPT_HEAD = `Du er en hjelpsomme matplanlegger for familien Ellefsen i Lillestrøm, Norge.
Du hjelper med å planlegge middager, generere handlelister og svare på spørsmål om mat og oppskrifter.

Regler for middagsbeskrivelser:
- Beskrivelsen skal beskrive selve retten: ingredienser, tilberedningsmetode og servering
- Hvis retten passer for et familiemedlem UNDER 25 år som kan lage mat selv (cooks_independently), legg til på slutten: "Kan lages av [navn]."
- Familiemedlemmer på 25 år eller eldre nevnes ALDRI som kokk i beskrivelsen — voksne kan lage hva som helst
- ALDRI nevn tilpasninger for enkeltpersoner, hvem som spiser hva, eller spesielle porsjoner i beskrivelsen
- Øvrig familiedata (preferanser, allergier) brukes kun til å velge passende retter — ikke til å skrive i beskrivelsen

Regler for handleliste:
- Én ingrediens = én vare, aldri buntet sammen
- Paprika: ALLTID med farge, standard rød
- Løk: ALLTID med type, standard rødløk
- Ingen parenteser, ingen "eller"-konstruksjoner
- Bruk "stk" for tellbare varer`;

export async function buildSystemPrompt(
  dateFrom?: string,
  dateTo?: string
): Promise<string> {
  const supabase = createServerClient();
  const weeklyBudget = await getWeeklyBudget();

  // ── Shopping categories (dynamic from DB) ────────────────────────────────
  const { data: catRows } = await supabase
    .from("shopping_categories")
    .select("name")
    .eq("active", true)
    .order("sort_order");
  const categoryList =
    catRows && catRows.length > 0
      ? catRows.map((c: { name: string }) => c.name).join(", ")
      : (CATEGORIES as readonly string[]).join(", ");

  const BASE_PROMPT = `${BASE_PROMPT_HEAD}\n- Grupper varer etter kategori: ${categoryList}`;
  const sections: string[] = [BASE_PROMPT];

  // ── Family members ────────────────────────────────────────────────────────
  const { data: members } = await supabase
    .from("family_members")
    .select("*")
    .eq("active", true);

  if (members && members.length > 0) {
    const today = new Date();
    const memberLines = members.map((m) => {
      let line = `- ${m.name} (${m.role})`;
      if (m.birthdate) {
        const birth = new Date(m.birthdate);
        const age =
          today.getFullYear() -
          birth.getFullYear() -
          (today.getMonth() < birth.getMonth() ||
          (today.getMonth() === birth.getMonth() &&
            today.getDate() < birth.getDate())
            ? 1
            : 0);
        line += `, ${age} år`;
        if (age < 3) line += " (mindre porsjoner, enkel mat)";
        else if (age < 10) line += " (barnevennlig mat)";
        else if (age >= 13 && age < 20) line += " (større porsjoner)";
      }
      // Only flag young cooks (<25) — adults are assumed capable of cooking anything
      if (m.cooks_independently && m.birthdate) {
        const birth = new Date(m.birthdate);
        const age =
          today.getFullYear() -
          birth.getFullYear() -
          (today.getMonth() < birth.getMonth() ||
          (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
            ? 1
            : 0);
        if (age < 25) line += " ⭐ KAN LAGE MAT SELV";
      } else if (m.cooks_independently && !m.birthdate) {
        line += " ⭐ KAN LAGE MAT SELV";
      }
      if (m.notes) line += ` — ${m.notes}`;
      return line;
    });
    sections.push(`## Familiemedlemmer\n${memberLines.join("\n")}`);
  }

  // ── Family preferences ────────────────────────────────────────────────────
  const { data: prefs } = await supabase
    .from("family_preferences")
    .select("*")
    .eq("active", true);

  if (prefs && prefs.length > 0) {
    const byCategory: Record<string, string[]> = {};
    for (const p of prefs) {
      const key = p.category;
      if (!byCategory[key]) byCategory[key] = [];
      const who = p.who !== "Familie" ? `${p.who}: ` : "";
      byCategory[key].push(`${who}${p.rule}${p.details ? ` (${p.details})` : ""}`);
    }

    const catLabels: Record<string, string> = {
      dislikes: "Liker ikke",
      never_use: "Aldri bruk",
      prefers: "Foretrekker",
      allergy: "Allergi",
      max_per_week: "Maks per uke",
      min_per_week: "Minst per uke",
      default_choice: "Standard valg",
      cooking_rule: "Matlagingsregel",
    };

    const prefLines = Object.entries(byCategory)
      .map(([cat, rules]) => `### ${catLabels[cat] ?? cat}\n${rules.map((r) => `- ${r}`).join("\n")}`)
      .join("\n\n");

    sections.push(`## Preferanser og regler\n${prefLines}`);
  }

  // ── Meal ratings ──────────────────────────────────────────────────────────
  const { data: ratings } = await supabase
    .from("meal_ratings")
    .select("meal_name, rating, notes");

  if (ratings && ratings.length > 0) {
    const loved = ratings.filter((r) => r.rating === "loved").map((r) => r.meal_name);
    const disliked = ratings.filter((r) => r.rating === "disliked").map((r) => r.meal_name);
    const banned = ratings.filter((r) => r.rating === "never_again").map((r) => r.meal_name);

    const ratingLines: string[] = [];
    if (loved.length) ratingLines.push(`Elsker: ${loved.join(", ")}`);
    if (disliked.length) ratingLines.push(`Liker ikke: ${disliked.join(", ")}`);
    if (banned.length) ratingLines.push(`Aldri igjen: ${banned.join(", ")}`);

    if (ratingLines.length) {
      sections.push(`## Matvanevurderinger\n${ratingLines.join("\n")}`);
    }
  }

  // ── Category overrides — always inject regardless of times_bought ────────
  const { data: overridePatterns } = await supabase
    .from("shopping_patterns")
    .select("item_name, category_override")
    .not("category_override", "is", null);

  if (overridePatterns && overridePatterns.length > 0) {
    const lines = overridePatterns
      .map((p: { item_name: string; category_override: string }) => `- ${p.item_name} → ${p.category_override}`)
      .join("\n");
    sections.push(
      `## Varekategorier (brukerdefinert — aldri overstyr disse)\nDisse varene skal ALLTID plasseres i den angitte kategorien, uansett hva du ellers ville valgt:\n${lines}`
    );
  }

  // ── Shopping patterns (≥3 purchases) ──────────────────────────────────────
  const { data: patterns } = await supabase
    .from("shopping_patterns")
    .select("item_name, avg_quantity, typical_frequency, avg_price, buys_per_month, pattern_source, is_staple, staple_override")
    .gte("times_bought", 3);

  if (patterns && patterns.length > 0) {
    // A true staple is bought regardless of the menu (user override wins over
    // the auto-classification). Only these are force-included; everything else
    // should only appear when a planned meal actually needs it.
    const isStaple = (p: { is_staple: boolean | null; staple_override: boolean | null }) =>
      (p.staple_override ?? p.is_staple) === true;
    const staples = patterns.filter((p) => isStaple(p) && p.avg_quantity);
    const other = patterns.filter((p) => !isStaple(p) && p.avg_quantity);

    if (staples.length > 0) {
      const lines = staples.map((p) => `- ${p.item_name}: ${p.avg_quantity}`).join("\n");
      sections.push(
        `## Faste varer — alltid med i handlelisten\nDette er faste varer familien kjøper uansett hvilke middager som er planlagt (f.eks. melk, brød, pålegg). De skal ALLTID inkluderes i handlelisten:\n${lines}`
      );
    }

    if (other.length > 0) {
      const lines = other.map((p) => `- ${p.item_name}: ${p.avg_quantity}${p.typical_frequency ? ` (${p.typical_frequency})` : ""}`).join("\n");
      sections.push(`## Typiske handlekvantum (kun når en middag krever varen)\nDette er typiske mengder for varer familien kjøper ofte, men som er middagsavhengige. Ta dem KUN med når en planlagt middag faktisk trenger dem — ikke automatisk:\n${lines}`);
    }

    // Receipt-learned habits: real frequency and price from synced receipts
    const receiptLearned = patterns.filter(
      (p) =>
        (p.pattern_source === "receipt" || p.pattern_source === "both") &&
        (p.buys_per_month !== null || p.avg_price !== null)
    );
    if (receiptLearned.length > 0) {
      const lines = receiptLearned
        .sort((a, b) => (b.buys_per_month ?? 0) - (a.buys_per_month ?? 0))
        .slice(0, 40)
        .map((p) => {
          const parts: string[] = [];
          if (p.buys_per_month !== null) parts.push(`kjøpes ~${p.buys_per_month}×/mnd`);
          if (p.avg_price !== null) parts.push(`~${p.avg_price} kr/kjøp`);
          return `- ${p.item_name}: ${parts.join(", ")}`;
        })
        .join("\n");
      sections.push(
        `## Reelle handlevaner (fra kvitteringer)\nDisse tallene er hentet fra familiens faktiske butikkkvitteringer. Bruk dem til å foreslå riktige mengder og realistiske kostnadsestimater (ukesbudsjett: ${weeklyBudget} kr):\n${lines}`
      );
    }
  }

  // ── Recent meals (avoid repetition) ──────────────────────────────────────
  // Look back 5 weeks so we cover the last full month of planning
  const lookbackDate = new Date(dateFrom ? dateFrom + "T12:00:00" : Date.now());
  lookbackDate.setDate(lookbackDate.getDate() - 35);
  const lookbackStr = toLocalDateString(lookbackDate);

  const { data: recentMeals } = await supabase
    .from("meals")
    .select("meal_name, meal_date")
    .gte("meal_date", lookbackStr)
    .lt("meal_date", dateFrom ?? toLocalDateString(new Date()))
    .order("meal_date", { ascending: false });

  if (recentMeals && recentMeals.length > 0) {
    // Deduplicate by name (case-insensitive), keep most recent occurrence (results are desc)
    const seen = new Map<string, { name: string; date: string }>();
    for (const m of recentMeals) {
      const key = m.meal_name.toLowerCase();
      if (!seen.has(key)) seen.set(key, { name: m.meal_name, date: m.meal_date.substring(0, 10) });
    }
    const lines = Array.from(seen.values()).map((m) => `- ${m.name} (${m.date})`);
    sections.push(
      `## Nylige middager — unngå gjentak\nDisse rettene er servert de siste 5 ukene. Ikke gjenta dem og unngå svært like varianter:\n${lines.join("\n")}`
    );
  }

  // ── Birthday detection ────────────────────────────────────────────────────
  if (dateFrom && dateTo && members && members.length > 0) {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);

    for (const m of members) {
      if (!m.birthdate) continue;
      const birth = new Date(m.birthdate);

      // Check each day in range
      const cursor = new Date(from);
      while (cursor <= to) {
        if (
          cursor.getMonth() === birth.getMonth() &&
          cursor.getDate() === birth.getDate()
        ) {
          const dayLabel = DAY_LABELS_LONG[cursor.getDay()];
          const dateStr = `${cursor.getDate()}.${cursor.getMonth() + 1}`;
          sections.push(
            `## 🎂 Bursdag!\n${m.name} har bursdag ${dayLabel} ${dateStr}! Foreslå noe festlig og ekstra godt til den dagen.`
          );
          break;
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }
  }

  return sections.join("\n\n");
}
