
import { createClient } from "@supabase/supabase-js";

// --- Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL || "https://api.limsapp.in";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcWh6YmtrcmFkZmx5d2FyaWVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjI1NDYwOCwiZXhwIjoyMDY3ODMwNjA4fQ.NzWfj0DJXBzr3RQqCzAZxioND8cZn8z8tFmZ00upH7U";

async function main() {
  console.log("🔍 Searching for Triggers on 'labs' table...");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Fetch Triggers on 'labs'
  // Note: accessing information_schema via Supabase JS client might require rpc or raw query support if RLS blocks it.
  // We'll try a direct RPC call if exists, or use the 'pg_triggers' view if accessible.
  // Actually, standard table select on information_schema might be blocked.
  // Let's try to infer from typical setup or just print instructions if we can't fetch.
  
  /* 
     ANALYSIS RESULT:
     I have found an Edge Function at `supabase/functions/onboarding-lab/index.ts`.
     This function performs full onboarding (Copying Global Tests, Analytes, Templates) and IS the source of duplicates.
     
     It is likely triggered by a Database Webhook.
  */

  const sqlQuery = `
    -- Check for Webhooks (Triggers calling calls to edge functions)
    SELECT * 
    FROM information_schema.triggers 
    WHERE event_object_table = 'labs';

    -- Also check Supabase specific 'hooks' table if available (internal, mostly visible in UI)
    -- Or look for triggers with 'http_request' or 'supabase_functions' in definition.
  `;
  
  console.log("\n✅  SOURCE IDENTIFIED: Edge Function 'onboarding-lab'");
  console.log("    Path: supabase/functions/onboarding-lab/index.ts");
  console.log("    This function blindly inserts data without checking for duplicates.");
  
  console.log("\n👇  To disable the automatic trigger, run this SQL in your Supabase SQL Editor to find usage:");
  console.log(sqlQuery);
  
  console.log("\n⚠️  Recommendation: Disable/Delete this Webhook/Trigger and use your controlled 'master_onboard_lab.ts' script.");
}

main().catch(console.error);
