# Ideas / Backlog

Single home for things to explore or build later in Matplan. Not a spec — a
running list of what's been discussed but not (yet) done.

**For the AI:** when Gard says "add … to ideas" / "put that on the list", append
it here under the right heading (create a heading if none fits). When he asks
"what ideas are on the plan" / "what's next", read this file and summarize.
Keep deep technical research in its own docs and link to it from here.

Status tags: `(idea)` not yet committed · `(planned)` agreed, not built ·
`(deferred)` consciously postponed. Move items to a short "Done" note or delete
them once shipped.

**Related docs (deep detail behind some items below):**
- `skills/receipts/store-integration-research.md` — Trumf/Coop/Rema API research,
  confirmed live schema, productization roadmap, budget-enforcement design notes.
- `skills/receipts/SKILL.md` — how the receipt sync + learning pipeline works.

---

## Budget

- **Real budget enforcement** `(deferred)` — today the weekly budget is only an
  advisory hint in the meal-generator prompt + a retrospective view in Innsikt;
  nothing prices a planned week. Now that receipts give real per-item prices:
  tag shopping-list items with estimated price from `shopping_patterns.avg_price`,
  show a live "estimert total ~X / budsjett Y" on the shopping page with an
  over-budget flag + biggest cost drivers, and optionally feed the estimate back
  to the generator so it trades items down. See
  `skills/receipts/store-integration-research.md` → Deferred ideas.
- **Always-on budget line in the system prompt** `(idea)` — add an unconditional
  "## Ukesbudsjett: ca X kr" line in `buildSystemPrompt` from `getWeeklyBudget()`
  so the AI always knows the target (currently it only sees it via the receipt
  section). Cheap; makes the AI aware but not enforcing.

## Receipts & store integrations

- **Backfill older receipts on demand** `(idea)` — a "fetch last 12 months" /
  date-range action in Butikker (the incremental sync deliberately won't reach
  back). Idempotent, so safe.
- **Receipt date range + count in Butikker** `(idea)` — show earliest–latest
  receipt date and total count per store.
- **Friendly chain names** `(idea)` — map raw `partnerId` codes to display names
  (JOK→Joker, NG→NorgesGruppen, …) in Innsikt, fallback to the raw code.
- **Manual product-mapping correction UI** `(idea)` — Settings UI to edit
  `product_mappings` (raw receipt text → clean item name + category). Manual
  entries already override the AI mapping (`source='manual'`); this is the
  missing UI to fix a mis-mapped item once so it sticks. Main lever for going
  from "decent" to "accurate" auto-lists.
- **Coop (Obs) integration** `(idea)` — Auth0/OIDC + api.coop.no. Spec in the
  research doc.
- **Rema (Æ) integration** `(idea)` — OAuth2+PKCE + api.rema.no. Spec in the
  research doc.

## Learning / patterns

- **Reconcile app-checkout vs receipt learning** `(idea)` — two paths write
  `shopping_patterns`: "handletur ferdig" increments `times_bought` per checkout,
  and receipt sync recomputes from `receipt_items`. They use `max()` so nothing
  doubles, but they overwrite each other's `avg_quantity`/`last_bought` and aren't
  cleanly merged. Make receipts the source of truth for frequency/quantity/price;
  demote checkout learning to a fallback for items with no receipt history.

## Productization (only if turning this into a product)

- **Phase 2 roadmap** `(deferred)` — native wrapper (Capacitor/RN) + in-app
  webview login (no credential handling), encrypted per-user token storage +
  expiry/refresh, multi-tenant auth (app currently has none), legal review of
  store ToS, and outreach to NorgesGruppen about official data access. Full
  detail in `skills/receipts/store-integration-research.md`.

---

## Done (recent)

- Trumf receipt sync (Kiwi/Meny/Spar/Joker), learning pipeline, Innsikt dashboard
  with year selector, persistent sync status, bonus-payout exclusion, structured
  weekly-budget setting. (2026-06-11)
- Staple vs menu-driven distinction: `is_staple`/`staple_override` on
  shopping_patterns, auto-classified by weekly penetration + category, only true
  staples force-included in lists, toggle in Settings → Faste varer. (2026-06-11)
