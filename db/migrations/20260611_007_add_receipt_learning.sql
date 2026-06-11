-- Receipt learning: store connections, receipts, line items, product mappings
-- Source for learning shopping habits (frequency, quantity, price) from real
-- store receipts (Trumf/Kiwi first, Coop and Rema later).

-- ── store_connections ────────────────────────────────────────────────────────
-- One row per store integration. Token is pasted by the user from a logged-in
-- browser session (trumf.no) until a full login flow exists.
create table if not exists store_connections (
  id uuid primary key default gen_random_uuid(),
  store text not null unique check (store in ('trumf', 'coop', 'rema')),
  access_token text,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  status text not null default 'disconnected'
    check (status in ('connected', 'expired', 'error', 'disconnected')),
  status_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── receipts ─────────────────────────────────────────────────────────────────
create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  store text not null check (store in ('trumf', 'coop', 'rema')),
  external_id text not null,
  chain text,
  store_name text,
  purchase_date date not null,
  total_amount numeric(10,2),
  bonus_amount numeric(10,2),
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (store, external_id)
);

create index if not exists idx_receipts_purchase_date on receipts (purchase_date desc);
create index if not exists idx_receipts_chain on receipts (chain);

-- ── receipt_items ────────────────────────────────────────────────────────────
create table if not exists receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts(id) on delete cascade,
  ean text,
  product_text text not null,
  normalized_name text,
  quantity numeric(10,3) not null default 1,
  total_price numeric(10,2),
  unit_price numeric(10,2),
  discount numeric(10,2),
  created_at timestamptz not null default now()
);

create index if not exists idx_receipt_items_receipt on receipt_items (receipt_id);
create index if not exists idx_receipt_items_ean on receipt_items (ean);
create index if not exists idx_receipt_items_normalized on receipt_items (lower(normalized_name));

-- ── product_mappings ─────────────────────────────────────────────────────────
-- Maps raw receipt product texts/EANs to clean app item names.
-- Built up over time: AI maps unknown texts, user can correct via Settings.
create table if not exists product_mappings (
  id uuid primary key default gen_random_uuid(),
  ean text,
  match_text text not null,
  item_name text not null,
  category text,
  source text not null default 'ai' check (source in ('ai', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_product_mappings_match_text
  on product_mappings (lower(match_text));
create index if not exists idx_product_mappings_ean on product_mappings (ean);

-- ── shopping_patterns: price + source columns ───────────────────────────────
alter table shopping_patterns add column if not exists avg_price numeric(10,2);
alter table shopping_patterns add column if not exists last_price numeric(10,2);
alter table shopping_patterns add column if not exists buys_per_month numeric(6,2);
alter table shopping_patterns add column if not exists pattern_source text
  default 'app' check (pattern_source in ('app', 'receipt', 'both'));
