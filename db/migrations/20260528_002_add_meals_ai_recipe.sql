-- Migration: 002 — Add ai_recipe column to meals
-- Date: 2026-05-28
-- Reason: Support recipe_mode='ai' — stores AI-generated recipe as JSONB
--         (portions, time_minutes, difficulty, ingredients[], steps[])

alter table meals
  add column if not exists ai_recipe jsonb;
