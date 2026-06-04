-- Add shopping_categories table so users can manage the list via Settings UI.
-- Replaces the hardcoded CATEGORIES constant as the source of truth.

CREATE TABLE IF NOT EXISTS shopping_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shopping_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_shopping_categories" ON shopping_categories
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Seed: original 12 categories + Pålegg (inserted at position 4)
INSERT INTO shopping_categories (name, sort_order, active) VALUES
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
ON CONFLICT (name) DO NOTHING;
