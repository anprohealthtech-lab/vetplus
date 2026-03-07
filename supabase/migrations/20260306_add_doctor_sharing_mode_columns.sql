-- Migration: Add mode columns to doctor_sharing table
-- The original migration used CREATE TABLE IF NOT EXISTS which silently skipped
-- adding new columns since the table already existed with old boolean columns.
-- This migration adds the new text mode columns and migrates existing data.

BEGIN;

-- Add new text mode columns
ALTER TABLE public.doctor_sharing
  ADD COLUMN IF NOT EXISTS dr_discount_mode text NOT NULL DEFAULT 'deduct_from_commission'
    CHECK (dr_discount_mode IN ('none', 'exclude_from_base', 'deduct_from_commission', 'split_50_50')),
  ADD COLUMN IF NOT EXISTS outsource_cost_mode text NOT NULL DEFAULT 'exclude_from_base'
    CHECK (outsource_cost_mode IN ('none', 'exclude_from_base', 'deduct_from_commission')),
  ADD COLUMN IF NOT EXISTS package_diff_mode text NOT NULL DEFAULT 'none'
    CHECK (package_diff_mode IN ('none', 'exclude_from_base', 'deduct_from_commission'));

-- Migrate existing boolean data to new text columns
UPDATE public.doctor_sharing SET
  dr_discount_mode = CASE
    WHEN share_discount_50_50 = true THEN 'split_50_50'
    WHEN exclude_dr_discount = true THEN 'exclude_from_base'
    ELSE 'deduct_from_commission'
  END,
  outsource_cost_mode = CASE
    WHEN exclude_outsource_cost = true THEN 'exclude_from_base'
    ELSE 'none'
  END,
  package_diff_mode = CASE
    WHEN exclude_package_diff = true THEN 'exclude_from_base'
    ELSE 'none'
  END
WHERE dr_discount_mode = 'deduct_from_commission'; -- only rows that haven't been set yet

COMMIT;