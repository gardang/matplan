# Design System

## Principles
- Mobile-first — 90% of usage on phones in kitchen/store
- Generous whitespace, touch-friendly (44px minimum tap targets)
- Subtle animations (150-200ms), Light + dark mode

## Colors (Tailwind)
- Primary action: emerald-600 (#059669)
- Accent/warning: amber-500 (#f59e0b)
- Day colors (pills + card borders): Mon blue-500 · Tue emerald-500 · Wed orange-500 · Thu teal-500 · Fri pink-500 · Sat violet-500 · Sun gray-400
- Backgrounds: white/gray-50 light, gray-900/gray-950 dark
- Cards: white + shadow-sm + rounded-xl light, gray-800 dark
- Text: gray-900 primary, gray-500 secondary, gray-400 tertiary

## Typography
- Font: Inter (Google Fonts), fallback system stack
- Meal names: text-base font-semibold · Body: text-sm · Labels: text-xs
- Category headers: text-xs uppercase tracking-wider text-gray-400 font-medium

## Components
- Cards: rounded-xl, shadow-sm, p-4, 3px left border for day color
- Buttons primary: emerald bg, white text, rounded-lg, py-2 px-4
- Buttons secondary: gray-100 bg, gray-700 text
- Buttons danger: red-50 bg, red-600 text
- Buttons ghost: no bg, gray-500 text, hover:gray-100
- Inputs: rounded-lg, border-gray-200, focus:ring-2 ring-emerald-500, py-2.5 px-3
- Checkboxes: custom emerald accent, rounded, 20x20px
- Tab nav: bottom fixed on mobile (64px, safe-area), Lucide icons (CalendarDays, ShoppingCart, MessageCircle, Settings)
- Toast: rounded-xl shadow-lg, slide from top. Persistent for operations, 4s success, 8s error.

## Loading & Animation
- Skeleton loaders for card lists (not spinners)
- Pulsing dots for AI thinking
- Transitions: fade-in 200ms, checkbox bounce 150ms, tab fade 150ms, panel expand 200ms

## Responsive
- Mobile <640px: single column, bottom nav
- Tablet 640-1024px: wider cards, single column
- Desktop >1024px: max-w-2xl centered, top nav

## Do NOT
- Use default browser checkbox/radio/select styles
- Use inline styles (Tailwind only)
- Have elements without rounded corners (min rounded-md)
- Show raw JSON or technical errors to user
