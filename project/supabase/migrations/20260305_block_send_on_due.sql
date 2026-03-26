-- Add block_send_on_due flag to labs
-- When true, report auto-send and manual WhatsApp send are blocked for orders with outstanding balance
-- Admin users are exempt from the manual send block

ALTER TABLE labs
  ADD COLUMN IF NOT EXISTS block_send_on_due BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN labs.block_send_on_due IS
  'When true, report auto-send and non-admin manual WhatsApp send are blocked for orders with an outstanding invoice balance';

-- View: real-time per-order due status (multiple invoices + payments handled correctly)
CREATE OR REPLACE VIEW order_due_status AS
SELECT
  o.id     AS order_id,
  o.lab_id,
  (
    COALESCE(SUM(COALESCE(i.total_after_discount, i.subtotal)), 0)
    - COALESCE(SUM(p.amount), 0)
  ) > 0 AS has_due
FROM orders o
LEFT JOIN invoices i ON i.order_id = o.id
LEFT JOIN payments p ON p.invoice_id = i.id
GROUP BY o.id, o.lab_id;
