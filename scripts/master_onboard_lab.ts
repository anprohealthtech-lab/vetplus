
import { createClient } from "@supabase/supabase-js";

// --- Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL || "https://api.limsapp.in";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcWh6YmtrcmFkZmx5d2FyaWVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjI1NDYwOCwiZXhwIjoyMDY3ODMwNjA4fQ.NzWfj0DJXBzr3RQqCzAZxioND8cZn8z8tFmZ00upH7U";

const TARGET_LAB_ID = process.argv[2]; 

// Helper to pause
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  if (!TARGET_LAB_ID) {
    console.error("❌ Please provide a LAB_ID as an argument.");
    console.error("   Usage: npx tsx scripts/master_onboard_lab.ts <LAB_ID>");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  console.log(`🚀 Starting MASTER Onboarding Process for Lab: ${TARGET_LAB_ID}`);

  // --- Step 1: Onboard from Global ---
  console.log("\n--- STEP 1: Onboard Missing Global Tests ---");
  await onboardGlobal(supabase);

  // --- Step 2: Deduplicate Test Groups ---
  console.log("\n--- STEP 2: Deduplicate Test Groups ---");
  await deduplicateTests(supabase);

  // --- Step 3: Cleanup Orphaned Lab Analytes ---
  console.log("\n--- STEP 3: Cleanup Orphaned Lab Analytes ---");
  await cleanupLabAnalytes(supabase);

  console.log("\n✅✅ MASTER PROCESS COMPLETE ✅✅");
}

/* =========================================================================
   STEP 1: ONBOARD FROM GLOBAL
   ========================================================================= */
async function onboardGlobal(supabase: any) {
  const { data: globalTests } = await supabase.from('global_test_catalog').select('*');
  if (!globalTests) return;
  console.log(`   🔍 Found ${globalTests.length} global tests.`);

  for (const globalTest of globalTests) {
      // Check if Exists (Limit 1 to avoid crash on duplicates)
      const { data: existingTests } = await supabase
          .from('test_groups')
          .select('id')
          .eq('lab_id', TARGET_LAB_ID)
          .eq('code', globalTest.code)
          .limit(1);

      const existingTest = existingTests && existingTests.length > 0 ? existingTests[0] : null;
      let newTestId = existingTest?.id;

      if (existingTest) {
          // console.log(`      ⏩ Test already exists (${globalTest.code}). Checking template...`);
      } else {
          // Create New
          const { data: newTest, error: createError } = await supabase
              .from('test_groups')
              .insert({
                  lab_id: TARGET_LAB_ID,
                  name: globalTest.name,
                  code: globalTest.code,
                  category: globalTest.category || 'General',
                  clinical_purpose: globalTest.clinical_purpose || 'Diagnostic Test',
                  description: globalTest.description,
                  price: globalTest.default_price || 0,
                  turnaround_time: '24 Hours',
                  sample_type: 'EDTA Blood', // Default safer value
                  is_active: true
              })
              .select('id')
              .single();

          if (createError) {
              console.error(`      ❌ Failed to create ${globalTest.code}:`, createError.message);
              continue;
          }
          newTestId = newTest.id;
          console.log(`      ✅ Created Test Group: ${globalTest.code}`);

          // Link Analytes logic...
          let analyteIds: string[] = [];
          if (Array.isArray(globalTest.analytes)) {
              analyteIds = globalTest.analytes as string[];
          } else if (typeof globalTest.analytes === 'string') {
              try { analyteIds = JSON.parse(globalTest.analytes); } catch (e) {}
          }

          if (analyteIds.length > 0) {
              const analyteLinks = analyteIds.map(aId => ({
                  test_group_id: newTestId,
                  analyte_id: aId,
                  is_visible: true
              }));
              await supabase.from('test_group_analytes').insert(analyteLinks);
          }
      }

      // Template Check
      if (globalTest.default_template_id && newTestId) {
           const { data: existingTemplate } = await supabase.from('lab_templates')
              .select('id').eq('lab_id', TARGET_LAB_ID).eq('test_group_id', newTestId).single();
           
           if (!existingTemplate) {
               const { data: gTmpl } = await supabase.from('global_template_catalog').select('*').eq('id', globalTest.default_template_id).single();
               if (gTmpl) {
                   await supabase.from('lab_templates').insert({
                       lab_id: TARGET_LAB_ID,
                       test_group_id: newTestId,
                       template_name: `Report - ${globalTest.name}`,
                       category: 'report',
                       gjs_html: gTmpl.html_content,
                       gjs_css: gTmpl.css_content,
                       is_default: false,
                       is_active: true
                   });
                   console.log(`      📄 Cloned Template for ${globalTest.code}`);
               }
           }
      }
  }
}

