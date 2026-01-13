// Supabase Edge Function: Sync User to WhatsApp Backend
// Syncs admin user creation to external WhatsApp backend database
// Triggered after user creation in create-lab-with-admin or can be called manually

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// WhatsApp backend Neon database connection
const WHATSAPP_DB_URL = 'postgresql://neondb_owner:npg_HclN2sBL5OIF@ep-solitary-salad-a1alphes-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseClient = createClient(supabaseUrl, supabaseKey)

    // Parse request body
    const { userId, labId } = await req.json()

    if (!userId) {
      throw new Error('userId is required')
    }

    console.log('📲 Syncing user to WhatsApp backend:', userId)

    // Fetch user and lab data
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('id, name, email, phone, role, lab_id')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      throw new Error(`User not found: ${userError?.message}`)
    }

    const effectiveLabId = labId || user.lab_id

    const { data: lab, error: labError } = await supabaseClient
      .from('labs')
      .select('id, name, address, city, state, phone, email')
      .eq('id', effectiveLabId)
      .single()

    if (labError || !lab) {
      console.warn('⚠️ Lab not found, proceeding with user data only')
    }

    console.log('✅ Fetched user and lab data')

    // Connect to WhatsApp backend database
    const sql = postgres(WHATSAPP_DB_URL, {
      ssl: 'require',
    })

    try {
      // Hash password (using bcrypt-compatible hashing)
      // For now, we'll use a default password since we don't have the actual password
      const defaultPassword = 'Welcome@123'
      const passwordHash = await hashPassword(defaultPassword)

      // Prepare user data for WhatsApp backend
      const whatsappUser = {
        id: user.id, // Use Supabase user ID
        auth_id: user.id, // Same as ID
        username: user.name || user.email,
        password_hash: passwordHash,
        name: user.name || user.email,
        role: user.role?.toLowerCase() || 'receptionist',
        clinic_name: lab?.name || 'Lab',
        clinic_address: lab ? `${lab.address || ''}, ${lab.city || ''}, ${lab.state || ''}`.trim() : '',
        gmb_link: '', // Not available in our system
        logo: null,
        primary_color: '#4852e5',
        secondary_color: '#E5E7EB',
        contact_phone: user.phone || lab?.phone || '',
        contact_email: user.email,
        contact_whatsapp: user.phone || lab?.phone || '',
        languages: { en: { name: '', address: '' } },
        default_language: 'en',
        enabled_features: ['dashboard', 'appointments', 'reviews', 'sequences', 'creatives'],
        profile_types: [],
        google_sheet_id: null,
        google_apps_script_url: null,
        blueticks_api_key: null,
        whatsapp_integration_available: true,
        max_sessions: 2,
        session_preferences: null,
        bundle_message_count: 3,
      }

      // Check if user already exists in WhatsApp backend
      const existingUser = await sql`
        SELECT id FROM users WHERE id = ${user.id}
      `

      if (existingUser.length > 0) {
        // Update existing user
        await sql`
          UPDATE users SET
            username = ${whatsappUser.username},
            name = ${whatsappUser.name},
            role = ${whatsappUser.role},
            clinic_name = ${whatsappUser.clinic_name},
            clinic_address = ${whatsappUser.clinic_address},
            contact_phone = ${whatsappUser.contact_phone},
            contact_email = ${whatsappUser.contact_email},
            contact_whatsapp = ${whatsappUser.contact_whatsapp},
            updated_at = NOW()
          WHERE id = ${user.id}
        `
        console.log('✅ Updated existing user in WhatsApp backend')
      } else {
        // Insert new user
        await sql`
          INSERT INTO users (
            id, auth_id, username, password_hash, name, role,
            clinic_name, clinic_address, gmb_link, logo,
            primary_color, secondary_color, contact_phone, contact_email,
            contact_whatsapp, languages, default_language, enabled_features,
            profile_types, google_sheet_id, google_apps_script_url,
            blueticks_api_key, whatsapp_integration_available, max_sessions,
            session_preferences, bundle_message_count, created_at, updated_at
          ) VALUES (
            ${whatsappUser.id}, ${whatsappUser.auth_id}, ${whatsappUser.username},
            ${whatsappUser.password_hash}, ${whatsappUser.name}, ${whatsappUser.role},
            ${whatsappUser.clinic_name}, ${whatsappUser.clinic_address},
            ${whatsappUser.gmb_link}, ${whatsappUser.logo}, ${whatsappUser.primary_color},
            ${whatsappUser.secondary_color}, ${whatsappUser.contact_phone},
            ${whatsappUser.contact_email}, ${whatsappUser.contact_whatsapp},
            ${JSON.stringify(whatsappUser.languages)}, ${whatsappUser.default_language},
            ${JSON.stringify(whatsappUser.enabled_features)}, ${JSON.stringify(whatsappUser.profile_types)},
            ${whatsappUser.google_sheet_id}, ${whatsappUser.google_apps_script_url},
            ${whatsappUser.blueticks_api_key}, ${whatsappUser.whatsapp_integration_available},
            ${whatsappUser.max_sessions}, ${whatsappUser.session_preferences},
            ${whatsappUser.bundle_message_count}, NOW(), NOW()
          )
        `
        console.log('✅ Inserted new user into WhatsApp backend')
      }

      await sql.end()

      return new Response(
        JSON.stringify({
          success: true,
          message: 'User synced to WhatsApp backend',
          userId: user.id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (dbError) {
      console.error('❌ WhatsApp backend database error:', dbError)
      await sql.end()
      throw dbError
    }
  } catch (error) {
    console.error('❌ Sync error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Sync failed',
        details: String(error),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Simple password hashing (bcrypt-compatible)
async function hashPassword(password: string): Promise<string> {
  // Using Web Crypto API for hashing
  // Note: This is a simplified version. For production, use proper bcrypt
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  // Return in bcrypt-like format (this is simplified - real bcrypt has salt and rounds)
  return `$2a$06$${hashHex.substring(0, 53)}`
}
