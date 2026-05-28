# Skill: Shopping Logic

## What
Shopping list generation, item normalization, merging duplicates, regeneration, inline editing, and pattern learning.

## When To Load
- Working on the shopping list page or ShopItem component
- Modifying how items are generated, merged, or displayed
- Working on the regeneration or learning endpoints
- Fixing duplicate or normalization issues

## Requires
- `_context/normalize.md` — all normalization and merge rules
- `_context/schema.md` — shopping_items and shopping_patterns tables
- `_context/schema.md` — shopping_items and shopping_patterns tables (staples and categories are in lib/constants.ts)

## Key Patterns

### Display Pipeline
Raw DB items → normalizeItemName → group by category → sort by sortKey → merge duplicates by normalized name → combine quantities with mergeQuantities → render with day pills

### Merged Item Structure
```typescript
interface MergedItem {
  name: string;          // Normalized display name
  displayQty: string;    // Combined quantity (e.g. "5 stk")
  forDays: string[];     // All dates this item is needed, sorted chronologically
  ids: string[];         // All underlying DB item IDs
  checkedArr: boolean[]; // Checked state of each underlying item
  edited: boolean;       // True if any underlying item was manually edited
}
```

### Check/Uncheck
Toggle ALL underlying items at once: if all checked → uncheck all, otherwise → check all.

### Inline Edit
Click item text → qty input + name input + OK/cancel buttons.
Container-level blur (not per-input) so clicking between fields doesn't save.
On save: set `is_auto=false, is_edited=true` on all underlying items. This protects them from regeneration.

### Regeneration (when meals change)
1. Keep all items where `is_auto=false` (manual adds, staples, edited items)
2. Remove all items where `is_auto=true AND is_edited=false`
3. Call AI to generate new items from current meals
4. Deduplicate new items against kept items using normalized names
5. Insert remaining new items

### Staples Button
Add items from the STAPLES constant. Skip any that already exist (by normalized name). Mark as `is_staple=true, is_auto=false`.

### Shopping Complete (learning)
When user taps "Handlingen ferdig":
1. For each checked item → upsert into shopping_patterns
2. Increment times_bought, update last_bought, recalculate avg_quantity
3. Clear checked items from the list
4. Patterns feed into the dynamic system prompt after 3+ purchases

### Day Pills
Each pill shows short day label, color-coded per day-of-week. Clickable → opens the recipe URL for that day's meal. Use `e.stopPropagation()` to avoid triggering checkbox.

## Files Involved
- `components/ShopItem.tsx` — the main shopping item component
- `components/DayPill.tsx` — clickable day badge
- `lib/normalize.ts` — all normalization functions
- `lib/constants.ts` — STAPLES, CATEGORIES
- `app/shopping/page.tsx` — the page that composes everything
- `app/api/shopping/route.ts` — CRUD
- `app/api/shopping/regenerate/route.ts` — regeneration
- `app/api/shopping/complete/route.ts` — learning
