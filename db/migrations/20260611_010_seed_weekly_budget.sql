-- Weekly grocery budget as a structured app setting (single source of truth for
-- the Innsikt dashboard and the AI prompt). Default 4000 NOK; do nothing if the
-- user has already set it.

insert into app_settings (key, value, updated_at) values
  ('weekly_budget', '4000', now())
on conflict (key) do nothing;
