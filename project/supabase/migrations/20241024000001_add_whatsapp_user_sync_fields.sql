-- Add WhatsApp synchronization fields to users table
-- This allows tracking of sync status with the WhatsApp backend database

DO $$ 
BEGIN
    -- Add whatsapp_user_id column to store the WhatsApp backend user ID
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'whatsapp_user_id'
    ) THEN
        ALTER TABLE users ADD COLUMN whatsapp_user_id UUID;
        COMMENT ON COLUMN users.whatsapp_user_id IS 'ID of the corresponding user in WhatsApp backend database';
    END IF;

    -- Add sync status column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'whatsapp_sync_status'
    ) THEN
        ALTER TABLE users ADD COLUMN whatsapp_sync_status VARCHAR(20) DEFAULT 'pending';
        COMMENT ON COLUMN users.whatsapp_sync_status IS 'Status of synchronization with WhatsApp backend (pending, synced, failed)';
    END IF;

    -- Add last sync timestamp
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'whatsapp_last_sync'
    ) THEN
        ALTER TABLE users ADD COLUMN whatsapp_last_sync TIMESTAMP WITH TIME ZONE;
        COMMENT ON COLUMN users.whatsapp_last_sync IS 'Timestamp of last synchronization attempt';
    END IF;

    -- Add sync error message
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'whatsapp_sync_error'
    ) THEN
        ALTER TABLE users ADD COLUMN whatsapp_sync_error TEXT;
        COMMENT ON COLUMN users.whatsapp_sync_error IS 'Error message from last failed sync attempt';
    END IF;

    -- Add sync configuration
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'whatsapp_config'
    ) THEN
        ALTER TABLE users ADD COLUMN whatsapp_config JSONB DEFAULT '{}';
        COMMENT ON COLUMN users.whatsapp_config IS 'WhatsApp-specific configuration for this user';
    END IF;

    -- Add auto-sync enabled flag
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'whatsapp_auto_sync'
    ) THEN
        ALTER TABLE users ADD COLUMN whatsapp_auto_sync BOOLEAN DEFAULT true;
        COMMENT ON COLUMN users.whatsapp_auto_sync IS 'Whether this user should be automatically synced to WhatsApp backend';
    END IF;

END $$;

-- Create index for efficient sync status queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_whatsapp_sync_status 
ON users (whatsapp_sync_status, lab_id);

-- Create index for WhatsApp user ID lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_whatsapp_user_id 
ON users (whatsapp_user_id) WHERE whatsapp_user_id IS NOT NULL;

-- Add check constraint for sync status
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chk_whatsapp_sync_status'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT chk_whatsapp_sync_status 
        CHECK (whatsapp_sync_status IN ('pending', 'synced', 'failed', 'disabled'));
    END IF;
END $$;

-- Insert or update configuration table for WhatsApp settings
INSERT INTO system_config (key, value, description, category) 
VALUES 
    ('whatsapp_auto_sync_enabled', 'true', 'Enable automatic synchronization of users to WhatsApp backend', 'whatsapp'),
    ('whatsapp_sync_on_user_create', 'true', 'Automatically sync new users to WhatsApp backend when created', 'whatsapp'),
    ('whatsapp_sync_on_user_update', 'false', 'Automatically sync users to WhatsApp backend when updated', 'whatsapp'),
    ('whatsapp_backend_url', '', 'URL of the WhatsApp backend API', 'whatsapp'),
    ('whatsapp_sync_batch_size', '10', 'Number of users to sync in each batch operation', 'whatsapp')
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = CURRENT_TIMESTAMP;