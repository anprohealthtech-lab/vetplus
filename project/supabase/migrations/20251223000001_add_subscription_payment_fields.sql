-- Migration: Add subscription and payment fields to labs table
-- Purpose: Support paid plans with Razorpay integration
-- Date: 2025-12-23

-- ============================================================================
-- SUBSCRIPTION STATUS COLUMNS
-- ============================================================================

-- Plan status: trial, active, inactive, suspended
ALTER TABLE labs 
ADD COLUMN IF NOT EXISTS plan_status TEXT NOT NULL DEFAULT 'trial'
CHECK (plan_status IN ('trial', 'active', 'inactive', 'suspended'));

-- When the current plan expires (NULL = never expires / lifetime)
ALTER TABLE labs 
ADD COLUMN IF NOT EXISTS active_upto TIMESTAMPTZ;

-- When the current plan/trial started
ALTER TABLE labs 
ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- RAZORPAY INTEGRATION COLUMNS
-- ============================================================================

-- Razorpay customer ID (created when lab first makes payment)
ALTER TABLE labs 
ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT;

-- Last successful payment ID from Razorpay
ALTER TABLE labs 
ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;

-- Amount of the last payment (in INR)
ALTER TABLE labs 
ADD COLUMN IF NOT EXISTS razorpay_last_amount NUMERIC(10, 2);

-- When the last payment was made
ALTER TABLE labs 
ADD COLUMN IF NOT EXISTS razorpay_last_payment_at TIMESTAMPTZ;

-- ============================================================================
-- BILLING / CONTACT INFO COLUMNS
-- ============================================================================

-- Email for sending invoices/receipts
ALTER TABLE labs 
ADD COLUMN IF NOT EXISTS billing_email TEXT;

-- GST Identification Number (optional)
ALTER TABLE labs 
ADD COLUMN IF NOT EXISTS gstin TEXT;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index on plan_status for filtering active/inactive labs
CREATE INDEX IF NOT EXISTS idx_labs_plan_status ON labs(plan_status);

-- Index on active_upto for checking expiry dates
CREATE INDEX IF NOT EXISTS idx_labs_active_upto ON labs(active_upto);

-- ============================================================================
-- UPDATE EXISTING LABS
-- ============================================================================

-- Set existing labs to 'active' with no expiry (grandfather them in)
-- This ensures existing labs are not disrupted
UPDATE labs 
SET 
    plan_status = 'active',
    plan_started_at = created_at,
    active_upto = NULL  -- NULL means no expiry (lifetime/grandfathered)
WHERE plan_status = 'trial';

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN labs.plan_status IS 'Subscription status: trial, active, inactive, suspended';
COMMENT ON COLUMN labs.active_upto IS 'When subscription expires. NULL = never expires (lifetime)';
COMMENT ON COLUMN labs.plan_started_at IS 'When the current plan/trial started';
COMMENT ON COLUMN labs.razorpay_customer_id IS 'Razorpay customer ID for this lab';
COMMENT ON COLUMN labs.razorpay_payment_id IS 'ID of the last successful Razorpay payment';
COMMENT ON COLUMN labs.razorpay_last_amount IS 'Amount of the last payment in INR';
COMMENT ON COLUMN labs.razorpay_last_payment_at IS 'Timestamp of the last successful payment';
COMMENT ON COLUMN labs.billing_email IS 'Email address for billing/invoices';
COMMENT ON COLUMN labs.gstin IS 'GST Identification Number';
