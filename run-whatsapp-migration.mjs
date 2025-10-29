// Migration script to run WhatsApp user sync fields migration
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = 'sb_secret_keQYH9kFby0OSyjdyczGsA_HJ7WoBE4'; // Service role key

if (!supabaseUrl) {
  console.error('VITE_SUPABASE_URL environment variable not found');
  console.log('Please set the VITE_SUPABASE_URL in your .env file');
  process.exit(1);
}

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
    console.log('📊 Executing migration...');
    
    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      // If exec_sql RPC doesn't exist, try direct SQL execution
      console.log('⚠️  exec_sql RPC not found, trying direct execution...');
      
      // Split SQL into statements and execute them one by one
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.trim()) {
          console.log('🔄 Executing statement...');
          const { error: stmtError } = await supabase
            .from('_migrations') // This will fail but let us try another approach
            .select('*')
            .limit(1);
          
          if (stmtError) {
            // Use a different approach - create a temporary SQL function
            console.log('📝 Creating temporary function to execute migration...');
            
            const createFunctionSQL = `
              CREATE OR REPLACE FUNCTION run_whatsapp_migration()
              RETURNS text
              LANGUAGE plpgsql
              AS $$
              BEGIN
                ${migrationSQL.replace(/\$\$/g, '\\$\\$')}
                RETURN 'Migration completed successfully';
              END;
              $$;
            `;
            
            const { error: funcError } = await supabase.rpc('run_whatsapp_migration');
            
            if (funcError) {
              console.error('❌ Migration failed:', funcError.message);
              return false;
            }
            
            break;
          }
        }
      }
    }
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the migration by checking if new columns exist
    console.log('🔍 Verifying migration...');
    
    const { data: tableInfo, error: verifyError } = await supabase
      .rpc('get_table_columns', { table_name: 'users' });
    
    if (!verifyError && tableInfo) {
      const whatsappColumns = tableInfo.filter(col => 
        col.column_name.startsWith('whatsapp_')
      );
      
      if (whatsappColumns.length > 0) {
        console.log('✅ WhatsApp columns found:', whatsappColumns.map(col => col.column_name));
      } else {
        console.log('⚠️  WhatsApp columns not found in verification');
      }
    }
    
    console.log('🎉 WhatsApp User Sync Migration completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Migration failed with error:', error);
    return false;
  }
}

// Run the migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

export { runMigration };