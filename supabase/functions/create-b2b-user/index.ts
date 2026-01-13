// Purpose: Create auth user for B2B account portal access
// Route: POST /create-b2b-user
// Body:
// {
//   "email": "user@hospital.com",
//   "password": "SecureP@ss123",
//   "account_id": "uuid",
//   "account_name": "Hospital Name",
//   "lab_id": "uuid"
// }

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, password, account_id, account_name, lab_id } = await req.json();

    // Validate required fields
    if (!email || !password || !account_id || !lab_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, account_id, lab_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    console.log('[CREATE-B2B-USER] Creating B2B user:', { email, account_id, lab_id });

    // Create auth user with B2B metadata
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email verification for B2B accounts
      user_metadata: {
        role: 'b2b_account',
        account_id,
        account_name: account_name || 'B2B Account',
        lab_id,
        created_at: new Date().toISOString(),
      },
      app_metadata: {
        provider: 'email',
        providers: ['email'],
      },
    });

    if (authError) {
      console.error('[CREATE-B2B-USER] Auth error:', authError);
      
      // Check if user already exists
      if (authError.message?.includes('already')) {
        return new Response(
          JSON.stringify({ error: 'User with this email already exists' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    const userId = authData.user?.id;
    if (!userId) {
      throw new Error('User creation returned no ID');
    }

    console.log('[CREATE-B2B-USER] Auth user created:', userId);

    // Optionally create a record in public.users table for tracking
    // This is optional - B2B users don't need full user records
    // They only need auth.users with proper metadata
    try {
      const { error: userRecordError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          email,
          name: account_name || email,
          role: 'B2B Account', // Custom role for B2B
          status: 'Active',
          lab_id,
          join_date: new Date().toISOString().split('T')[0],
        });

      if (userRecordError) {
        console.warn('[CREATE-B2B-USER] Could not create public.users record:', userRecordError);
        // Don't fail - auth user is created, which is sufficient
      }
    } catch (e) {
      console.warn('[CREATE-B2B-USER] Public user record creation failed:', e);
      // Continue - not critical
    }

    console.log('[CREATE-B2B-USER] SUCCESS: B2B user created');

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        email,
        account_id,
        message: 'B2B portal access created successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CREATE-B2B-USER] ERROR:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
