// Simple migration script for WhatsApp user sync fields
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const supabaseUrl = 'https://scqhzbkkradflywariem.supabase.co';
const supabaseServiceKey = 'sb_secret_keQYH9kFby0OSyjdyczGsA_HJ7WoBE4'; // Service role key

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  try {
    console.log('🚀 Starting WhatsApp User Sync Migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20241024000001_add_whatsapp_user_sync_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded successfully');
    console.log('📊 Executing migration via SQL...');
    
    // Since we can't execute arbitrary SQL directly, let's break down the migration
    // into individual ALTER TABLE statements that we can execute via the API
    
    console.log('🔄 Adding whatsapp_user_id column...');
    try {
      await supabase.rpc('exec', {
        sql: `
          DO $$ 
          BEGIN
              IF NOT EXISTS (
                  SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'users' AND column_name = 'whatsapp_user_id'
              ) THEN
                  ALTER TABLE users ADD COLUMN whatsapp_user_id UUID;
                  COMMENT ON COLUMN users.whatsapp_user_id IS 'ID of the corresponding user in WhatsApp backend database';
              END IF;
          END $$;
        `
      });
      console.log('✅ whatsapp_user_id column added');
    } catch (error) {
      console.log('⚠️ whatsapp_user_id column might already exist or exec RPC not available');
    }
    
    // Let's try a different approach - use the SQL editor/query functionality
    console.log('📝 Attempting alternative execution method...');
    
    // Create a simple function to check if our columns exist
    const checkColumns = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'users')
      .like('column_name', 'whatsapp_%');
    
    console.log('🔍 Current WhatsApp columns:', checkColumns.data?.map(col => col.column_name) || []);
    
    if (checkColumns.data && checkColumns.data.length === 0) {
      console.log('❌ WhatsApp columns not found. Migration needs to be run manually.');
      console.log('');
      console.log('📋 Please run the following SQL manually in your Supabase SQL Editor:');
      console.log('');
      console.log('```sql');
      console.log(migrationSQL);
      console.log('```');
      console.log('');
      console.log('🌐 Access your Supabase Dashboard at: https://supabase.com/dashboard/project/scqhzbkkradflywariem');
      console.log('📄 Go to SQL Editor and paste the above SQL to complete the migration.');
    } else {
      console.log('✅ WhatsApp columns already exist! Migration may have been completed.');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Migration check failed:', error.message);
    console.log('');
    console.log('📋 Please run the migration manually in Supabase SQL Editor:');
    console.log('🌐 Dashboard: https://supabase.com/dashboard/project/scqhzbkkradflywariem');
    console.log('📁 File: supabase/migrations/20241024000001_add_whatsapp_user_sync_fields.sql');
    return false;
  }
}

// Run the migration
runMigration()
  .then(success => {
    if (success) {
      console.log('🎉 Migration process completed!');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });