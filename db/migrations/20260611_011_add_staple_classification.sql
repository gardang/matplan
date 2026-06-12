-- Distinguish true staples (bought regardless of menu — milk, bread) from
-- menu-driven ingredients (chicken, mince — bought only because a dinner needs
-- them). Only staples should be force-included in every shopping list.
--
-- is_staple       — auto-derived by the learning pipeline (penetration + category)
-- staple_override — user choice; when not null it wins (mirrors category_override)

alter table shopping_patterns add column if not exists is_staple boolean;
alter table shopping_patterns add column if not exists staple_override boolean;
