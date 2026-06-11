# Store Integration Research & Roadmap

Research notes for fetching a user's own grocery receipts (Trumf/Kiwi first,
Coop/Rema later). Captured 2026-06-11. Read this before changing the store-auth
approach — it records *why* the current design is what it is.

## Current decision (2026-06-11)

**Token paste, personal use only. Productizing is deferred.**

- The app is for the Ellefsen family right now. People have suggested it could be
  a paid product; Gard wants to validate the idea before investing in product-grade
  integration. That validation does NOT require robust multi-user auth.
- Phase 1 (current, implemented): user pastes a Bearer token copied from a
  logged-in trumf.no browser session into Settings → Butikker. Fine on desktop,
  fine for a household. See `SKILL.md` for the implemented pipeline.
- **Hard constraint from Gard:** the app must never handle other users'
  store credentials. Passwords belong in the systems we integrate against.

## Key findings

### Live API confirmed (2026-06-11)
Observed directly in DevTools on trumf.no:
- trumf.no is now a rebuilt site on **Auth.js / NextAuth** — session held in
  encrypted (JWE) `__Secure-authjs.session-token.0/.1` cookies, NOT a readable
  token in storage. So the bearer is NOT findable in Application → Cookies/Storage.
- The data API is unchanged from the old reverse-engineering: requests go to
  `https://platform-rest-prod.ngdata.no/trumf/husstand/...` with header
  `Authorization: Bearer <RS256 JWT>`. Confirmed on `GET /trumf/husstand/saldo`.
- This matches `lib/stores/trumf.ts` (base URL + bearer scheme) — Phase 1 token
  paste is viable as built.
- To grab the token: DevTools → **Network** tab (Fetch/XHR) → load the receipts
  page → click a request to `platform-rest-prod.ngdata.no` → Request Headers →
  copy the full `Authorization` value. (Application/Storage tab is the wrong place.)
- trumf.no is a Next.js App Router / RSC site: the receipts page fetches
  `/transaksjoner` **server-side** and streams an RSC payload to the browser, so
  that call is NOT observable in DevTools. Only `/saldo` is a client-side XHR.
  The `*/fordeler?...&_rsc=` requests are RSC page navigations, not data APIs.
- ENDPOINTS MOVED since the 2018 reverse-engineering: `/trumf/husstand/transaksjoner`
  now returns 404 (with a valid token — auth is fine, path is gone). `/saldo` still
  lives under `/trumf/husstand/`. The receipts API moved to **`/trumf/medlemskap/`**
  (membership): a known live path is
  `GET /trumf/medlemskap/transaksjoner/digitalkvittering/{id}` (receipt detail).
  `lib/stores/trumf.ts` MUST be updated to the new base/paths — current code is stale.
### Live schema confirmed (2026-06-11)
- Transaction LIST: `GET /trumf/medlemskap/transaksjoner` (also accepts
  `?fra=YYYY-MM-DD&til=YYYY-MM-DD`). Returns 200, a JSON **array** of transactions.
  Fields are **camelCase** (old API was lowercase). Per transaction:
  `batchId` (string), `belop` (number, total), `beskrivelse` (store, e.g.
  "KIWI Lillestrøm"), `bonus` (number), `bonusberegningTidspunkt` (date string
  "2026-06-10"), `butikkId`, `harKvittering` (bool — true ⇒ digital receipt
  with line items exists), `kilde`, `kvitteringsId` (string, e.g. "2120034"),
  `medlemId`. (Old→new renames: batchid→batchId, trumftotal→bonus; dato likely
  →bonusberegningTidspunkt.)
  List item fields seen: batchId, belop, beskrivelse, bonus,
  bonusberegningTidspunkt, butikkId, harKvittering (bool), kilde, kvitteringsId,
  medlemId (list is cut off; more may exist).
- Receipt DETAIL: `GET /trumf/medlemskap/transaksjoner/digitalkvittering/{batchId}`
  — confirmed {id} = **batchId** (kvitteringsId 404s). Returns full header + lines.
  14 top-level keys: partnerId, medlemId, butikkId, beskrivelse, batchId,
  kvitteringsId, bonusberegningTidspunkt, belop, bonus, **transaksjonsTidspunkt**
  (the real purchase timestamp — use for purchase_date), totaleBesparelser,
  ordreId, reklamasjonsStatus, **varelinjer** (array of line items).
- LINE ITEM (`varelinjer[]`) confirmed fields, per item:
  - `produktBeskrivelse` — product text, e.g. "REKER FROSNE 70/90" → product_text
  - `antall` — quantity as STRING, e.g. "3.098" → quantity (can be a weight)
  - `enhetsType` — unit, "KG" or "STK" → NEW: store as a unit column
  - `belop` — line total (number) → total_price (unit_price = belop/antall)
  - `besparelser` — array of savings (empty here) → discount (sum amounts)
  - `ukjentVare` (bool) — unknown-item flag
  - `varelinjeGuid` — stable per-line id
  - `varegruppeKategoriGUID` / `produktVaregruppeKategoriGUID` — internal category
    GUIDs (not human-readable categories)
  - bonus / bonusProsent / bonusregler / enhetsBonus / momsProsent / transaksjonType
    / reklamasjonsStatus / reklamasjonsSum — loyalty + tax + POS metadata, IGNORE
  - **NO EAN/barcode field** — product mapping must be text-only on produktBeskrivelse.
