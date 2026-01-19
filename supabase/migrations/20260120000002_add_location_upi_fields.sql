-- Migration: Add UPI ID and bank details to locations table
-- Purpose: Support location-wise UPI payment QR codes on invoices
-- Date: 2026-01-20

-- ============================================================================
-- UPI AND BANK DETAILS COLUMNS FOR LOCATIONS
-- ============================================================================

-- UPI ID (Virtual Payment Address) for this specific location
-- Allows different collection centers to have their own UPI IDs
ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS upi_id TEXT;

-- Bank details for this location (account_name, account_number, ifsc, bank_name, upi_id)
-- JSONB format allows flexible bank detail storage
ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS bank_details JSONB;

-- ============================================================================
-- VALIDATION CONSTRAINT
-- ============================================================================

-- Ensure UPI ID format is valid (contains @ symbol)
-- This is a soft constraint - allows NULL but validates format when set
ALTER TABLE locations
ADD CONSTRAINT locations_upi_id_format_check 
CHECK (upi_id IS NULL OR upi_id ~ '^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$');

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- No index needed for upi_id as it's not frequently queried

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN locations.upi_id IS 'UPI Virtual Payment Address (VPA) for this location. If set, invoices from this location will show this UPI ID instead of the lab default.';
COMMENT ON COLUMN locations.bank_details IS 'JSONB containing bank details: { account_name, account_number, ifsc, bank_name, upi_id }. Location-specific bank account for settlements.';

-- ============================================================================
-- SAMPLE UPDATE (commented out - for reference)
-- ============================================================================

-- Example: Set UPI ID for a specific location
-- UPDATE locations 
-- SET upi_id = 'location1@ybl' 
-- WHERE id = 'your-location-id';

-- Example: Set full bank details
-- UPDATE locations
-- SET bank_details = '{
--   "account_name": "ABC Diagnostics Branch 1",
--   "account_number": "1234567890",
--   "ifsc": "HDFC0001234",
--   "bank_name": "HDFC Bank",
--   "upi_id": "location1@ybl"
-- }'::jsonb
-- WHERE id = 'your-location-id';
