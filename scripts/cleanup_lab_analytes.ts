
import { createClient } from "@supabase/supabase-js";

// --- Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL || "https://api.limsapp.in";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcWh6YmtrcmFkZmx5d2FyaWVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjI1NDYwOCwiZXhwIjoyMDY3ODMwNjA4fQ.NzWfj0DJXBzr3RQqCzAZxioND8cZn8z8tFmZ00upH7U";

const TARGET_LAB_ID = process.argv[2]; 

async function main() {
  if (!TARGET_LAB_ID) {
    console.error("❌ Please provide a LAB_ID as an argument.");
    process.exit(1);
  }

  console.log(`🧹 Starting Orphaned Lab Analyte Cleanup for Lab: ${TARGET_LAB_ID}`);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Get List of "Active/Used" Analyte IDs (Global IDs) for this Lab
  // We do this by finding all test_groups for this lab -> then all test_group_analytes
  
  // A. Get Test Group IDs
  const { data: testGroups } = await supabase
      .from('test_groups')
      .select('id')
      .eq('lab_id', TARGET_LAB_ID);
      
  const testGroupIds = testGroups?.map(tg => tg.id) || [];
  
  if (testGroupIds.length === 0) {
      console.log("No test groups found. Skipping cleanup to be safe.");
      return;
  }

  // B. Get Linked Analytes
  // Warning: large lists might need pagination, but for one lab usually < 5000 rows.
  const { data: linkedAnalytes } = await supabase
      .from('test_group_analytes')
      .select('analyte_id')
      .in('test_group_id', testGroupIds);

  const usedAnalyteIds = new Set(linkedAnalytes?.map(l => l.analyte_id) || []);
  console.log(`   🔍 Found ${usedAnalyteIds.size} unique analytes currently linked to test groups.`);

  // 2. Fetch All Lab Analytes
  const { data: labAnalytes } = await supabase
      .from('lab_analytes')
      .select('id, analyte_id, lab_specific_name')
      .eq('lab_id', TARGET_LAB_ID);

  if (!labAnalytes) {
      console.log("No lab_analytes found.");
      return;
  }

  console.log(`   🔍 Checked ${labAnalytes.length} total lab_analytes config entries.`);

  // 3. Identify Orphans
  const orphans = labAnalytes.filter(la => !usedAnalyteIds.has(la.analyte_id));
  
  console.log(`   ⚠️ Found ${orphans.length} orphaned lab_analytes (not linked to any active test group).`);

  // 4. Delete Orphans
  for (const orphan of orphans) {
      console.log(`      🗑️ Deleting Orphan: ${orphan.lab_specific_name || 'Unnamed'} (GlobalID: ${orphan.analyte_id})`);
      
      const { error } = await supabase
          .from('lab_analytes')
          .delete()
          .eq('id', orphan.id);

      if (error) {
          console.error(`         ❌ Failed to delete orphan ${orphan.id}: ${error.message} (Likely used in results?)`);
      } else {
          console.log(`         ✅ Deleted.`);
      }
  }

  console.log("✅ Cleanup Complete.");
}

main().catch(console.error);