- REQUIRED CODE CHANGES (lib/stores/trumf.ts + app/api/receipts/sync + types +
  migration 007): new base `/trumf/medlemskap/`; list→iterate batchIds where
  harKvittering; detail by batchId; map camelCase fields above; add `unit` column
  to receipt_items; set ean=null; purchase_date from transaksjonsTidspunkt.
- Token is a JWT and likely short-lived → token paste will need periodic
  re-pasting; code flips connection status to 'expired' on 401 and prompts re-paste.

### Non-purchase transactions (bonus payouts) — exclude (confirmed 2026-06-11)
The `transaksjoner` list includes bonus withdrawals/redemptions, NOT just purchases.
Example: a bonus payout to bank shows as `partnerId:"NG"`, `beskrivelse:"Bankoverføring"`,
`transaksjonKategori:"CONSUME"`, `transaksjonType:"ZBANK_PAYMENT"`, `bonus:-11400`,
empty `batchId`, `harKvittering:false`. These must NOT count as grocery spend.
- Reliable marker: **`transaksjonKategori === "CONSUME"`** (purchases are "EARN").
- Sync skips these (`isBonusConsumption()` in trumf.ts) so they never become receipts —
  also avoids a unique-key collision (they share an empty batchId).
- Cleanup for already-synced payouts:
  `delete from receipts where store='trumf' and (raw->'transaction'->>'transaksjonKategori')='CONSUME';`

### There is no official third-party receipt API
- NorgesGruppen/Trumf exposes no public partner API for receipt data.
- `oauth.norgesgruppen.no` is NorgesGruppen's own SSO for their own apps
  (Trumf, Kiwi PLUSS) — not a third-party OAuth provider you can register a
  client with. No consent-screen / redirect_uri flow is offered to outsiders.
- The working endpoints (`platform-rest-prod.ngdata.no/trumf/husstand/...`) are
  undocumented/unofficial. Documented in `SKILL.md`. They can change or be
  blocked by any NorgesGruppen app release.

### How Optius (app.optius) actually does it
From their own terms (Heco et al ApS, Danish entity):
- Users "log in directly to their chosen receipt provider with their own
  credentials through secure channels" — i.e. backend credential-based account
  aggregation (the pre-open-banking Plaid model), not an official API.
- Tell-tale clause: "encrypted traffic via **rotating IP connections**,
  especially under many simultaneous requests" → they proxy/rotate IPs to avoid
  being rate-limited/blocked by the stores. This is scraping-at-scale infra.
- They disclaim responsibility for users' compliance with store ToS and lean on
  GDPR framing. They have **no** special API access — same unofficial endpoints,
  industrialised.
- Takeaway: matching Optius means running fragile scraping infra as a core
  business, not bolting on a feature.

### The mobile problem
- Copying a token from browser devtools is desktop-only and a non-starter for
  real mobile users (most of the target audience).
- The only mobile-viable way to get a token without handling passwords: have the
  user log in on Trumf's **own** login page inside an embedded webview in a
  native app, then capture the resulting session token. Password is typed into
  Trumf's page, not ours; we store only the token.
- A pure web app / PWA **cannot** do this — same-origin policy blocks reading
  another origin's tokens. Requires a native wrapper (Capacitor / React Native).
  Gard is willing to add a native wrapper for the product phase.

### Honest security nuance (must be acknowledged in product phase)
- An embedded webview we control *could in principle* observe what the user
  types into Trumf's page. We wouldn't, but the capability exists.
- The only way to make password-snooping *impossible* (not just "we promise") is
  a real OAuth code-redirect flow to a client we registered with Trumf — which
  Trumf does not offer third parties.
- So the webview approach is "clean enough" (password on Trumf's page, token-only
  storage, we choose not to snoop), never "provably clean". This is the same
  tension every account-linking app lives with.

### Durable foundations for a real product (Phase 2+)
- Best: a data-sharing agreement / official access from NorgesGruppen.
- Alternative legal footing: the user's GDPR Article 20 right to export their own
  purchase history. Clunkier UX, but can't be revoked by an app update.
- Either is slower to obtain but removes the "broke overnight / C&D" existential
  risk that the unofficial-endpoint approach carries.

## Phased roadmap

**Phase 1 — now (DONE):** token paste, personal/family use. Don't build
multi-tenant token vaults, refresh daemons, or proxy infra for ~6 users.

**Phase 2 — only if validation says "productize":**
- Native wrapper (Capacitor/RN) + embedded-webview login on Trumf's own page,
  capture session token. No credential handling.
- Encrypted, per-user token storage + expiry detection → re-prompt to re-login
  (session tokens expire; no refresh token available via this path).
- Multi-tenant data model + auth (the app currently has no user auth — RLS is
  public read/write, fine for one family, not for a product).
- Legal review of NorgesGruppen/Coop/Rema ToS; outreach to NorgesGruppen about
  official access; GDPR posture (we become controller/processor).
- Decide on proxy/IP strategy only if scale forces it.

## Open question parked for Gard
- Phase 2 trigger: is the family value real enough, and are enough people asking,
  to justify the native-app + legal investment? Revisit when that's clearer.

## Sources
- Optius terms: https://optius.app/no-NO/terms-of-use
- Trumf SSO entry: https://oauth.norgesgruppen.no/login/trumf
- Unofficial endpoint reference: ttyridal/trumf-data-fetch (BSD-2), and
  HelgeSverre's "Norwegian Grocery Store APIs" gist (Rema/Coop/Trumf).
