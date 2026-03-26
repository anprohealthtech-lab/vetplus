import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://neondb_owner:npg_HclN2sBL5OIF@ep-solitary-salad-a1alphes-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function checkSchema() {
    const client = new Client({ connectionString });

    try {
        console.log('🔗 Connecting to Neon database...');
        await client.connect();

        console.log('❓ Fetching columns for table "users"...');
        const res = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);

        console.log('📋 Table Schema for "users":');
        console.table(res.rows);

    } catch (err) {
        console.error('❌ Error checking schema:', err);
    } finally {
        await client.end();
    }
}

checkSchema();
