-- Add watermark settings to labs table
-- This allows each lab to configure automatic watermark application to all generated reports

DO $$ 
BEGIN
    -- Enable/disable watermark feature
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'labs' AND column_name = 'watermark_enabled'
    ) THEN
        ALTER TABLE labs ADD COLUMN watermark_enabled BOOLEAN DEFAULT false;
        COMMENT ON COLUMN labs.watermark_enabled IS 'Enable automatic watermark on all generated reports';
    END IF;

    -- Watermark image URL (from lab branding assets)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'labs' AND column_name = 'watermark_image_url'
    ) THEN
        ALTER TABLE labs ADD COLUMN watermark_image_url TEXT;
        COMMENT ON COLUMN labs.watermark_image_url IS 'URL of the image to use as watermark';
    END IF;

    -- Watermark opacity (0.0 to 1.0)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'labs' AND column_name = 'watermark_opacity'
    ) THEN
        ALTER TABLE labs ADD COLUMN watermark_opacity NUMERIC(3,2) DEFAULT 0.15;
        COMMENT ON COLUMN labs.watermark_opacity IS 'Opacity of watermark (0.05 to 0.50)';
    END IF;

    -- Watermark position (center, top-left, top-right, bottom-left, bottom-right)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'labs' AND column_name = 'watermark_position'
    ) THEN
        ALTER TABLE labs ADD COLUMN watermark_position VARCHAR(20) DEFAULT 'center';
        COMMENT ON COLUMN labs.watermark_position IS 'Position of watermark: center, top-left, top-right, bottom-left, bottom-right, repeat';
    END IF;

    -- Watermark size (small, medium, large, full)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'labs' AND column_name = 'watermark_size'
    ) THEN
        ALTER TABLE labs ADD COLUMN watermark_size VARCHAR(20) DEFAULT 'medium';
        COMMENT ON COLUMN labs.watermark_size IS 'Size of watermark: small (40%), medium (60%), large (80%), full (100%)';
    END IF;

    -- Watermark rotation angle (for diagonal watermarks)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'labs' AND column_name = 'watermark_rotation'
    ) THEN
        ALTER TABLE labs ADD COLUMN watermark_rotation INTEGER DEFAULT 0;
        COMMENT ON COLUMN labs.watermark_rotation IS 'Rotation angle in degrees (-45 to 45)';
    END IF;

END $$;

-- Add constraint for opacity range
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'labs_watermark_opacity_check'
    ) THEN
        ALTER TABLE labs ADD CONSTRAINT labs_watermark_opacity_check 
        CHECK (watermark_opacity IS NULL OR (watermark_opacity >= 0.05 AND watermark_opacity <= 0.50));
    END IF;
END $$;

-- Add constraint for rotation range
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'labs_watermark_rotation_check'
    ) THEN
        ALTER TABLE labs ADD CONSTRAINT labs_watermark_rotation_check 
        CHECK (watermark_rotation IS NULL OR (watermark_rotation >= -45 AND watermark_rotation <= 45));
    END IF;
END $$;
