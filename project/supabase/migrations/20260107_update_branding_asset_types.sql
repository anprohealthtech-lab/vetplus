-- Migration: Update check constraint for lab_branding_assets to include front_page and last_page
-- Date: 2026-01-07

BEGIN;

-- Drop existing check constraint
ALTER TABLE public.lab_branding_assets
DROP CONSTRAINT IF EXISTS lab_branding_assets_asset_type_check;

-- Add updated check constraint
ALTER TABLE public.lab_branding_assets
ADD CONSTRAINT lab_branding_assets_asset_type_check 
CHECK (asset_type IN ('header', 'footer', 'watermark', 'logo', 'letterhead', 'front_page', 'last_page'));

COMMIT;
