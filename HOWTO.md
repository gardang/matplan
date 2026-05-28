# How To Use This Workspace

## The Idea

This folder structure is Claude Code's "brain" for the Matplan project. Every time you open Claude Code in this folder, it reads `CLAUDE.md` and knows what the project is, where everything lives, and what rules to follow. You never need to re-explain the project.

The `_context/` files are stable reference material — the family, the database, the design. They rarely change.

The `skills/` files are domain expertise — how to build components, how to call the AI, how to handle shopping lists. Claude Code loads the right skill based on what you're asking it to do.

## Daily Workflow

```
1. Open terminal in the project folder
2. Run: claude
3. Ask for what you want in plain language
4. Claude Code reads CLAUDE.md → picks the right skill → loads the right context → does the work
5. Review the changes
6. Test: npm run dev
7. Commit: git add . && git commit -m "description" && git push
8. Vercel auto-deploys
```

## How To Ask For Things

You don't need to reference files or skills — Claude Code figures that out from CLAUDE.md. Just describe what you want:

**Adding a feature:**
> "Add a button on each meal card that lets me mark it as a favorite"

Claude Code reads CLAUDE.md → loads `skills/meal-planning/` → loads `_context/schema.md` and `_context/design-system.md` → builds it.

**Fixing a bug:**
> "The shopping list shows duplicate paprika entries — one says Paprika and one says Rød paprika"

Claude Code → loads `skills/shopping-logic/` → loads `_context/normalize.md` → fixes the normalization.

**Changing the design:**
> "Make the tab bar icons bigger and add labels underneath"

Claude Code → loads `skills/tailwind-ui/` → loads `_context/design-system.md` → updates the component.

**Updating family info:**
> "Amund now likes cooked paprika. Remove that preference."

Claude Code → loads `skills/supabase/` → loads `_context/schema.md` → updates the preference in Supabase (or tells you to do it in the Settings UI).

## Keeping Context Files Updated

The `_context/` files describe HOW the system works, not WHAT data is in it. You only update them when the architecture changes:

- New database table → edit `_context/schema.md`
- New color or component pattern → edit `_context/design-system.md`
- New normalization rule → edit `_context/normalize.md`
- New code convention → edit `_context/conventions.md`

You do NOT need to update context files when:
- Family members change (managed in app → Supabase)
- Preferences change (managed in app → Supabase)
- Meal ratings change (managed in app → Supabase)
- Shopping patterns evolve (learned automatically)

## Adding New Skills

When you add a capability that doesn't fit an existing skill:

1. Create `skills/new-skill-name/SKILL.md`
2. Follow the same format: What, When To Load, Requires, Key Patterns, Files Involved
3. Add it to the folder map in `CLAUDE.md`

Example: if you later add Oda.no integration, create `skills/oda-integration/SKILL.md`.

## What NOT To Do

- Don't paste the entire project spec into every conversation — that's what this folder system replaces
- Don't manually tell Claude Code which files to read — it figures that out from CLAUDE.md and the skills
- Don't edit `CLAUDE.md` frequently — it should be stable. Put changing info in `_context/` files
- Don't put actual code in `_context/` or `skills/` — those are reference and knowledge, not source code
