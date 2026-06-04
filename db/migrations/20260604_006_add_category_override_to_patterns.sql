-- Add category_override to shopping_patterns so users can pin an item to a
-- specific category. When set, it takes precedence over what the AI assigns.
-- NULL means "let the AI decide".

ALTER TABLE shopping_patterns
  ADD COLUMN IF NOT EXISTS category_override text;
