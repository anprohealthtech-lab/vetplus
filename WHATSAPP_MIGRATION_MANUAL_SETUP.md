# WhatsApp User Sync Migration - Manual Setup Instructions

## 🎯 Overview
The WhatsApp User Sync migration needs to be run manually in the Supabase SQL Editor since we cannot execute it directly via the API.

## 📋 Migration Steps

### Step 1: Access Supabase Dashboard
1. Open your web browser
2. Go to: **https://supabase.com/dashboard/project/scqhzbkkradflywariem**
3. Sign in to your Supabase account

### Step 2: Navigate to SQL Editor
1. In the left sidebar, click on **"SQL Editor"**
2. Click **"New Query"** to create a new SQL script

### Step 3: Execute Migration SQL

Copy and paste the following SQL code into the SQL Editor:

```sql
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

-- Create system_config table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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
```

### Step 4: Execute the SQL
1. Click the **"Run"** button (or press Ctrl+Enter)
2. Wait for the query to complete
3. You should see a success message

### Step 5: Verify Migration
Run this verification query to confirm the migration worked:

```sql
-- Verify WhatsApp columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name LIKE 'whatsapp_%'
ORDER BY column_name;

-- Check WhatsApp configuration
SELECT * FROM system_config WHERE key LIKE 'whatsapp_%';
```

## 🎉 After Migration

Once the migration is complete, your LIMS system will have:

### ✅ New Database Fields
- `whatsapp_user_id` - Links to WhatsApp backend user
- `whatsapp_sync_status` - Track sync status (pending/synced/failed/disabled)
- `whatsapp_last_sync` - Timestamp of last sync attempt
- `whatsapp_sync_error` - Error messages for debugging
- `whatsapp_config` - WhatsApp-specific user configuration
- `whatsapp_auto_sync` - Enable/disable automatic sync

### ✅ System Configuration
- Auto-sync settings
- Batch size configuration
- Backend URL configuration

### ✅ WhatsApp User Management
- Navigate to **WhatsApp → User Management** tab in your LIMS
- View sync status for all users
- Perform bulk sync operations
- Retry failed synchronizations

## 🔧 Configuration Required

After the migration, you'll need to:

1. **Set up WhatsApp Backend URL** in system configuration
2. **Test the sync functionality** with a few users
3. **Configure auto-sync preferences** as needed

## 🆘 Need Help?

If you encounter any issues:
1. Check the Supabase logs for detailed error messages
2. Verify your Supabase permissions allow schema modifications
3. Contact your database administrator if needed

---

**Database:** LIMS (scqhzbkkradflywariem.supabase.co)  
**Migration File:** `supabase/migrations/20241024000001_add_whatsapp_user_sync_fields.sql`  
**Service Key:** `sb_secret_keQYH9kFby0OSyjdyczGsA_HJ7WoBE4`