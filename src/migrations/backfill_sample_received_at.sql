-- Backfill migration: Set sample_received_at for existing collected orders
-- that have sample_collected_at but are missing sample_received_at.
--
-- For non-transit orders (transit_status IS NULL or 'received_at_lab'),
-- we set sample_received_at = sample_collected_at since collection = receipt.
--
-- For transit orders that have been received (transit_status = 'received_at_lab'),
-- we set sample_received_at from the transit record's received_at timestamp.
--
-- For transit orders still in transit, we leave sample_received_at NULL
-- so TAT correctly shows "TAT starts after collection".

-- Step 1: Non-transit orders — collection IS receipt
UPDATE orders
SET sample_received_at = sample_collected_at
WHERE sample_collected_at IS NOT NULL
  AND sample_received_at IS NULL
  AND (transit_status IS NULL OR transit_status = '');

-- Step 2: Transit orders that have been received at lab — use transit received_at
UPDATE orders o
SET sample_received_at = st.received_at
FROM sample_transits st
WHERE st.order_id = o.id
  AND st.status = 'received'
  AND o.sample_collected_at IS NOT NULL
  AND o.sample_received_at IS NULL
  AND o.transit_status = 'received_at_lab';

-- Verify: Check how many orders still have NULL sample_received_at after backfill
-- SELECT count(*), transit_status
-- FROM orders
-- WHERE sample_collected_at IS NOT NULL AND sample_received_at IS NULL
-- GROUP BY transit_status;
