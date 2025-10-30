-- Migration: extend lab branding tables with processing metadata
-- Idempotent guards ensure safe re-runs

DO $$
BEGIN
    -- lab_branding_assets extensions
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lab_branding_assets' AND column_name = 'storage_bucket'
    ) THEN
        ALTER TABLE lab_branding_assets ADD COLUMN storage_bucket TEXT DEFAULT 'attachments';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lab_branding_assets' AND column_name = 'storage_path'
    ) THEN
        ALTER TABLE lab_branding_assets ADD COLUMN storage_path TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lab_branding_assets' AND column_name = 'status'
    ) THEN
        ALTER TABLE lab_branding_assets ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lab_branding_assets' AND column_name = 'imagekit_file_id'
    ) THEN
        ALTER TABLE lab_branding_assets ADD COLUMN imagekit_file_id TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lab_branding_assets' AND column_name = 'imagekit_url'
    ) THEN
        ALTER TABLE lab_branding_assets ADD COLUMN imagekit_url TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lab_branding_assets' AND column_name = 'variants'
    ) THEN
        ALTER TABLE lab_branding_assets ADD COLUMN variants JSONB DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lab_branding_assets' AND column_name = 'processed_at'
    ) THEN
        ALTER TABLE lab_branding_assets ADD COLUMN processed_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lab_branding_assets' AND column_name = 'last_error'
    ) THEN
        ALTER TABLE lab_branding_assets ADD COLUMN last_error TEXT;
    END IF;

    -- Ensure storage_path populated for existing rows
    UPDATE lab_branding_assets
    SET storage_path = storage_path
    WHERE storage_path IS NOT NULL;

    -- Ensure is_default uniqueness per lab + type
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'uq_lab_branding_asset_default'
    ) THEN
        CREATE UNIQUE INDEX uq_lab_branding_asset_default
            ON lab_branding_assets (lab_id, asset_type)
            WHERE is_default = TRUE;
    END IF;

    -- lab_user_signatures extensions
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lab_user_signatures' AND column_name = 'storage_bucket'
    ) THEN
        ALTER TABLE lab_user_signatures ADD COLUMN storage_bucket TEXT DEFAULT 'attachments';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lab_user_signatures' AND column_name = 'storage_path'
    ) THEN
        ALTER TABLE lab_user_signatures ADD COLUMN storage_path TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lab_user_signatures' AND column_name = 'status'
    ) THEN
        ALTER TABLE lab_user_signatures ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lab_user_signatures' AND column_name = 'imagekit_file_id'
    ) THEN
        ALTER TABLE lab_user_signatures ADD COLUMN imagekit_file_id TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lab_user_signatures' AND column_name = 'imagekit_url'
    ) THEN
        ALTER TABLE lab_user_signatures ADD COLUMN imagekit_url TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lab_user_signatures' AND column_name = 'variants'
    ) THEN
        ALTER TABLE lab_user_signatures ADD COLUMN variants JSONB DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lab_user_signatures' AND column_name = 'processed_at'
    ) THEN
        ALTER TABLE lab_user_signatures ADD COLUMN processed_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lab_user_signatures' AND column_name = 'last_error'
    ) THEN
        ALTER TABLE lab_user_signatures ADD COLUMN last_error TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'uq_lab_user_signature_default'
    ) THEN
        CREATE UNIQUE INDEX uq_lab_user_signature_default
            ON lab_user_signatures (lab_id, user_id)
            WHERE is_default = TRUE;
    END IF;
END
$$;
