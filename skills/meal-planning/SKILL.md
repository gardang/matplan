# Skill: Meal Planning

## What
AI meal generation, meal cards, editing, swapping, rating, birthday meals, and recipe discovery.

## When To Load
- Working on the meal plan page or MealCard/EditPanel components
- Modifying how meals are generated or displayed
- Working on ratings, swapping, or birthday detection
- Changing AI prompts for meal suggestions

## Requires
- `_context/schema.md` — meals, meal_ratings, family_members tables (data is in Supabase)
- `_context/schema.md` — meals, meal_ratings, family_members tables
- `_context/design-system.md` — card styling, day colors

## Key Patterns

### Flexible Date Range
Not fixed to Monday-Sunday. Users pick any from/to dates (5, 7, 8, 10 days).
Default: today → today+6. The AI prompt must explicitly list every day and count them.

### AI Generation Prompt
```
Du skal planlegge middager for NØYAKTIG {count} dager (ikke 7 — {count}!).

1. {dayLabel(day1)} → TRENGER MIDDAG
2. {dayLabel(day2)} → ALLEREDE PLANLAGT: Taco
...

Returner BÅDE meals OG items. Bruk web_search for oppskriftslenker.
```
- List all days numbered with exact labels
- Mark already-planned days as ALLEREDE PLANLAGT
- Request combined meals + shopping in one JSON response
- AI uses web_search to find real recipe URLs

### Day Matching
Match AI's day labels to actual dates. Priority:
1. Both day name AND date number match → exact
2. Date number alone matches → use it
3. Day name matches AND only one occurrence → use it
4. No match → assign to next empty day

### Meal Swap
"Flytt" button on a card → highlights card, other days show "flytt hit" target.
Click target → swap the two meals' dates + update shopping_items for_day.
Pure data operation, no AI call. Instant.

### EditPanel
Inline below the meal card (not a modal). Two modes:
- **Skriv selv**: name + description + source fields. Live RecipeLink preview.
- **Forslag fra AI**: optional ingredient input + "Foreslå" button → AI returns 3-4 suggestions with web search. Each shows name, description, extra ingredients needed, recipe link. Click to select → fills "Skriv selv" fields.

### Recipe Links
- If URL starts with "http" → direct link, show domain name
- If just a site name → fallback search URL (site/sok/?q=name)
- Fallback search URLs defined in RECIPE_SITES constant

### Meal Ratings
After a meal's date has passed, show rating buttons on the card:
- 👍 loved · 👌 ok · 👎 disliked · 🚫 aldri igjen
- Upsert into meal_ratings by meal_name
- Ratings feed into the dynamic system prompt

### Birthday Detection
buildSystemPrompt checks if any family_members.birthdate falls in the date range.
If yes, prompt includes: "🎂 {Name} har bursdag {date}! Foreslå noe festlig."

## Files Involved
- `components/MealCard.tsx` — day card with meal info + action buttons
- `components/EditPanel.tsx` — inline editor with manual + AI suggestion modes
- `components/MealRating.tsx` — rating buttons
- `components/RecipeLink.tsx` — smart recipe link
- `app/plan/page.tsx` — the meal plan page
- `app/api/meals/route.ts` — CRUD + AI generation
- `app/api/meals/swap/route.ts` — meal swapping
- `app/api/ratings/route.ts` — rating CRUD
- `lib/system-prompt.ts` — birthday detection + prompt building
