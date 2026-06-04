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
id UUID PK · item_name TEXT · normalized_name TEXT (unique index on lower) · avg_quantity TEXT · times_bought INT · last_bought DATE · category TEXT · typical_frequency TEXT (weekly/biweekly/monthly/occasional) · updated_at

## chat_messages
id UUID PK · plan_id FK→meal_plans SET NULL · role TEXT (user/assistant) · content TEXT · created_at

## shopping_categories
id UUID PK · name TEXT (UNIQUE) · sort_order INT · active BOOL default true · created_at
Managed via Settings UI. Source of truth for shopping list categories (replaces hardcoded CATEGORIES constant).
API: GET/POST/PUT/DELETE /api/settings/categories

## Real-time enabled on: shopping_items, meals
## RLS: public read/write on all tables (no auth in v1)
