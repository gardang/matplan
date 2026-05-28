// Dynamic system prompt builder — reads family data from Supabase at request time
// Rules: skills/claude-api/SKILL.md

import { createServerClient } from "./supabase-server";
import { toLocalDateString } from "./normalize";
import { DAY_LABELS_LONG } from "./constants";

const BASE_PROMPT = `Du er en hjelpsomme matplanlegger for familien Ellefsen i Lillestrøm, Norge.
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
- Bruk "stk" for tellbare varer
- Grupper varer etter kategori: Grønnsaker og frukt, Kjøtt og fisk, Meieri og egg, Brød og bakevarer, Tørrvarer, Frysevarer, Krydder og sauser, Hermetikk, Drikke, Snacks og godteri, Rengjøring, Annet`;

export async function buildSystemPrompt(
  dateFrom?: string,
  dateTo?: string
): Promise<string> {
  const supabase = createServerClient();
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

  // ── Shopping patterns (≥3 purchases) ──────────────────────────────────────
  const { data: patterns } = await supabase
    .from("shopping_patterns")
    .select("item_name, avg_quantity, typical_frequency")
    .gte("times_bought", 3);

  if (patterns && patterns.length > 0) {
    const patternLines = patterns
      .filter((p) => p.avg_quantity)
      .map((p) => `- ${p.item_name}: ${p.avg_quantity}${p.typical_frequency ? ` (${p.typical_frequency})` : ""}`);

    if (patternLines.length) {
      sections.push(`## Typiske handlekvantumet\n${patternLines.join("\n")}`);
    }
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
