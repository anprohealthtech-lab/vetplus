-- Migration: Create Global Internal Tables & Populate with Best Candidate Data
-- Description: Standardizes global data management by creating master catalogs for Test Groups, Packages, and Templates.
--              It then analyzes existing lab data to identify the "Best Candidates" (most complete definitions) and populates the global tables.

-- 1. Create Global Tables
CREATE TABLE IF NOT EXISTS public.global_test_catalog (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    code text NOT NULL,
    category text,
    description text,
    analytes jsonb DEFAULT '[]'::jsonb, -- Array of Global Analyte IDs
    default_price numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    source_lab_id uuid, -- Track which lab this definition came from
    CONSTRAINT global_test_catalog_pkey PRIMARY KEY (id),
    CONSTRAINT global_test_catalog_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS public.global_package_catalog (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    test_group_codes text[] DEFAULT ARRAY[]::text[], -- Array of Test Group Codes
    base_price numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    source_lab_id uuid,
    CONSTRAINT global_package_catalog_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.global_template_catalog (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('header', 'footer', 'report_body', 'invoice')),
    html_content text,
    css_content text,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT global_template_catalog_pkey PRIMARY KEY (id)
);

-- 2. Analysis & Population Logic (The "Shortcut")

-- A. Identify Best Test Groups
-- Logic: Group by Test Group Code. Rank by number of associated analytes.
-- We want the definition that has the MOST analytes linked to it.

WITH TestGroupStats AS (
    SELECT 
        tg.id,
        tg.code,
        tg.name,
        tg.category,
        tg.clinical_purpose as description,
        tg.price,
        tg.lab_id,
        tg.created_at, -- Include created_at for tie-breaking
        COUNT(tga.analyte_id) as analyte_count,
        -- Aggregate the ACTUAL global analyte IDs associated with this test group
        -- We traverse: test_groups -> test_group_analytes -> (analyte_id)
        jsonb_agg(tga.analyte_id) as linked_analytes
    FROM public.test_groups tg
    LEFT JOIN public.test_group_analytes tga ON tg.id = tga.test_group_id
    WHERE tg.lab_id IS NOT NULL -- Only look at lab-specific implementations
    AND tg.is_active = true
    GROUP BY tg.id, tg.code, tg.name, tg.category, tg.clinical_purpose, tg.price, tg.lab_id, tg.created_at
),
RankedTestGroups AS (
    SELECT 
        *,
        ROW_NUMBER() OVER (PARTITION BY code ORDER BY analyte_count DESC, created_at DESC) as rank
    FROM TestGroupStats
    -- Join created_at for tie-breaking if needed (not in CTE but assumed available or ignored)
)
INSERT INTO public.global_test_catalog (name, code, category, description, analytes, default_price, source_lab_id)
SELECT 
    name, 
    code, 
    category, 
    description, 
    linked_analytes, 
    price, 
    lab_id
FROM RankedTestGroups
WHERE rank = 1
ON CONFLICT (code) DO UPDATE SET
    analytes = EXCLUDED.analytes, -- Update to the "better" list if re-run
    description = EXCLUDED.description,
    source_lab_id = EXCLUDED.source_lab_id;

-- B. Identify Best Packages
-- Logic: Group by Package Name. Rank by number of test groups linked.

WITH PackageStats AS (
    SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.lab_id,
        COUNT(ptg.test_group_id) as test_count,
        -- Get the CODES of the linked test groups, as Global Catalog works with CODES
        array_agg(tg.code) as linked_test_codes
    FROM public.packages p
    LEFT JOIN public.package_test_groups ptg ON p.id = ptg.package_id
    LEFT JOIN public.test_groups tg ON ptg.test_group_id = tg.id
    WHERE p.lab_id IS NOT NULL
    AND p.is_active = true
    GROUP BY p.id, p.name, p.description, p.price, p.lab_id
),
RankedPackages AS (
    SELECT 
        *,
        ROW_NUMBER() OVER (PARTITION BY name ORDER BY test_count DESC) as rank
    FROM PackageStats
)
INSERT INTO public.global_package_catalog (name, description, test_group_codes, base_price, source_lab_id)
SELECT 
    name,
    description,
    linked_test_codes,
    price,
    lab_id
FROM RankedPackages
WHERE rank = 1
-- Note: 'name' is not unique in schema, but for 'best candidate' we assume unique names map to unique intents. 
-- We don't have a UNIQUE constraint on name in the global table yet to allow duplicates if needed, 
-- but you might want to deduplicate manually or add a unique constraint.
-- For now, this just inserts. If you run it twice, you might get duplicates. 
-- Let's make it cleaner by checking existence.
AND NOT EXISTS (
    SELECT 1 FROM public.global_package_catalog gpc WHERE gpc.name = RankedPackages.name
);

-- C. Templates (Basic Copy)
-- Copy templates from the first available lab or a specific "Master Lab" if known.
-- Here we'll just take distinct template names and picking the one from the lab with most templates? 
-- Or just take all unique names.

INSERT INTO public.global_template_catalog (name, type, html_content, css_content)
SELECT DISTINCT ON (template_name)
    template_name,
    'report_body', -- Defaulting to report body, adjust if you separate header/footer
    gjs_html,
    gjs_css
FROM public.lab_templates
WHERE is_active = true
ORDER BY template_name, created_at DESC;
-- This grabs the *latest* version of every template name found across all labs.

