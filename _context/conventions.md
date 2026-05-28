# Conventions

## Code
- TypeScript strict mode, no `any` types
- Server components by default, `"use client"` only where state/interactivity needed
- Tailwind CSS exclusively — no inline styles, no CSS modules
- All Supabase queries through shared client in `lib/supabase.ts`
- All Claude API calls through server-side API routes
- Norwegian locale (`nb-NO`) for dates, sorting, UI text
- English for code, comments, variable names, file names

## Naming
- Files: kebab-case (`meal-card.tsx`, `system-prompt.ts`)
- Components: PascalCase (`MealCard`, `ShopItem`)
- Functions/variables: camelCase (`buildSystemPrompt`, `normalizeItemName`)
- Database columns: snake_case (`meal_name`, `for_day`, `is_auto`)
- API routes: kebab-case paths (`/api/meals`, `/api/shopping/regenerate`)

## File Organization
- `lib/` — shared utilities, types, clients. No React here.
- `components/` — reusable UI. One component per file. Props interface in same file.
- `app/` — pages and API routes only. Page-specific logic stays in the page.
- `_context/` — reference docs for Claude Code. Not deployed.
- `skills/` — domain knowledge for Claude Code. Not deployed.

## Git
- Commit after each meaningful change
- Commit message: imperative mood, lowercase (`add meal rating buttons`, `fix paprika normalization`)
- Never commit `.env.local`
- Never commit `node_modules/`
