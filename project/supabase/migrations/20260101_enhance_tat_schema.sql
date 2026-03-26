-- Add sample_received_at to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS sample_received_at timestamp with time zone;

-- Flatten TAT metadata into order_test_groups for performance and historical accuracy ("Frozen" TAT)
ALTER TABLE public.order_test_groups
ADD COLUMN IF NOT EXISTS tat_minutes integer,
ADD COLUMN IF NOT EXISTS tat_start_time timestamp with time zone,
ADD COLUMN IF NOT EXISTS expected_report_time timestamp with time zone,
ADD COLUMN IF NOT EXISTS actual_report_time timestamp with time zone,
ADD COLUMN IF NOT EXISTS is_tat_breached boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS tat_status text CHECK (tat_status IN ('pending', 'in_progress', 'within_tat', 'breached'));

-- Function to calculate TAT metrics whenever order status/timestamps change
CREATE OR REPLACE FUNCTION public.calculate_tat_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_tat_minutes integer;
    v_start_time timestamp with time zone;
    v_test_group_record record;
BEGIN
    -- Only proceed if relevant columns changed
    IF (TG_TABLE_NAME = 'orders' AND (
        NEW.sample_collected_at IS DISTINCT FROM OLD.sample_collected_at OR
        NEW.sample_received_at IS DISTINCT FROM OLD.sample_received_at
    )) OR (TG_TABLE_NAME = 'order_test_groups') THEN
    
        -- Logic is complex because data is split across tables. 
        -- If Trigger is on ORDERS, we update all child ORDER_TEST_GROUPS
        IF TG_TABLE_NAME = 'orders' THEN
            FOR v_test_group_record IN 
                SELECT otg.id, tg.tat_hours 
                FROM order_test_groups otg
                JOIN test_groups tg ON otg.test_group_id = tg.id
                WHERE otg.order_id = NEW.id
            LOOP
                -- Determine Start Time: Receipt > Collection
                v_start_time := COALESCE(NEW.sample_received_at, NEW.sample_collected_at);
                v_tat_minutes := (v_test_group_record.tat_hours * 60)::integer;

                IF v_start_time IS NOT NULL AND v_tat_minutes IS NOT NULL THEN
                    UPDATE order_test_groups
                    SET 
                        tat_minutes = v_tat_minutes,
                        tat_start_time = v_start_time,
                        expected_report_time = v_start_time + (v_tat_minutes || ' minutes')::interval,
                        tat_status = CASE 
                            WHEN actual_report_time IS NOT NULL AND actual_report_time > (v_start_time + (v_tat_minutes || ' minutes')::interval) THEN 'breached'
                            WHEN actual_report_time IS NOT NULL THEN 'within_tat'
                            WHEN NOW() > (v_start_time + (v_tat_minutes || ' minutes')::interval) THEN 'breached'
                            ELSE 'in_progress'
                        END,
                        is_tat_breached = CASE 
                            WHEN actual_report_time IS NOT NULL THEN actual_report_time > (v_start_time + (v_tat_minutes || ' minutes')::interval)
                            ELSE NOW() > (v_start_time + (v_tat_minutes || ' minutes')::interval)
                        END
                    WHERE id = v_test_group_record.id;
                END IF;
            END LOOP;
        END IF;

    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for ORDERS (Collection/Receipt updates)
DROP TRIGGER IF EXISTS tr_calculate_tat_orders ON public.orders;
CREATE TRIGGER tr_calculate_tat_orders
AFTER UPDATE OF sample_collected_at, sample_received_at
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.calculate_tat_metrics();

-- Function to handle Result Approval (End Timestamp)
-- This needs to run when a RESULT status changes to 'Approved'
-- But results are granular. We need to check if ALL results in a group are approved? 
-- Simplification: Set actual_report_time when the LAST result in a group is approved.
-- For now, let's keep it simple: We will just define the columns. The VIEW handles the "live" status calculation best.
-- The stored columns `tat_start_time` and `expected_report_time` are critical for indexing and simple queries.
-- `actual_report_time` is harder to sync via trigger without potentially heavy logic. 
-- Let's stick to syncing START times first.

