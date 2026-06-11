// Database row types matching schema.md

export interface MealPlan {
  id: string;
  date_from: string;
  date_to: string;
  created_at: string;
  updated_at: string;
}

export interface AiRecipe {
  portions: number;
  time_minutes: number;
  difficulty: string;
  ingredients: Array<{ name: string; quantity: string; category?: string }>;
  steps: string[];
}

export interface Meal {
  id: string;
  plan_id: string;
  meal_date: string;
  meal_name: string;
  description: string | null;
  recipe_url: string | null;
  recipe_source: string | null;
  notes: string | null;
  ai_recipe: AiRecipe | null;
  created_at: string;
}

export interface ShoppingItem {
  id: string;
  plan_id: string;
  item_name: string;
  quantity: string | null;
  category: string;
  checked: boolean;
  is_auto: boolean;
  is_edited: boolean;
  is_staple: boolean;
  for_day: string | null;
  notes: string | null;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  role: "far" | "mor" | "barn";
  birthdate: string | null;
  cooks_independently: boolean;
  notes: string | null;
  active: boolean;
  created_at: string;
}

export interface FamilyPreference {
  id: string;
  who: string;
  category:
    | "dislikes"
    | "never_use"
    | "prefers"
    | "allergy"
    | "max_per_week"
    | "min_per_week"
    | "default_choice"
    | "cooking_rule";
  rule: string;
  details: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MealRating {
  id: string;
  meal_name: string;
  rating: "loved" | "ok" | "disliked" | "never_again";
  rated_by: string | null;
  notes: string | null;
  recipe_url: string | null;
  tags: string[] | null;
  times_made: number;
  last_made: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShoppingPattern {
  id: string;
  item_name: string;
  normalized_name: string;
  avg_quantity: string | null;
  times_bought: number;
  last_bought: string | null;
  category: string | null;
  category_override: string | null;
  typical_frequency: "weekly" | "biweekly" | "monthly" | "occasional" | null;
  avg_price: number | null;
  last_price: number | null;
  buys_per_month: number | null;
  pattern_source: "app" | "receipt" | "both";
  updated_at: string;
}

export type StoreId = "trumf" | "coop" | "rema";

export interface StoreConnection {
  id: string;
  store: StoreId;
  access_token: string | null;
  token_expires_at: string | null;
  last_sync_at: string | null;
  status: "connected" | "expired" | "error" | "disconnected";
  status_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Receipt {
  id: string;
  store: StoreId;
  external_id: string;
  chain: string | null;
  store_name: string | null;
  purchase_date: string;
  total_amount: number | null;
  bonus_amount: number | null;
  created_at: string;
}

export interface ReceiptItem {
  id: string;
  receipt_id: string;
  ean: string | null;
  product_text: string;
  normalized_name: string | null;
  quantity: number;
  unit: string | null;
  total_price: number | null;
  unit_price: number | null;
  discount: number | null;
  created_at: string;
}

export interface ProductMapping {
  id: string;
  ean: string | null;
  match_text: string;
  item_name: string;
  category: string | null;
  source: "ai" | "manual";
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  plan_id: string | null;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ShoppingCategory {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

// UI-only types

export interface MergedItem {
  name: string;
  displayQty: string;
  forDays: string[];
  ids: string[];
  checkedArr: boolean[];
  edited: boolean;
  category: string;
}

export type DayColor =
  | "blue"
  | "emerald"
  | "orange"
  | "teal"
  | "pink"
  | "violet"
  | "gray";

export interface AiMealSuggestion {
  name: string;
  description: string;
  source: string;
  extraIngredients: string;
  recipeUrl?: string;
}
