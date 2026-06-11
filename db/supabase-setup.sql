-- ============================================================
-- Matplan — Supabase setup script
-- Run this in the Supabase SQL editor for a new project.
-- Generated from actual production schema (2026-06-02).
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "pgcrypto";


-- ── Tables ───────────────────────────────────────────────────

create table if not exists meal_plans (
  id          uuid primary key default gen_random_uuid(),
  date_from   date not null,
  date_to     date not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (date_from, date_to)
);

create table if not exists meals (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid references meal_plans(id) on delete cascade,  -- nullable (orphan-safe)
  meal_date      date not null,
  meal_name      text not null,
  description    text default '',
  recipe_url     text default '',
  recipe_source  text default '',
  notes          text default '',
  ai_recipe      jsonb,                                             -- AI-generated recipe (recipe_mode=ai)
  created_at     timestamptz default now()
);

create table if not exists shopping_items (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid references meal_plans(id) on delete cascade,    -- nullable (orphan-safe)
  item_name   text not null,
  quantity    text default '',
  category    text not null default 'Annet',
  checked     boolean default false,
  is_auto     boolean default true,
  is_edited   boolean default false,
  is_staple   boolean default false,
  for_day     date,
  notes       text default '',
  created_at  timestamptz default now()
);

create table if not exists family_members (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  role                text not null default 'barn' check (role in ('far', 'mor', 'barn')),
  birthdate           date not null,
  cooks_independently boolean default false,
  notes               text default '',
  active              boolean default true,
  created_at          timestamptz default now()
);

create table if not exists family_preferences (
  id         uuid primary key default gen_random_uuid(),
  who        text not null default 'Familie',
  category   text not null check (category in (
               'dislikes', 'never_use', 'prefers', 'allergy',
               'max_per_week', 'min_per_week', 'default_choice', 'cooking_rule'
             )),
  rule       text not null,
  details    text default '',
  active     boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists meal_ratings (
  id          uuid primary key default gen_random_uuid(),
  meal_name   text not null,
  rating      text not null check (rating in ('loved', 'ok', 'disliked', 'never_again')),
  rated_by    text default 'Familie',
  notes       text default '',
  recipe_url  text default '',
  tags        text[] default '{}',
  times_made  integer default 1,
  last_made   date default current_date,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create unique index if not exists meal_ratings_name_lower_idx on meal_ratings (lower(meal_name));

create table if not exists shopping_patterns (
  id                 uuid primary key default gen_random_uuid(),
  item_name          text not null,
  normalized_name    text not null,
  avg_quantity       text default '',
  times_bought       integer default 0,
  last_bought        date,
  category           text default 'Annet',
  category_override  text,                                              -- user-set, overrides AI category
  typical_frequency  text default 'weekly',
  updated_at         timestamptz default now()
);
create unique index if not exists shopping_patterns_norm_lower_idx on shopping_patterns (lower(normalized_name));

create table if not exists chat_messages (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid references meal_plans(id) on delete set null,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz default now()
);

create table if not exists app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz default now()
);

create table if not exists shopping_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order integer not null default 0,
  active     boolean default true,
  created_at timestamptz default now()
);


-- ── Indexes ───────────────────────────────────────────────────
create index if not exists meals_plan_id_idx          on meals (plan_id);
create index if not exists meals_meal_date_idx         on meals (meal_date);
create index if not exists shopping_items_plan_id_idx  on shopping_items (plan_id);
create index if not exists chat_messages_plan_id_idx   on chat_messages (plan_id);


-- ── Real-time ─────────────────────────────────────────────────
-- Enable real-time publication for live updates (meals cards + shopping list).
-- If this errors, enable manually: Supabase dashboard → Database → Replication.
alter publication supabase_realtime add table meals;
alter publication supabase_realtime add table shopping_items;


-- ── RLS (Row Level Security) ──────────────────────────────────
-- v1: public read/write — no auth required.
-- Replace with proper policies when auth is added.

alter table meal_plans          enable row level security;
alter table meals               enable row level security;
alter table shopping_items      enable row level security;
alter table family_members      enable row level security;
alter table family_preferences  enable row level security;
alter table meal_ratings        enable row level security;
alter table shopping_patterns   enable row level security;
alter table chat_messages       enable row level security;
alter table app_settings        enable row level security;
alter table shopping_categories enable row level security;

