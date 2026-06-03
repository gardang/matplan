-- Single-statement UPDATE that atomically remaps for_day values when meals are reordered.
-- Uses TEXT[] (not DATE[]) because the Supabase JS SDK sends date arrays as JSON strings;
-- DATE[] would cause a type mismatch and array_position would return null.
-- for_day is cast to TEXT for comparison, and new value cast back to DATE on write.
CREATE OR REPLACE FUNCTION reorder_shopping_for_day(
  p_plan_id UUID,
  p_old_dates TEXT[],
  p_new_dates TEXT[]
) RETURNS void
LANGUAGE sql AS $$
  UPDATE shopping_items
  SET    for_day = p_new_dates[array_position(p_old_dates, for_day::TEXT)]::DATE
  WHERE  plan_id      = p_plan_id
    AND  for_day::TEXT = ANY(p_old_dates)
    AND  for_day       IS NOT NULL;
$$;
