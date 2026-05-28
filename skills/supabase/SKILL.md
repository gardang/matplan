# Skill: Supabase

## What
Database queries, real-time subscriptions, client setup, and data patterns.

## When To Load
- Creating or modifying database queries
- Setting up real-time subscriptions
- Adding new tables or modifying schema
- Working on the learning system (shopping_patterns)

## Requires
- `_context/schema.md` — table definitions
- `_context/conventions.md` — naming

## Key Patterns

### Two Clients
- `lib/supabase.ts` — browser client using `NEXT_PUBLIC_` env vars. Used in client components and real-time.
- `lib/supabase-server.ts` — server client. Used in API routes. Same env vars work but keeps imports clean.

### Queries
```typescript
// Fetch
const { data, error } = await supabase.from('meals').select('*').eq('plan_id', planId);

// Insert
const { data, error } = await supabase.from('meals').insert({ meal_date, meal_name, plan_id });

// Update
const { error } = await supabase.from('shopping_items').update({ checked: true }).eq('id', itemId);

// Upsert (for ratings — unique on meal name)
const { error } = await supabase.from('meal_ratings').upsert({ meal_name, rating }, { onConflict: 'meal_name' });

// Delete
const { error } = await supabase.from('meals').delete().eq('id', mealId);
```

### Real-Time
Used on shopping_items and meals so changes sync across family phones:
```typescript
const channel = supabase.channel('shopping').on(
  'postgres_changes', { event: '*', schema: 'public', table: 'shopping_items', filter: `plan_id=eq.${planId}` },
  (payload) => { /* update local state */ }
).subscribe();
// Cleanup: channel.unsubscribe()
```

### Meal Swap Transaction
Swap two meals' dates + update shopping_items for_day. Use two updates in sequence (Supabase doesn't have client-side transactions, but the swap is two atomic updates):
1. Swap meal_date on both meal rows
2. Update shopping_items: for_day dateA→temp, dateB→dateA, temp→dateB

### Shopping Pattern Learning
When shopping is "completed" (user taps "Handlingen ferdig"):
- For each checked item: upsert into shopping_patterns
- Increment times_bought, update last_bought
- Frequency: <8 days between purchases→weekly, 8-16→biweekly, 17-35→monthly, >35→occasional
- Items with times_bought ≥ 3 are included in the dynamic system prompt

## Files Involved
- `lib/supabase.ts`, `lib/supabase-server.ts`
- All API routes in `app/api/`
- Real-time subscriptions in `app/plan/page.tsx` and `app/shopping/page.tsx`