-- Public access policies (anon + authenticated)
do $$
declare
  t text;
begin
  foreach t in array array[
    'meal_plans', 'meals', 'shopping_items', 'family_members',
    'family_preferences', 'meal_ratings', 'shopping_patterns',
    'chat_messages', 'app_settings', 'shopping_categories'
  ] loop
    execute format(
      'create policy "public_all_%s" on %I for all to anon, authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end $$;


-- ── App settings ─────────────────────────────────────────────
insert into app_settings (key, value, updated_at) values
  ('model',       'claude-sonnet-4-6', now()),
  ('recipe_mode', 'ai',                now())
on conflict (key) do update set value = excluded.value, updated_at = now();


-- ── Family members (Ellefsen-familien) ───────────────────────
insert into family_members (name, role, birthdate, cooks_independently, notes, active) values
  ('Gard',    'far',  '1973-06-12', true,  'Hovedplanlegger',                                       true),
  ('Merethe', 'mor',  '1985-09-10', true,  '',                                                      true),
  ('Julie',   'barn', '2012-03-24', true,  'Lager mat selv: semulegrøt, asiatisk bowl m/kjøttdeig', true),
  ('Louise',  'barn', '2014-01-09', true,  'Lager mat selv: pastasalat, pokébowl, kylling m/brokkolisalat', true),
  ('Eskild',  'barn', '2016-08-13', false, '',                                                      true),
  ('Amund',   'barn', '2024-10-21', false, 'Spiser nesten alt vi spiser',                           true);


-- ── Family preferences ────────────────────────────────────────
insert into family_preferences (who, category, rule, details, active) values
  ('Amund',    'dislikes',      'Kokt paprika',                    'Alltid rå paprika i strimler ved siden av',  true),
  ('Familie',  'never_use',     'Koriander',                       'Ingen i familien liker dette',               true),
  ('Familie',  'never_use',     'Selleri',                         'Ingen i familien liker dette',               true),
  ('Familie',  'prefers',       'Gul curry paste (Blue Dragon)',   'Foretrekkes fremfor grønn og rød',           true),
  ('Familie',  'prefers',       'Kylling fremfor svin',            'Vil redusere rødt kjøtt',                    true),
  ('Familie',  'prefers',       'Kyllingkjøttdeig til taco',       'Aldri vanlig kjøttdeig til taco',            true),
  ('Familie',  'min_per_week',  'Fisk/sjømat: 2',                  'Minimum 2 ganger fisk per uke',              true),
  ('Familie',  'max_per_week',  'Fisk/sjømat: 3',                  'Maks 3 ganger fisk per uke',                 true),
  ('Familie',  'cooking_rule',  'Maks koketid 1 time',             'Ingen middager over 1 time',                 true),
  ('Familie',  'cooking_rule',  'Budsjett ca 4000 NOK per uke',    'Inkluderer alle dagligvarer',                true),
  ('Familie',  'default_choice','Paprika: rød er standard',        'Med mindre oppskriften krever annen farge',  true),
  ('Familie',  'default_choice','Løk: rødløk er standard',         'Med mindre oppskriften krever gul løk',      true);


-- ── Meal ratings ──────────────────────────────────────────────
insert into meal_ratings (meal_name, rating, rated_by, notes, recipe_url, tags, times_made, last_made) values
  ('Thaigryte med svin',         'loved', 'Familie', 'Hytta-klassiker. GUL curry paste, hel limeskall, ingen fiskesaus', '', array['weekend','comfort'],   1, '2026-05-27'),
  ('Kyllingwok kombinert',       'loved', 'Familie', 'Hjemmelaget saus. Eget recept',                                    '', array['quick','weeknight'],   1, '2026-05-27'),
  ('Kjøttbollepanne med gnocchi','loved', 'Familie', 'Uten tomater, uten oregano',                                       '', array['kid-friendly','quick'],1, '2026-05-27'),
  ('Marry me chicken',           'loved', 'Familie', 'Fast i rotasjonen',                                                '', array['comfort','weeknight'], 1, '2026-05-27'),
  ('Pokébowl',                   'loved', 'Familie', 'Laks+reker, mango/jordbær, avokado',                               '', array['fresh','weekend'],     1, '2026-05-27'),
  ('Lørdagskylling',             'loved', 'Familie', 'Kyllinggryte i ovn med kremfløte og tomat',                        '', array['weekend','comfort'],   1, '2026-05-27'),
  ('Kylling Shawarma',           'loved', 'Familie', 'Rullekebab i liba-brød med burgerdressing',                        '', array['quick','weeknight'],   1, '2026-05-27'),
  ('Kylling i mangosaus',        'loved', 'Familie', '4.5/5. Kyllinglårfilet',                                           '', array['weeknight'],           1, '2026-05-27'),
  ('Skinkepai',                  'ok',    'Familie', 'Fast i rotasjonen. Med brokkoli og vårløk',                        '', array['comfort'],             1, '2026-05-27'),
  ('Burgundgryte',               'ok',    'Familie', 'Storfe, rødvin, bacon, sopp. 1 time ovn',                          '', array['weekend','slow-cook'], 1, '2026-05-27'),
  ('Kyllingfilet med bønnesalat','ok',    null,      null, 'https://www.matprat.no/oppskrifter/rask/kyllingfilet-med-bonnesalat/', array[]::text[], 1, '2026-05-28');


-- ── Weekly shopping patterns (bootstrap) ─────────────────────
-- These replace the former hardcoded STAPLES constant.
-- The AI system prompt injects weekly patterns as "always include" items.
-- times_bought=3 satisfies the ≥3 threshold used in buildSystemPrompt().
insert into shopping_patterns (item_name, normalized_name, avg_quantity, times_bought, category, typical_frequency)
values
  ('Melk',           'melk',           '2 liter', 3, 'Meieri og egg',      'weekly'),
  ('Egg',            'egg',            '12 stk',  3, 'Meieri og egg',      'weekly'),
  ('Smør',           'smor',           '1 pk',    3, 'Meieri og egg',      'weekly'),
  ('Brød',           'brod',           '1 stk',   3, 'Brød og bakevarer',  'weekly'),
  ('Appelsinjuice',  'appelsinjuice',  '1 liter', 3, 'Drikke',             'weekly'),
  ('Kaffe',          'kaffe',          '1 pk',    3, 'Drikke',             'weekly'),
  ('Bananer',        'bananer',        '1 bunt',  3, 'Grønnsaker og frukt','weekly')
on conflict (lower(normalized_name)) do nothing;


-- ── Functions ────────────────────────────────────────────────

-- Atomically remap shopping_items.for_day when meals are drag-and-dropped.
-- Single-statement UPDATE so dates that rotate (A→B, B→A) don't collide.
create or replace function reorder_shopping_for_day(
  p_plan_id uuid,
  p_old_dates text[],
  p_new_dates text[]
) returns void
language sql as $$
  update shopping_items
  set    for_day = p_new_dates[array_position(p_old_dates, for_day::text)]::date
  where  plan_id       = p_plan_id
    and  for_day::text = any(p_old_dates)
    and  for_day       is not null;
$$;

-- ── Shopping categories ───────────────────────────────────────
insert into shopping_categories (name, sort_order, active) values
  ('Grønnsaker og frukt',  1,  true),
  ('Kjøtt og fisk',        2,  true),
  ('Meieri og egg',        3,  true),
  ('Pålegg',               4,  true),
  ('Brød og bakevarer',    5,  true),
  ('Tørrvarer',            6,  true),
  ('Frysevarer',           7,  true),
  ('Krydder og sauser',    8,  true),
  ('Hermetikk',            9,  true),
  ('Drikke',               10, true),
  ('Snacks og godteri',    11, true),
  ('Rengjøring',           12, true),
  ('Annet',                13, true)
on conflict (name) do nothing;


-- ── Receipt learning (migration 007) ────────────────────────
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
  sync_started_at timestamptz,
  status text not null default 'disconnected'
    check (status in ('connected', 'expired', 'error', 'disconnected', 'syncing')),
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
  unit text,
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


-- ── Done ─────────────────────────────────────────────────────
-- Seeded: 6 family members, 12 preferences, 2 app settings, 11 meal ratings,
--         7 weekly shopping patterns, 13 shopping categories.
-- meal_plans / meals / shopping_items: not seeded (transient planning data).
-- meals.ai_recipe (jsonb) stores AI-generated recipes when recipe_mode='ai'.
-- Functions: reorder_shopping_for_day — atomic for_day remap on meal reorder.
