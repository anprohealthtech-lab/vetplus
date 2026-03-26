/*
  # Add Helper Functions for Global Analyte Management

  1. RPC Functions
     - `add_global_analytes_to_lab` - Manually add global analytes to a specific lab
     - `sync_global_analytes_to_all_labs` - Sync all global analytes to all existing labs

  2. Utility Functions
     - Helper functions for managing global analyte propagation
*/

-- Function to add global analytes to a specific lab
CREATE OR REPLACE FUNCTION public.add_global_analytes_to_lab(target_lab_id UUID)
RETURNS TABLE(added_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    analyte_count INTEGER := 0;
BEGIN
    -- Insert global analytes that don't already exist for this lab
    INSERT INTO public.lab_analytes (
        lab_id,
        analyte_id,
        is_active,
        visible,
        lab_specific_reference_range,
        lab_specific_interpretation_low,
        lab_specific_interpretation_normal,
        lab_specific_interpretation_high
    )
    SELECT
        target_lab_id,
        a.id,
        TRUE,
        TRUE,
        a.reference_range,
        a.interpretation_low,
        a.interpretation_normal,
        a.interpretation_high
    FROM
        public.analytes a
    WHERE
        a.is_global = TRUE
        AND a.is_active = TRUE
        AND NOT EXISTS (
            SELECT 1 
            FROM public.lab_analytes la 
            WHERE la.lab_id = target_lab_id 
            AND la.analyte_id = a.id
        );
    
    GET DIAGNOSTICS analyte_count = ROW_COUNT;
    
    RETURN QUERY SELECT analyte_count;
END;
$function$;

-- Function to sync global analytes to all existing labs
CREATE OR REPLACE FUNCTION public.sync_global_analytes_to_all_labs()
RETURNS TABLE(lab_id UUID, added_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    lab_record RECORD;
    analyte_count INTEGER;
BEGIN
    -- Loop through all active labs
    FOR lab_record IN 
        SELECT id FROM public.labs WHERE is_active = TRUE
    LOOP
        -- Add global analytes to this lab
        SELECT * INTO analyte_count 
        FROM public.add_global_analytes_to_lab(lab_record.id);
        
        -- Return the result for this lab
        RETURN QUERY SELECT lab_record.id, analyte_count;
    END LOOP;
END;
$function$;

-- Function to get analyte usage statistics across labs
CREATE OR REPLACE FUNCTION public.get_analyte_lab_usage_stats()
RETURNS TABLE(
    analyte_id UUID,
    analyte_name TEXT,
    is_global BOOLEAN,
    total_labs INTEGER,
    active_labs INTEGER,
    visible_labs INTEGER,
    customized_labs INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.name,
        a.is_global,
        COUNT(la.lab_id)::INTEGER as total_labs,
        COUNT(CASE WHEN la.is_active = TRUE THEN 1 END)::INTEGER as active_labs,
        COUNT(CASE WHEN la.visible = TRUE THEN 1 END)::INTEGER as visible_labs,
        COUNT(CASE WHEN 
            la.lab_specific_reference_range IS NOT NULL OR
            la.lab_specific_interpretation_low IS NOT NULL OR
            la.lab_specific_interpretation_normal IS NOT NULL OR
            la.lab_specific_interpretation_high IS NOT NULL
        THEN 1 END)::INTEGER as customized_labs
    FROM
        public.analytes a
        LEFT JOIN public.lab_analytes la ON a.id = la.analyte_id
    GROUP BY
        a.id, a.name, a.is_global
    ORDER BY
        a.name;
END;
$function$;