-- Migration: 003 — Seed initial weekly shopping patterns
-- Date: 2026-06-02
-- Reason: STAPLES constant removed from code. Weekly items are now driven by
--         shopping_patterns with typical_frequency='weekly'. The AI system prompt
--         injects these as "always include" items for every shopping list.
--         Seed with the former hardcoded staples so the AI picks them up immediately
--         without waiting for 3 shopping trips.

insert into shopping_patterns (item_name, normalized_name, avg_quantity, times_bought, category, typical_frequency)
values
  ('Melk',           'melk',           '2 liter', 3, 'Meieri og egg',      'weekly'),
  ('HMelk',           'hmelk',           '2 ', 3, 'Meieri og egg',      'weekly'),
  ('Egg',            'egg',            '12 stk',  3, 'Meieri og egg',      'weekly'),
  ('Smør Vita',           'smor_vita',           '1 pk',    3, 'Meieri og egg',      'monthly'),
  ('Smør Bremykt',           'smor_bemyk',           '1 pk',    3, 'Meieri og egg',      'monthly'),
  ('Brød',           'brod',           '3 stk',   3, 'Brød og bakevarer',  'weekly'),
  ('Eplejuice',  'eplejuice',  '1 liter', 3, 'Drikke',             'weekly'),
  ('Bananer',        'bananer',        '1 bunt',  3, 'Grønnsaker og frukt','weekly')
on conflict (lower(normalized_name)) do nothing;
