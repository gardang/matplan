# Skill: Receipt Learning

## What
Fetching real store receipts (Trumf/Coop/Rema), storing them, mapping raw product
texts to clean item names, and aggregating into shopping_patterns + insights.

## When To Load
- Working on receipt sync, store connections, or the Innsikt page
- Modifying product name mapping or pattern aggregation
- Adding a new store integration (Coop, Rema)

## Requires
- `_context/schema.md` — store_connections, receipts, receipt_items, product_mappings
- `_context/normalize.md` — item name conventions (paprika/løk rules apply to mappings too)

## Architecture

```
store APIs → /api/receipts/sync → receipts + receipt_items (raw)
                                       ↓ mapUnknownProducts (cache → AI batch)
                                  product_mappings + receipt_items.normalized_name
                                       ↓ updatePatternsFromReceipts
                                  shopping_patterns (frequency, qty, price)
                                       ↓
                          buildSystemPrompt "Reelle handlevaner" + /api/insights
```

## Store APIs (unofficial, reverse-engineered)

### Trumf (Kiwi, Meny, Spar, Joker) — IMPLEMENTED
- Base: `https://platform-rest-prod.ngdata.no/trumf/husstand`
- `GET /transaksjoner?felter=...&fra=YYYY-MM-DD&til=YYYY-MM-DD&format=crm`
- `GET /transaksjoner/detaljer/{batchid}` → `varelinjer[]`: vareTekst, ean, antall, belop
- Auth: Bearer token pasted from logged-in trumf.no browser session (F12 → Network → Authorization header). Expires after a while → status 'expired', user pastes a new one.
- History: 12 months back.

### Coop (Obs) — PLANNED
- Base: `https://api.coop.no`, auth: OpenID Connect via Auth0 at login.coop.no
- See HelgeSverre's gist "Norwegian Grocery Store APIs" for the OpenAPI spec.

### Rema (Æ) — PLANNED
- Base: `https://api.rema.no`, OAuth2+PKCE via id.rema.no/authorization + /token
- Same gist has the spec, incl. hardcoded subscription key header.

## Key Rules
- Sync is idempotent: unique (store, external_id), overlap window is safe
- `raw` JSONB keeps the original payload so items can be reprocessed
- product_mappings: manual mappings (source='manual') always win over AI
- AI mapping: batches of 60 texts, follows normalize rules (paprika med farge, etc.)
- Patterns: frequency from avg interval between unique purchase dates;
  buys_per_month needs ≥2 purchases; pattern_source app→both when receipts confirm
- Tokens live in store_connections.access_token — never returned by GET /api/settings/connections

## Files Involved
- `lib/stores/trumf.ts` — Trumf API client
- `lib/receipt-learning.ts` — mapping + aggregation
- `app/api/receipts/sync/route.ts` — sync orchestration
- `app/api/settings/connections/route.ts` — token management
- `app/api/insights/route.ts` — dashboard aggregates
- `app/innsikt/page.tsx` — Innsikt page
- `components/StoreConnections.tsx` — Settings → Butikker panel
