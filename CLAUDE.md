# Matplan

Family meal planner and shopping list app for the Ellefsen family, Lillestrøm, Norway.
Built with Next.js 14, TypeScript, Tailwind CSS, Supabase, and Claude API.

## Folder Map

```
CLAUDE.md          ← You are here. Read this first, every time.
_context/          ← HOW the system works. Stable architecture and rules.
  conventions.md      Code standards, naming, file organization
  design-system.md    Visual rules: colors, typography, components, responsive
  schema.md           Database table structure (not the data — that's in Supabase)
  normalize.md        Item name normalization, sorting, merging logic
skills/            ← Domain knowledge. Load the skill that matches the task.
  nextjs/             App Router, server/client components, API routes
  supabase/           Queries, real-time, RLS, database patterns
  claude-api/         Claude calls, web search, prompt building, JSON parsing
  tailwind-ui/        Component styling, responsive, dark mode, animations
  shopping-logic/     List generation, merging, regeneration, learning
  meal-planning/      AI meal generation, ratings, swapping, birthday detection
db/                ← Database artifacts
  migrations/         One SQL file per schema change — NEVER skip this
  supabase-setup.sql  Full setup script for new projects (regenerated from migrations)
app/               ← Next.js pages and API routes
components/        ← React components
lib/               ← Shared utilities, types, clients, constants, system prompt
public/            ← Static assets, PWA manifest, icons
```

## Important: Data vs Structure

All family data (members, preferences, meal ratings, shopping patterns, staples) lives in Supabase and is managed through the app's Settings UI. It is NOT in these files. The `_context/` files describe table STRUCTURE and business LOGIC — not the actual data. The `buildSystemPrompt()` function in `lib/system-prompt.ts` reads all family data from the database at request time.

## Routing Rules

1. Always read this file first
2. Determine what KIND of work is being asked for
3. Load the matching skill from `skills/`
4. Load only the `_context/` files listed in that skill's "Requires" section
5. Do the work

## Global Rules

- Norwegian UI text, English code and comments
- TypeScript strict mode, no `any`
- Tailwind CSS only — no inline styles, no CSS modules
- Never expose API keys to the client — all AI calls through server API routes
- Never use `toISOString()` for dates — use `getFullYear()`, `getMonth()`, `getDate()`
- Claude API: always `max_tokens: 8000`, model `claude-sonnet-4-6`
- Read `_context/conventions.md` for naming and code standards

## Database Migration Rule

**Every schema change MUST be accompanied by a migration file. No exceptions.**

- Location: `db/migrations/`
- Naming: `YYYYMMDD_NNN_short_description.sql` (e.g. `20260602_003_add_meals_rating_column.sql`)
- NNN is a zero-padded sequence number — increment from the last file in the folder
- Each file must be idempotent: use `if not exists`, `if exists`, `on conflict do nothing`
- After creating a migration, also update `_context/schema.md` to reflect the change
- Also update `db/supabase-setup.sql` to keep it in sync with the full schema

This applies to: new tables, new columns, dropped columns, new indexes, constraint changes, seed data changes.