/* =========================================================================
   STEP 2: DEDUPLICATE TESTS
   ========================================================================= */
async function deduplicateTests(supabase: any) {
  // 1. Fetch Tests
  const { data: allTests } = await supabase.from('test_groups')
    .select('id, name, code, created_at').eq('lab_id', TARGET_LAB_ID);
  if (!allTests || allTests.length === 0) return;

  // 2. Fetch Helper Data (Analyte Counts, Templates, Usage)
  const { data: allLinks } = await supabase.from('test_group_analytes').select('test_group_id');
  const analyteCounts: Record<string, number> = {};
  allLinks?.forEach((Link: any) => analyteCounts[Link.test_group_id] = (analyteCounts[Link.test_group_id] || 0) + 1);

  const { data: templates } = await supabase.from('lab_templates').select('test_group_id')
    .eq('lab_id', TARGET_LAB_ID).not('test_group_id', 'is', null);
  const hasTemplateMap = new Set(templates?.map((t: any) => t.test_group_id) || []);

  const { data: usedTests } = await supabase.from('order_tests').select('test_group_id');
  const usedTestIds = new Set(usedTests?.map((u: any) => u.test_group_id) || []);

  // 3. Group
  const groups: Record<string, any[]> = {};
  for (const test of allTests) {
      const key = (test.code || 'UNKNOWN').trim().toUpperCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push({
          ...test,
          analyteCount: analyteCounts[test.id] || 0,
          hasTemplate: hasTemplateMap.has(test.id),
          isUsed: usedTestIds.has(test.id)
      });
  }

  // 4. Process
  let deleteCount = 0;
  for (const [code, candidates] of Object.entries(groups)) {
      if (candidates.length <= 1) continue;

      // Sort: Used > Template > Analytes > Latest
      candidates.sort((a, b) => {
          if (a.isUsed !== b.isUsed) return a.isUsed ? -1 : 1;
          if (a.hasTemplate !== b.hasTemplate) return a.hasTemplate ? -1 : 1;
          if (b.analyteCount !== a.analyteCount) return b.analyteCount - a.analyteCount;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      const keeper = candidates[0];
      const losers = candidates.slice(1);

      console.log(`   🔸 Deduping '${code}': Keeping '${keeper.name}'`);

      for (const loser of losers) {
          if (loser.isUsed) {
              console.log(`      ⚠️ ID ${loser.id} is duplicate but USED. Skipping.`);
          } else {
              // Delete safely
              const { error } = await supabase.from('test_groups').delete().eq('id', loser.id);
              if (!error) {
                  console.log(`      🗑️ Deleted duplicate: ${loser.id}`);
                  deleteCount++;
              }
          }
      }
  }
  console.log(`   ✨ Deleted ${deleteCount} unused duplicates.`);
}

/* =========================================================================
   STEP 3: CLEANUP LAB ANALYTES
   ========================================================================= */
async function cleanupLabAnalytes(supabase: any) {
  // 1. Get Active Test Groups -> Active Analytes
  const { data: testGroups } = await supabase.from('test_groups').select('id').eq('lab_id', TARGET_LAB_ID);
  const testGroupIds = testGroups?.map((tg: any) => tg.id) || [];
  
  if (testGroupIds.length === 0) return;

  const { data: linkedAnalytes } = await supabase.from('test_group_analytes')
      .select('analyte_id').in('test_group_id', testGroupIds);
  const usedAnalyteIds = new Set(linkedAnalytes?.map((l: any) => l.analyte_id) || []);

  // 2. Scan Lab Analytes
  const { data: labAnalytes } = await supabase.from('lab_analytes').select('id, analyte_id, lab_specific_name')
      .eq('lab_id', TARGET_LAB_ID);
  
  if (!labAnalytes) return;

  const orphans = labAnalytes.filter((la: any) => !usedAnalyteIds.has(la.analyte_id));
  
  if (orphans.length > 0) {
      console.log(`   🗑️ Finding ${orphans.length} orphaned lab_analytes.`);
      for (const orphan of orphans) {
          const { error } = await supabase.from('lab_analytes').delete().eq('id', orphan.id);
          if (!error) console.log(`      ✅ Deleted orphan linked to GlobalID: ${orphan.analyte_id}`);
      }
  } else {
      console.log("   ✅ No orphans found.");
  }
}

main().catch(console.error);
