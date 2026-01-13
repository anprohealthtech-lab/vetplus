// Purpose: Public endpoint to create a new lab with admin user
// This is used for new lab onboarding
// Route: POST /create-lab-with-admin
// Body:
// {
//   "lab_name": "Lab Name",
//   "address": "Lab Address",
//   "city": "City",
//   "state": "State",
//   "pincode": "123456",
//   "phone": "+91...",
//   "email": "lab@example.com",
//   "admin_name": "Admin Name",
//   "admin_email": "admin@example.com",
//   "admin_password": "password" (optional - auto-generated if not provided)
// }

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

interface CreateLabPayload {
  lab_name: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  admin_name: string;
  admin_email: string;
  admin_password?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...corsHeaders,
    },
  });

const bad = (msg: string, status = 400) => json({ error: msg }, status);

const getSupabaseAdmin = () => {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") return bad("Use POST", 405);

    const supabaseAdmin = getSupabaseAdmin();

    const body = (await req.json()) as CreateLabPayload;
    const {
      lab_name,
      address,
      city,
      state,
      pincode,
      phone,
      email,
      gstin,
      admin_name,
      admin_email,
      admin_password,
    } = body;

    console.log('[CREATE-LAB-WITH-ADMIN] Request:', { lab_name, admin_email });

    // Validate required fields
    if (!lab_name) return bad("lab_name is required");
    if (!admin_name) return bad("admin_name is required");
    if (!admin_email) return bad("admin_email is required");

    // Check if admin email already exists
    const { data: existingUsers } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", admin_email)
      .limit(1);

    if (existingUsers && existingUsers.length > 0) {
      return bad("A user with this email already exists", 409);
    }

    // 1. Create the lab with inactive status
    console.log('[CREATE-LAB-WITH-ADMIN] Creating lab...');
    
    // Generate a unique lab code from the lab name
    const labCodePrefix = lab_name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'LAB';
    const labCodeSuffix = Math.floor(1000 + Math.random() * 9000); // 4 digit random
    const labCode = `${labCodePrefix}${labCodeSuffix}`;
    
    const { data: labData, error: labError } = await supabaseAdmin
      .from("labs")
      .insert({
        name: lab_name,
        code: labCode,
        address: address || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        phone: phone || null,
        email: email || admin_email,
        gstin: gstin || null,
        is_active: true,
        plan_status: 'inactive', // New labs start as inactive
        plan_started_at: new Date().toISOString(),
        // Default PDF settings
        pdf_layout_settings: {
          headerTextColor: 'white',
          resultColors: {
            high: '#dc2626',
            low: '#2563eb',
            critical: '#7c2d12',
            abnormal: '#ea580c',
            normal: '#16a34a'
          }
        }
      })
      .select()
      .single();

    if (labError) {
      console.error('[CREATE-LAB-WITH-ADMIN] ERROR: Failed to create lab:', labError);
      throw new Error(`Failed to create lab: ${labError.message}`);
    }

    const labId = labData.id;
    console.log('[CREATE-LAB-WITH-ADMIN] Lab created with ID:', labId);

    // 2. Create default location for the lab
    console.log('[CREATE-LAB-WITH-ADMIN] Creating default location...');
    const { error: locationError } = await supabaseAdmin
      .from("locations")
      .insert({
        lab_id: labId,
        name: `${lab_name} - Main`,
        code: 'MAIN',
        address: address || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        contact_phone: phone || null,
        contact_email: email || admin_email,
        is_active: true,
        is_collection_center: false,
        is_main_lab: true,
      });

    if (locationError) {
      console.warn('[CREATE-LAB-WITH-ADMIN] WARNING: Failed to create default location:', locationError.message);
      // Don't fail the entire operation
    } else {
      console.log('[CREATE-LAB-WITH-ADMIN] Default location created');
    }

    // 3. Get admin role ID
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("role_code", "admin")
      .single();

    const adminRoleId = adminRole?.id;
    console.log('[CREATE-LAB-WITH-ADMIN] Admin role ID:', adminRoleId || 'not found');

    // 4. Create auth user for admin
    const finalPassword = admin_password || (crypto.randomUUID().substring(0, 12) + "!Aa1");
    console.log('[CREATE-LAB-WITH-ADMIN] Creating auth user...');

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: admin_email,
      password: finalPassword,
      email_confirm: true,
      user_metadata: {
        lab_id: labId,
        name: admin_name,
        role: 'admin',
        created_at: new Date().toISOString(),
      },
      app_metadata: { providers: ["email"], provider: "email" },
    });

    if (authError) {
      console.error('[CREATE-LAB-WITH-ADMIN] ERROR: Failed to create auth user:', authError);
      // Rollback: Delete the lab
      await supabaseAdmin.from("labs").delete().eq("id", labId);
      throw new Error(`Failed to create admin user: ${authError.message}`);
    }

    const adminUserId = authData.user?.id;
    console.log('[CREATE-LAB-WITH-ADMIN] Auth user created with ID:', adminUserId);

    // 5. Create public.users record
    const { error: userError } = await supabaseAdmin
      .from("users")
      .insert({
        id: adminUserId,
        name: admin_name,
        email: admin_email,
        role: "Admin",
        role_id: adminRoleId,
        status: "Active",
        lab_id: labId,
        department: "Administration",
        join_date: new Date().toISOString().split("T")[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (userError) {
      console.error('[CREATE-LAB-WITH-ADMIN] ERROR: Failed to create public user:', userError);
      // Rollback
      await supabaseAdmin.auth.admin.deleteUser(adminUserId!);
      await supabaseAdmin.from("labs").delete().eq("id", labId);
      throw new Error(`Failed to create user record: ${userError.message}`);
    }

    console.log('[CREATE-LAB-WITH-ADMIN] Public user created');

    // 6. Trigger onboarding-lab function to set up test groups, templates, etc.
    console.log('[CREATE-LAB-WITH-ADMIN] Triggering onboarding function...');
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const response = await fetch(`${supabaseUrl}/functions/v1/onboarding-lab`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ lab_id: labId }),
      });

      if (response.ok) {
        console.log('[CREATE-LAB-WITH-ADMIN] Onboarding function completed');
      } else {
        console.warn('[CREATE-LAB-WITH-ADMIN] WARNING: Onboarding function returned:', response.status);
      }
    } catch (onboardError) {
      console.warn('[CREATE-LAB-WITH-ADMIN] WARNING: Onboarding function failed:', onboardError);
      // Don't fail - can be run manually later
    }

    // 7. Sync user to WhatsApp backend
    console.log('[CREATE-LAB-WITH-ADMIN] Syncing user to WhatsApp backend...');
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const syncResponse = await fetch(`${supabaseUrl}/functions/v1/sync-user-to-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ userId: adminUserId, labId }),
      });

      if (syncResponse.ok) {
        console.log('[CREATE-LAB-WITH-ADMIN] User synced to WhatsApp backend');
      } else {
        const errorText = await syncResponse.text();
        console.warn('[CREATE-LAB-WITH-ADMIN] WARNING: WhatsApp sync failed:', errorText);
      }
    } catch (syncError) {
      console.warn('[CREATE-LAB-WITH-ADMIN] WARNING: WhatsApp sync failed:', syncError);
      // Don't fail - can be run manually later
    }

    console.log('[CREATE-LAB-WITH-ADMIN] SUCCESS: Lab and admin created');

    return json({
      success: true,
      lab: {
        id: labId,
        name: lab_name,
        status: 'inactive',
      },
      admin: {
        id: adminUserId,
        email: admin_email,
        name: admin_name,
        temporary_password: admin_password ? undefined : finalPassword,
      },
      message: "Lab created successfully. Status is 'inactive' - contact admin to activate.",
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-LAB-WITH-ADMIN] ERROR:", msg);
    return bad(msg, 400);
  }
});
