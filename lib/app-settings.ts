// Server-side helper for reading app_settings from Supabase
import { createServerClient } from "./supabase-server";
import { DEFAULT_MODEL } from "./constants";

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
