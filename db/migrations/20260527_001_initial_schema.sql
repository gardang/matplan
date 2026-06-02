-- Migration: 001 — Initial schema
-- Date: 2026-05-27 (project start)
-- Tables: meal_plans, meals, shopping_items, family_members, family_preferences,
--         meal_ratings, shopping_patterns, chat_messages, app_settings

create extension if not exists "pgcrypto";

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
  plan_id        uuid references meal_plans(id) on delete cascade,
  meal_date      date not null,
  meal_name      text not null,
  description    text default '',
  recipe_url     text default '',
  recipe_source  text default '',
  notes          text default '',
  created_at     timestamptz default now()
);

create table if not exists shopping_items (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid references meal_plans(id) on delete cascade,
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

-- Indexes
create index if not exists meals_plan_id_idx          on meals (plan_id);
create index if not exists meals_meal_date_idx         on meals (meal_date);
create index if not exists shopping_items_plan_id_idx  on shopping_items (plan_id);
create index if not exists chat_messages_plan_id_idx   on chat_messages (plan_id);

-- Real-time
alter publication supabase_realtime add table meals;
alter publication supabase_realtime add table shopping_items;

-- RLS
alter table meal_plans         enable row level security;
alter table meals              enable row level security;
alter table shopping_items     enable row level security;
alter table family_members     enable row level security;
alter table family_preferences enable row level security;
alter table meal_ratings       enable row level security;
alter table shopping_patterns  enable row level security;
alter table chat_messages      enable row level security;
alter table app_settings       enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'meal_plans','meals','shopping_items','family_members',
    'family_preferences','meal_ratings','shopping_patterns',
    'chat_messages','app_settings'
  ] loop
    execute format(
      'create policy "public_all_%s" on %I for all to anon, authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end $$;

-- Default settings
insert into app_settings (key, value) values
  ('model',       'claude-sonnet-4-6'),
  ('recipe_mode', 'ai')
on conflict (key) do nothing;
