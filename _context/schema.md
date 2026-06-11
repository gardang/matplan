# Database Schema (Supabase PostgreSQL)

## meal_plans
id UUID PK · date_from DATE · date_to DATE · created_at · updated_at

## meals
id UUID PK · plan_id FK→meal_plans CASCADE (nullable) · meal_date DATE · meal_name TEXT · description TEXT · recipe_url TEXT · recipe_source TEXT · notes TEXT · ai_recipe JSONB (null unless recipe_mode=ai) · created_at

## shopping_items
id UUID PK · plan_id FK→meal_plans CASCADE · item_name TEXT · quantity TEXT · category TEXT default 'Annet' · checked BOOL · is_auto BOOL default true · is_edited BOOL default false · is_staple BOOL default false · for_day DATE · notes TEXT · created_at

## family_members
id UUID PK · name TEXT · role TEXT ('far'/'mor'/'barn') · birthdate DATE · cooks_independently BOOL · notes TEXT · active BOOL · created_at

## family_preferences
id UUID PK · who TEXT ('Familie' or member name) · category TEXT (dislikes/never_use/prefers/allergy/max_per_week/min_per_week/default_choice/cooking_rule) · rule TEXT · details TEXT · active BOOL · created_at · updated_at

## meal_ratings
id UUID PK · meal_name TEXT (unique index on lower) · rating TEXT (loved/ok/disliked/never_again) · rated_by TEXT · notes TEXT · recipe_url TEXT · tags TEXT[] · times_made INT · last_made DATE · created_at · updated_at

## shopping_patterns
id UUID PK · item_name TEXT · normalized_name TEXT (unique index on lower) · avg_quantity TEXT · times_bought INT · last_bought DATE · category TEXT (auto-learned) · category_override TEXT (user-set, overrides AI) · typical_frequency TEXT (weekly/biweekly/monthly/occasional) · avg_price NUMERIC · last_price NUMERIC · buys_per_month NUMERIC · pattern_source TEXT (app/receipt/both) · updated_at
category_override: when set, used instead of AI-assigned category. Applied post-processing in regenerate + injected into system prompt.
avg_price/last_price/buys_per_month: derived from receipt_items by the receipt learning pipeline. pattern_source tracks whether the row is learned from app checkouts, real receipts, or both.

## store_connections
id UUID PK · store TEXT UNIQUE (trumf/coop/rema) · access_token TEXT · token_expires_at TIMESTAMPTZ · last_sync_at TIMESTAMPTZ · sync_started_at TIMESTAMPTZ (set while a sync runs, cleared when done) · status TEXT (connected/expired/error/disconnected/syncing) · status_message TEXT · created_at · updated_at
Token pasted from a logged-in browser session (v1). API: /api/settings/connections

## receipts
id UUID PK · store TEXT (trumf/coop/rema) · external_id TEXT (UNIQUE per store — Trumf batchid) · chain TEXT (KIWI/MENY/OBS/REMA…) · store_name TEXT · purchase_date DATE · total_amount NUMERIC · bonus_amount NUMERIC · raw JSONB (original payload) · created_at

## receipt_items
id UUID PK · receipt_id FK→receipts CASCADE · ean TEXT (null for Trumf — no barcode in API) · product_text TEXT (raw, e.g. "REKER FROSNE 70/90") · normalized_name TEXT (clean app name via product_mappings) · quantity NUMERIC · unit TEXT (Trumf enhetsType: KG/STK) · total_price NUMERIC · unit_price NUMERIC · discount NUMERIC · created_at

## product_mappings
id UUID PK · ean TEXT · match_text TEXT (unique index on lower) · item_name TEXT (clean app name) · category TEXT · source TEXT (ai/manual) · created_at · updated_at
AI maps unknown receipt texts in batches; user corrections set source='manual' and win.

## chat_messages
id UUID PK · plan_id FK→meal_plans SET NULL · role TEXT (user/assistant) · content TEXT · created_at

## shopping_categories
id UUID PK · name TEXT (UNIQUE) · sort_order INT · active BOOL default true · created_at
Managed via Settings UI. Source of truth for shopping list categories (replaces hardcoded CATEGORIES constant).
API: GET/POST/PUT/DELETE /api/settings/categories

## Real-time enabled on: shopping_items, meals
## RLS: public read/write on all tables (no auth in v1)
