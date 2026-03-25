-- ============================================================
-- Fix: Backfill invoices that belong to B2B accounts but were
--      saved with invoice_type='patient' and no billing_period.
--
-- Root cause: CreateInvoiceModal only auto-set invoice_type='account'
--   when payment_type IN ('credit','corporate','insurance').
--   Orders with other payment types (e.g. 'b2b','account','cash')
--   but linked to an account_id were saved as 'patient' invoices
--   and never appeared in Monthly Account Billing.
--
-- Fix: Set invoice_type='account' and derive billing_period (YYYY-MM)
--   from invoice_date for all invoices that have an account_id.
-- ============================================================

UPDATE public.invoices
SET
  invoice_type   = 'account',
  billing_period = to_char(invoice_date::date, 'YYYY-MM')
WHERE
  account_id IS NOT NULL
  AND (invoice_type = 'patient' OR billing_period IS NULL);

-- Verify: show count of affected rows (informational)
-- SELECT count(*) FROM public.invoices WHERE account_id IS NOT NULL AND invoice_type = 'account';
