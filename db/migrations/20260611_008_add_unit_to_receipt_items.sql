-- Add unit to receipt_items (Trumf line items carry enhetsType: KG or STK).
-- Needed so weight-based buys (e.g. 3.098 KG) aren't averaged together with
-- count-based buys (e.g. 2 STK) in the learning pipeline.

alter table receipt_items add column if not exists unit text;
