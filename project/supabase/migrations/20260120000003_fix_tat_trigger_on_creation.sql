-- Migration: Fix TAT initialization on order creation
-- This migration adds a trigger to initialize TAT fields when order_test_groups are created

-- Enhanced function that also handles INSERT (order creation)
CREATE OR REPLACE FUNCTION public.calculate_tat_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_tat_minutes integer;
    v_start_time timestamp with time zone;
    v_test_group_record record;
    v_order_record record;
BEGIN
    -- Handle ORDERS table updates (sample receipt/collection)
    IF TG_TABLE_NAME = 'orders' THEN
        -- Only proceed if relevant columns changed
        IF NEW.sample_collected_at IS DISTINCT FROM OLD.sample_collected_at OR
           NEW.sample_received_at IS DISTINCT FROM OLD.sample_received_at THEN
        
            FOR v_test_group_record IN 
                SELECT otg.id, tg.tat_hours 
                FROM order_test_groups otg
                JOIN test_groups tg ON otg.test_group_id = tg.id
                WHERE otg.order_id = NEW.id
            LOOP
                v_start_time := COALESCE(NEW.sample_received_at, NEW.sample_collected_at);
                v_tat_minutes := (COALESCE(v_test_group_record.tat_hours, 3) * 60)::integer;

                IF v_start_time IS NOT NULL THEN
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
        
        RETURN NEW;
    END IF;

    -- Handle ORDER_TEST_GROUPS INSERT (new order creation)
    IF TG_TABLE_NAME = 'order_test_groups' AND TG_OP = 'INSERT' THEN
        -- Get the order's sample timestamps
        SELECT sample_collected_at, sample_received_at 
        INTO v_order_record
        FROM orders 
        WHERE id = NEW.order_id;
        
        -- Get the test group's TAT hours
        SELECT tat_hours INTO v_tat_minutes 
        FROM test_groups 
        WHERE id = NEW.test_group_id;
        
        v_tat_minutes := (COALESCE(v_tat_minutes, 3) * 60)::integer;
        v_start_time := COALESCE(v_order_record.sample_received_at, v_order_record.sample_collected_at);
        
        -- Initialize TAT fields
        NEW.tat_minutes := v_tat_minutes;
        
        IF v_start_time IS NOT NULL THEN
            NEW.tat_start_time := v_start_time;
            NEW.expected_report_time := v_start_time + (v_tat_minutes || ' minutes')::interval;
            NEW.tat_status := CASE 
                WHEN NOW() > (v_start_time + (v_tat_minutes || ' minutes')::interval) THEN 'breached'
                ELSE 'in_progress'
            END;
            NEW.is_tat_breached := NOW() > (v_start_time + (v_tat_minutes || ' minutes')::interval);
        ELSE
            NEW.tat_status := 'pending';
            NEW.is_tat_breached := false;
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers
DROP TRIGGER IF EXISTS tr_calculate_tat_orders ON public.orders;
DROP TRIGGER IF EXISTS tr_calculate_tat_order_test_groups ON public.order_test_groups;

-- Trigger for ORDERS (Collection/Receipt updates)
CREATE TRIGGER tr_calculate_tat_orders
AFTER UPDATE OF sample_collected_at, sample_received_at
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.calculate_tat_metrics();

-- NEW: Trigger for ORDER_TEST_GROUPS INSERT (order creation)
CREATE TRIGGER tr_calculate_tat_order_test_groups
BEFORE INSERT
ON public.order_test_groups
FOR EACH ROW
EXECUTE FUNCTION public.calculate_tat_metrics();

-- Also create a function to backfill TAT for existing orders that don't have TAT data
CREATE OR REPLACE FUNCTION public.backfill_tat_metrics()
RETURNS void AS $$
DECLARE
    v_record record;
    v_start_time timestamp with time zone;
    v_tat_minutes integer;
BEGIN
    FOR v_record IN 
        SELECT 
            otg.id as otg_id,
            o.sample_collected_at,
            o.sample_received_at,
            COALESCE(tg.tat_hours, 3) as tat_hours
        FROM order_test_groups otg
        JOIN orders o ON otg.order_id = o.id
        JOIN test_groups tg ON otg.test_group_id = tg.id
        WHERE otg.tat_minutes IS NULL
          AND (o.sample_collected_at IS NOT NULL OR o.sample_received_at IS NOT NULL)
    LOOP
        v_start_time := COALESCE(v_record.sample_received_at, v_record.sample_collected_at);
        v_tat_minutes := (v_record.tat_hours * 60)::integer;
        
        UPDATE order_test_groups
        SET 
            tat_minutes = v_tat_minutes,
            tat_start_time = v_start_time,
            expected_report_time = v_start_time + (v_tat_minutes || ' minutes')::interval,
            tat_status = CASE 
                WHEN NOW() > (v_start_time + (v_tat_minutes || ' minutes')::interval) THEN 'breached'
                ELSE 'in_progress'
            END,
            is_tat_breached = NOW() > (v_start_time + (v_tat_minutes || ' minutes')::interval)
        WHERE id = v_record.otg_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the backfill for existing orders
SELECT public.backfill_tat_metrics();

COMMENT ON FUNCTION public.calculate_tat_metrics() IS 'Calculates and updates TAT metrics on order_test_groups when orders are updated or created';
COMMENT ON FUNCTION public.backfill_tat_metrics() IS 'One-time backfill of TAT metrics for existing orders missing TAT data';
