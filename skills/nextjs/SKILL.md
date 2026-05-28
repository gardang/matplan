# Skill: Next.js

## What
App Router patterns, server vs client components, API routes, layouts, and navigation.

## When To Load
- Creating or modifying pages (`app/*/page.tsx`)
- Creating or modifying API routes (`app/api/*/route.ts`)
- Working on layout, navigation, or routing
- Adding new pages or restructuring existing ones

## Requires
- `_context/conventions.md` — naming and file organization

## Key Patterns

### Server vs Client
- Default to server components. Only add `"use client"` when the component needs useState, useEffect, event handlers, or browser APIs.
- Pages that fetch data on load: server component with async function.
- Pages with interactive UI (forms, toggles, real-time): client component.

### API Routes
- All in `app/api/[name]/route.ts`
- Export named functions: GET, POST, PUT, DELETE
- Always return `NextResponse.json()`
- Error handling: try/catch, return appropriate HTTP status
- Never import browser-only code
- Environment variables: `process.env.ANTHROPIC_API_KEY` (no NEXT_PUBLIC_ prefix for secrets)

### Data Fetching from Client
- Use `fetch('/api/...')` from client components
- Or use Supabase client directly for simple CRUD (see supabase skill)

### Layout
- `app/layout.tsx`: font, meta tags, PWA manifest link, TabNav component
- TabNav: bottom on mobile (<640px), top on desktop
- Each tab is a separate page route: /plan, /shopping, /chat, /settings

### Date Handling
- NEVER use `toISOString()` — it converts to UTC and shifts dates in CET/CEST
- Use: `getFullYear()`, `getMonth()`, `getDate()` for local date strings
- Default date range: today → today+6

## Files Involved
- `app/layout.tsx`, `app/page.tsx`
- `app/plan/page.tsx`, `app/shopping/page.tsx`, `app/chat/page.tsx`, `app/settings/page.tsx`
- `app/api/*/route.ts`
