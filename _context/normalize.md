# Normalization & Sorting

## normalizeItemName(name)
1. Remove parenthetical qualifiers, keep first option
2. Paprika: /gul/→"Gul paprika", /grønn/→"Grønn paprika", default→"Rød paprika"
3. Løk: bare "Løk"→"Rødløk"
4. Salat: bare "Salat" or "Salat (isbergsalat)"→"Isbergsalat"
5. Strip "fersk"/"tørket" qualifiers and "eller" constructs
6. Strip "potte" unit from names
7. Capitalize first letter

## normalizeQuantity(q)
- "nett"→replace count with 3, unit with "stk"
- "potte"→replace with "stk"

## mergeQuantities(quantities[])
- Single→as-is · Same unit→sum numbers · Different units→sum numbers, most common unit

## sortKey(name) — groups variants together
- Gul/Rød/Grønn paprika → "paprika gul/rød/grønn"
- Rødløk/Gul løk/Vårløk → "løk rød/gul/vår"
- Tomat* → "tomat ..." · Salat* → "salat ..."
- Everything else → lowercase name

## Shopping List Display
Group by category → sort by sortKey within category → merge duplicates by normalized name → show combined qty + all day pills

## Regeneration Rules
- is_auto=true AND is_edited=false → REPLACED
- is_auto=false OR is_edited=true → KEPT always
- Dedup uses normalized names

## Recipe URL Resolution
1. AI web_search tool returns web_search_tool_result blocks with real URLs
2. matchUrlToRecipe: score URLs by word overlap with recipe name + recipe site bonus
3. Fallback: site search URLs (matprat.no/sok/?q=, godt.no/sok?q=, etc.)

## AI Prompt Rules for Shopping Items
- One ingredient = one item, never bundled
- Paprika: ALWAYS color, default rød · Løk: ALWAYS type, default rødløk
- No parentheses, no "eller" · Use "stk" for countable items
