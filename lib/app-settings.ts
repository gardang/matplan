// Server-side helper for reading app_settings from Supabase
import { createServerClient } from "./supabase-server";
import { DEFAULT_MODEL, DEFAULT_WEEKLY_BUDGET } from "./constants";

export async function getActiveModel(): Promise<string> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "model")
      .maybeSingle();
    return data?.value ?? DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

export async function getWeeklyBudget(): Promise<number> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "weekly_budget")
      .maybeSingle();
    const n = data?.value ? Number(data.value) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_WEEKLY_BUDGET;
  } catch {
    return DEFAULT_WEEKLY_BUDGET;
  }
}

export async function getRecipeMode(): Promise<'external' | 'ai'> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "recipe_mode")
      .maybeSingle();
    return (data?.value as 'external' | 'ai') ?? 'external';
  } catch {
    return 'external';
  }
}
