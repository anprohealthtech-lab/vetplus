-- Add AI verification metadata columns to lab_templates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'lab_templates'
          AND column_name = 'ai_verification_status'
    ) THEN
        ALTER TABLE lab_templates
            ADD COLUMN ai_verification_status TEXT DEFAULT 'not_reviewed';
        COMMENT ON COLUMN lab_templates.ai_verification_status IS 'Lifecycle state of AI verification for this template';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'lab_templates'
          AND column_name = 'ai_verification_summary'
    ) THEN
        ALTER TABLE lab_templates
            ADD COLUMN ai_verification_summary TEXT;
        COMMENT ON COLUMN lab_templates.ai_verification_summary IS 'Short summary of the latest AI audit outcome';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'lab_templates'
          AND column_name = 'ai_verification_details'
    ) THEN
        ALTER TABLE lab_templates
            ADD COLUMN ai_verification_details JSONB;
        COMMENT ON COLUMN lab_templates.ai_verification_details IS 'Structured payload returned from the AI template audit';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'lab_templates'
          AND column_name = 'ai_verification_checked_at'
    ) THEN
        ALTER TABLE lab_templates
            ADD COLUMN ai_verification_checked_at TIMESTAMPTZ;
        COMMENT ON COLUMN lab_templates.ai_verification_checked_at IS 'Timestamp when the latest AI verification was recorded';
    END IF;
END $$;

-- Index to quickly filter templates by AI verification status
CREATE INDEX IF NOT EXISTS idx_lab_templates_ai_verification_status
    ON lab_templates (ai_verification_status);
