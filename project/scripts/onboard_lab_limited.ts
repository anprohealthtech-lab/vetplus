
import { createClient } from "@supabase/supabase-js";

// --- Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL || "https://api.limsapp.in";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcWh6YmtrcmFkZmx5d2FyaWVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjI1NDYwOCwiZXhwIjoyMDY3ODMwNjA4fQ.NzWfj0DJXBzr3RQqCzAZxioND8cZn8z8tFmZ00upH7U";

const TARGET_LAB_ID = "f3b9a6e4-9c2d-4a7e-b6a4-8e1f2d9a5c77"; // Hardcoded for this run

async function main() {
  console.log(`🚀 Starting Limited Onboarding for Lab: ${TARGET_LAB_ID}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Verify Lab Exists
  const { data: lab, error: labError } = await supabase.from('labs').select('id, name').eq('id', TARGET_LAB_ID).single();
  if (labError || !lab) {
      console.error("❌ Lab not found or error:", labError?.message);
      process.exit(1);
  }
  console.log(`   ✅ Hub Found: ${lab.name}`);

  // 2. Fetch Top 5 Global Tests (that have templates ideally)
  // We prioritize tests that HAVE a default_template_id to ensure full demonstration
  const { data: globalTests, error: gtError } = await supabase
      .from('global_test_catalog')
      .select('*')
      .not('default_template_id', 'is', null) // Only fetch ones with templates ready
      .limit(15);

  if (gtError) { console.error("❌ Failed to fetch global tests:", gtError.message); process.exit(1); }

  console.log(`   🔍 Found ${globalTests.length} global tests to import.`);

  // 3. Loop and Onboard
  for (const globalTest of globalTests) {
      console.log(`   👉 Processing: ${globalTest.name}`);

      // A. Check if Test Group already exists for this lab (by Code)
      const { data: existingTest } = await supabase
          .from('test_groups')
          .select('id')
          .eq('lab_id', TARGET_LAB_ID)
          .eq('code', globalTest.code)
          .single();

      let newTestId = existingTest?.id;

      if (existingTest) {
          console.log(`      ⏩ Test already exists (ID: ${existingTest.id}). Checking for template...`);
      } else {
          // B. Create Test Group
          const { data: newTest, error: createError } = await supabase
              .from('test_groups')
              .insert({
                  lab_id: TARGET_LAB_ID,
                  name: globalTest.name,
                  code: globalTest.code,
                  category: globalTest.category || 'General',
                  clinical_purpose: globalTest.clinical_purpose || 'Diagnostic Test',
                  description: globalTest.description,
                  price: globalTest.default_price || 500,
                  turnaround_time: '24 Hours',
                  sample_type: 'EDTA Blood',
                  is_active: true
              })
              .select('id')
              .single();

          if (createError) {
              console.error(`      ❌ Failed to create test group:`, createError.message);
              continue;
          }
          newTestId = newTest.id;
          console.log(`      ✅ Created Test Group: ${newTestId}`);
          
          // Link Analytes only for NEW tests (assuming existing ones handle their own analytes)
           // ... (Analyte linking code) ...
          // C. Link Analytes
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

              const { error: linkError } = await supabase
                  .from('test_group_analytes')
                  .insert(analyteLinks);
              
              if (linkError) {
                  console.error(`      ⚠️ Failed to link analytes:`, linkError.message);
              } else {
                  console.log(`      🔗 Linked ${analyteIds.length} analytes.`);
              }
          }
      }

      // D. Clone Template (Run for BOTH New and Existing)
      if (globalTest.default_template_id && newTestId) {
          // Check if Lab Template already exists for this test group
          const { data: existingTemplate } = await supabase
            .from('lab_templates')
            .select('id')
            .eq('lab_id', TARGET_LAB_ID)
            .eq('test_group_id', newTestId)
            .single();
            
          if (existingTemplate) {
             console.log(`      ⏩ Template already exists for this test group.`);
          } else {
              const { data: globalTemplate } = await supabase
                  .from('global_template_catalog')
                  .select('*')
                  .eq('id', globalTest.default_template_id)
                  .single();

              if (globalTemplate) {
                  const { error: tmplError } = await supabase
                      .from('lab_templates')
                      .insert({
                          lab_id: TARGET_LAB_ID,
                          test_group_id: newTestId,
                          template_name: `Report - ${globalTest.name}`,
                          category: 'report',
                          gjs_html: globalTemplate.html_content,
                          gjs_css: globalTemplate.css_content,
                          is_default: false, // Must be false for specific test templates
                          is_active: true
                      });

                  if (tmplError) {
                      console.error(`      ⚠️ Failed to clone template:`, tmplError.message);
                  } else {
                      console.log(`      📄 Cloned Global Template to Lab Templates.`);
                  }
              }
          }
      }
  }

  console.log("✅ Limited Onboarding Complete!");
}

main().catch(console.error);
