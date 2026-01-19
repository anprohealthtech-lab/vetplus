-- Migration: Add is_main_lab flag to locations and fix lab default location
-- This ensures every lab has a default location for orders/invoices

-- 1. Add is_main_lab column to locations table
ALTER TABLE public.locations
ADD COLUMN IF NOT EXISTS is_main_lab boolean DEFAULT false;

-- 2. Create index for quick lookup of main lab location
CREATE INDEX IF NOT EXISTS idx_locations_lab_main 
ON public.locations(lab_id, is_main_lab) 
WHERE is_main_lab = true;

-- 3. Function to get or create default location for a lab
CREATE OR REPLACE FUNCTION public.get_or_create_default_location(p_lab_id uuid)
RETURNS uuid AS $$
DECLARE
    v_location_id uuid;
    v_lab_record record;
BEGIN
    -- First check if lab has a default_processing_location_id set
    SELECT default_processing_location_id INTO v_location_id
    FROM labs WHERE id = p_lab_id;
    
    IF v_location_id IS NOT NULL THEN
        RETURN v_location_id;
    END IF;
    
    -- Check for existing main lab location
    SELECT id INTO v_location_id
    FROM locations
    WHERE lab_id = p_lab_id AND is_main_lab = true AND is_active = true
    LIMIT 1;
    
    IF v_location_id IS NOT NULL THEN
        -- Update labs.default_processing_location_id
        UPDATE labs SET default_processing_location_id = v_location_id WHERE id = p_lab_id;
        RETURN v_location_id;
    END IF;
    
    -- Check for any active location
    SELECT id INTO v_location_id
    FROM locations
    WHERE lab_id = p_lab_id AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF v_location_id IS NOT NULL THEN
        -- Mark this as main lab and update default
        UPDATE locations SET is_main_lab = true WHERE id = v_location_id;
        UPDATE labs SET default_processing_location_id = v_location_id WHERE id = p_lab_id;
        RETURN v_location_id;
    END IF;
    
    -- No location exists - create one from lab details
    SELECT name, address, city, state, pincode, phone, email
    INTO v_lab_record
    FROM labs WHERE id = p_lab_id;
    
    INSERT INTO locations (
        lab_id, name, code, type, address, city, state, pincode, 
        phone, email, is_active, is_main_lab, 
        is_collection_center, is_processing_center, can_receive_samples,
        supports_cash_collection
    ) VALUES (
        p_lab_id,
        COALESCE(v_lab_record.name, 'Main Lab') || ' - Main',
        'MAIN',
        'diagnostic_center',
        v_lab_record.address,
        v_lab_record.city,
        v_lab_record.state,
        v_lab_record.pincode,
        v_lab_record.phone,
        v_lab_record.email,
        true,
        true,
        true,
        true,
        true,
        true
    )
    RETURNING id INTO v_location_id;
    
    -- Update labs.default_processing_location_id
    UPDATE labs SET default_processing_location_id = v_location_id WHERE id = p_lab_id;
    
    RETURN v_location_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Backfill: Create default locations for labs without one
DO $$
DECLARE
    v_lab record;
    v_location_id uuid;
BEGIN
    FOR v_lab IN 
        SELECT l.id, l.name, l.address, l.city, l.state, l.pincode, l.phone, l.email
        FROM labs l
        WHERE l.default_processing_location_id IS NULL
          AND l.is_active = true
    LOOP
        -- Check if lab already has a location
        SELECT id INTO v_location_id
        FROM locations
        WHERE lab_id = v_lab.id AND is_active = true
        ORDER BY created_at ASC
        LIMIT 1;
        
        IF v_location_id IS NOT NULL THEN
            -- Mark existing location as main and set default
            UPDATE locations SET is_main_lab = true WHERE id = v_location_id;
            UPDATE labs SET default_processing_location_id = v_location_id WHERE id = v_lab.id;
        ELSE
            -- Create new default location
            INSERT INTO locations (
                lab_id, name, code, type, address, city, state, pincode, 
                phone, email, is_active, is_main_lab, 
                is_collection_center, is_processing_center, can_receive_samples,
                supports_cash_collection
            ) VALUES (
                v_lab.id,
                COALESCE(v_lab.name, 'Main Lab') || ' - Main',
                'MAIN',
                'diagnostic_center',
                v_lab.address,
                v_lab.city,
                v_lab.state,
                v_lab.pincode,
                v_lab.phone,
                v_lab.email,
                true,
                true,
                true,
                true,
                true,
                true
            )
            RETURNING id INTO v_location_id;
            
            UPDATE labs SET default_processing_location_id = v_location_id WHERE id = v_lab.id;
        END IF;
        
        RAISE NOTICE 'Created/set default location % for lab %', v_location_id, v_lab.id;
    END LOOP;
END $$;

-- 5. Function to ensure orders have location_id (can be used as trigger or called manually)
CREATE OR REPLACE FUNCTION public.ensure_order_location()
RETURNS TRIGGER AS $$
DECLARE
    v_default_location uuid;
BEGIN
    -- If location_id is already set, do nothing
    IF NEW.location_id IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    -- Get or create default location for the lab
    SELECT get_or_create_default_location(NEW.lab_id) INTO v_default_location;
    
    IF v_default_location IS NOT NULL THEN
        NEW.location_id := v_default_location;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create trigger to auto-fill location_id on orders
DROP TRIGGER IF EXISTS tr_ensure_order_location ON public.orders;
CREATE TRIGGER tr_ensure_order_location
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.ensure_order_location();

-- 7. Backfill existing orders without location_id
UPDATE orders o
SET location_id = (
    SELECT get_or_create_default_location(o.lab_id)
)
WHERE o.location_id IS NULL;

-- 8. Backfill existing invoices without location_id
UPDATE invoices i
SET location_id = (
    SELECT COALESCE(
        (SELECT location_id FROM orders WHERE id = i.order_id),
        get_or_create_default_location(i.lab_id)
    )
)
WHERE i.location_id IS NULL;

-- 9. Add helpful view for lab's default location
CREATE OR REPLACE VIEW public.v_lab_default_location AS
SELECT 
    l.id as lab_id,
    l.name as lab_name,
    loc.id as location_id,
    loc.name as location_name,
    loc.code as location_code,
    loc.is_main_lab,
    loc.address,
    loc.city,
    loc.state,
    loc.phone,
    loc.email,
    loc.upi_id
FROM labs l
LEFT JOIN locations loc ON l.default_processing_location_id = loc.id
WHERE l.is_active = true;

COMMENT ON FUNCTION public.get_or_create_default_location(uuid) IS 'Gets or creates default location for a lab. Used when orders/invoices need a location.';
COMMENT ON FUNCTION public.ensure_order_location() IS 'Trigger function to auto-fill location_id on new orders';
COMMENT ON COLUMN public.locations.is_main_lab IS 'Marks this location as the main lab location (created during onboarding)';
