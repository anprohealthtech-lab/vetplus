import pg from 'pg';
const { Client } = pg;

// Connection string provided by user
const connectionString = "postgresql://neondb_owner:npg_HclN2sBL5OIF@ep-solitary-salad-a1alphes-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

// User data from payload
const userData = {
  id: "4a4a432d-938e-4a59-adad-b266d7570106",
  name: "test lab onboarding",
  email: "ajpriyadarshianpro22@gmail.com",
  role: "admin", // Normalized to lowercase
  created_at: "2025-12-23 09:22:57.13+00",
  updated_at: "2025-12-26 05:05:13.515564+00"
};

async function syncUser() {
  const client = new Client({ connectionString });
  
  try {
    console.log('🔗 Connecting to Neon database...');
    await client.connect();
    console.log('✅ Connected.');

    const query = `
      INSERT INTO users (
        id, 
        auth_id, 
        username, 
        name, 
        role, 
        contact_email, 
        whatsapp_integration_available, 
        max_sessions, 
        bundle_message_count,
        created_at,
        updated_at,
        clinic_name
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        contact_email = EXCLUDED.contact_email,
        updated_at = EXCLUDED.updated_at,
        username = EXCLUDED.username
      RETURNING *;
    `;

    const values = [
      userData.id,                       // id
      userData.id,                       // auth_id (fallback)
      userData.email,                    // username
      userData.name,                      // name
      userData.role,                      // role
      userData.email,                    // contact_email
      true,                               // whatsapp_integration_available
      2,                                  // max_sessions
      3,                                  // bundle_message_count
      userData.created_at,               // created_at
      userData.updated_at,               // updated_at
      "Test Lab Onboarding"               // clinic_name
    ];

    console.log('🛰️ Syncing user...');
    const res = await client.query(query, values);
    console.log('🎉 Successfully synced user:', res.rows[0]);

  } catch (err) {
    console.error('❌ Error syncing user:', err);
  } finally {
    await client.end();
  }
}

syncUser();
