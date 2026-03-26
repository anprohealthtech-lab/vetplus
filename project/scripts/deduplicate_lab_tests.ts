
import { createClient } from "@supabase/supabase-js";

// --- Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL || "https://api.limsapp.in";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcWh6YmtrcmFkZmx5d2FyaWVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjI1NDYwOCwiZXhwIjoyMDY3ODMwNjA4fQ.NzWfj0DJXBzr3RQqCzAZxioND8cZn8z8tFmZ00upH7U";

const TARGET_LAB_ID = process.argv[2]; // Passed as argument

async function main() {
  if (!TARGET_LAB_ID) {
    console.error("❌ Please provide a LAB_ID as an argument.");
    process.exit(1);
  }

  console.log(`🧹 Starting Deduplication for Lab: ${TARGET_LAB_ID}`);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Fetch All Tests for Lab
  const { data: allTests, error } = await supabase
    .from('test_groups')
    .select('id, name, code, created_at')
    .eq('lab_id', TARGET_LAB_ID);

  if (error) {
    console.error("❌ Error fetching tests:", error.message);
    return;
  }
  
  // 2. Fetch Analyte Counts (Fetch all links for this lab's tests)
  // Optimization: Fetch just IDs and aggregate
  const { data: allLinks, error: linkError } = await supabase
    .from('test_group_analytes')
    .select('test_group_id');
    
  // Filter links for our tests (client-side join for simplicity if payload is handled)
  // or better: Map counts assuming we fetched enough. 
  // Note: strict RLS might limit this, but assuming script has admin/service role.
      
  const analyteCounts: Record<string, number> = {};
  if (allLinks) {
     for (const link of allLinks) {
         analyteCounts[link.test_group_id] = (analyteCounts[link.test_group_id] || 0) + 1;
     }
  }

  console.log(`   🔍 Checked ${allTests.length} total tests.`);

  // 3. Fetch Template Status
  const { data: templates } = await supabase
    .from('lab_templates')
    .select('test_group_id')
    .eq('lab_id', TARGET_LAB_ID)
    .not('test_group_id', 'is', null);

  const hasTemplateMap = new Set(templates?.map(t => t.test_group_id) || []);

  // 4. Fetch Usage Status (Check if used in orders)
  const { data: usedTests } = await supabase
    .from('order_tests')
    .select('test_group_id') // We just need IDs used
    // .in('test_group_id', allTests.map(t => t.id)) // Optional optimization if list is small
    ;
    
  const usedTestIds = new Set(usedTests?.map(u => u.test_group_id) || []);

  console.log(`   🔍 Checked ${allTests.length} total tests.`);

  // 5. Group by Code to Identify Duplicates
  const groups: Record<string, any[]> = {};
  
  for (const test of allTests) {
      // Normalize code: trim, uppercase
      const key = (test.code || 'UNKNOWN').trim().toUpperCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push({
          ...test,
          analyteCount: analyteCounts[test.id] || 0,
          hasTemplate: hasTemplateMap.has(test.id),
          isUsed: usedTestIds.has(test.id)
      });
  }

  const duplicatesToDelete: any[] = [];

  // 6. Select Keepers
  for (const [code, candidates] of Object.entries(groups)) {
      if (candidates.length > 1) {
          // Sort to find the "Best" one to keep as primary reference
          // 1. Is Used (Keep used ones first visually)
          // 2. Has Template
          // 3. Analyte Count
          // 4. Latest
          candidates.sort((a, b) => {
              if (a.isUsed !== b.isUsed) return a.isUsed ? -1 : 1;
              if (a.hasTemplate !== b.hasTemplate) return a.hasTemplate ? -1 : 1;
              if (b.analyteCount !== a.analyteCount) return b.analyteCount - a.analyteCount;
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });

          // Logic:
          // Keep the BEST one.
          // For the rest (Losers):
          //   - IF Used: SKIP (Don't touch).
          //   - IF Unused: DELETE.
          
          const keeper = candidates[0];
          const potentialLosers = candidates.slice(1);
          
          console.log(`   🔸 Group '${code}': Best Candidate '${keeper.name}' (Used: ${keeper.isUsed}, Template: ${keeper.hasTemplate}, Analytes: ${keeper.analyteCount})`);
          
          for (const loser of potentialLosers) {
              if (loser.isUsed) {
                  console.log(`      ⚠️ ID ${loser.id} is duplicate but USED in orders. SKIPPING deletion.`);
              } else {
                  console.log(`      🗑️ Marked for deletion: ID ${loser.id} (Unused)`);
                  duplicatesToDelete.push(loser);
              }
          }
      }
  }

  console.log(`   ⚠️ Found ${duplicatesToDelete.length} unused duplicates to remove.`);

  // 7. Delete ONLY Unused Duplicates
  for (const dup of duplicatesToDelete) {
     const { error: delError } = await supabase
        .from('test_groups')
        .delete()
        .eq('id', dup.id);

     if (delError) {
         console.error(`         ❌ Failed to delete ${dup.id}: ${delError.message}`);
     } else {
         console.log(`         ✅ Deleted ${dup.id}.`);
     }
  }

  console.log("✅ Deduplication Complete.");
}

main().catch(console.error);
