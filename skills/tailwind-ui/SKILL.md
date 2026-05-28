# Skill: Tailwind UI

## What
Component styling, responsive layout, dark mode, animations, and visual patterns.

## When To Load
- Creating or styling any component
- Fixing visual issues
- Adding animations or transitions
- Working on responsive behavior or dark mode

## Requires
- `_context/design-system.md` — all visual rules

## Key Patterns

### Component Template
```tsx
interface Props { /* typed props */ }

export function ComponentName({ prop1, prop2 }: Props) {
  return (
    <div className="rounded-xl bg-white shadow-sm p-4 dark:bg-gray-800">
      {/* content */}
    </div>
  );
}
```

### Dark Mode
- Use `dark:` prefix on every color class
- Test both modes during development
- Common pairs: bg-white/dark:bg-gray-800, text-gray-900/dark:text-gray-100, border-gray-200/dark:border-gray-700

### Responsive
- Mobile-first: write base styles for mobile, add `sm:` `md:` `lg:` for larger
- Bottom nav: `fixed bottom-0 w-full h-16 pb-safe` (safe area for iPhone)
- Desktop nav: `lg:relative lg:top-0`

### Animations (CSS transitions via Tailwind)
- Card appear: `animate-in fade-in slide-in-from-bottom-2 duration-200`
- Or use transition classes: `transition-all duration-200`
- Checkbox: `transition-transform duration-150 active:scale-95`
- Panel expand: use conditional height with `overflow-hidden transition-[max-height] duration-200`

### Loading States
- Skeleton: `animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg h-20`
- AI thinking dots: three 5px circles with staggered `animate-bounce`
- Button loading: swap text for spinner, add `opacity-75 cursor-wait`

### Custom Checkbox
```tsx
<label className="flex items-center gap-3 cursor-pointer">
  <input type="checkbox" className="sr-only peer" checked={checked} onChange={onToggle} />
  <div className="w-5 h-5 rounded border-2 border-gray-300 peer-checked:bg-emerald-600 peer-checked:border-emerald-600 flex items-center justify-center transition-colors">
    {checked && <Check className="w-3 h-3 text-white" />}
  </div>
  <span>{label}</span>
</label>
```

### Touch Targets
- Minimum 44px on all interactive elements
- Use `p-3` or `min-h-[44px]` to ensure size
- Shopping list items: checkbox area extends full height of row

## Files Involved
- All files in `components/`
- `app/layout.tsx` — font, global styles
- `tailwind.config.ts` — custom colors if needed
