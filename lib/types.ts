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
