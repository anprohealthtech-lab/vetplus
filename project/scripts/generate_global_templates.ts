
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

// --- Configuration (from environment variables) ---
const SUPABASE_URL = process.env.SUPABASE_URL || "https://api.limsapp.in";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ""; 

// --- Interfaces ---
interface AnalyteInfo {
  id: string;
  name: string;
  code: string;
  unit: string;
  reference_range: string;
  category: string;
  description: string;
  low_critical: string | null;
  high_critical: string | null;
  interpretation_low: string | null;
  interpretation_normal: string | null;
  interpretation_high: string | null;
  is_header?: boolean;
}

interface TestGroup {
  id: string;
  name: string;
  clinical_purpose: string;
  analytes: string[]; // List of analyte IDs
}

interface GeneratedTemplate {
  name: string;
  html_content: string;
  css_content: string;
  test_group_id?: string;
}

// --- Main Logic ---
async function main() {
  console.log("🚀 Starting Template Generation Script (Claude 3.5 Haiku)...");

  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY.includes("YOUR_")) {
    console.error("❌ ANTHROPIC_API_KEY is missing/invalid.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  // 1. Fetch Global Test Groups that don't have templates yet
  // For now, we'll just fetch all global tests and generate/update templates for them
  console.log("🔍 Fetching Global Test Catalog...");
  const { data: testGroups, error: tgError } = await supabase
    .from('global_test_catalog')
    .select('*')
    .order('created_at', { ascending: false });

  if (tgError) { console.error("❌ Error fetching test groups:", tgError); process.exit(1); }
  
  // Process ALL tests, but check if they already have a template to skip them
  const processingBatch = testGroups; 
  console.log(`🔍 Found ${testGroups.length} tests. Starting batch processing...`);

  let count = 0;
  for (const test of processingBatch) {
    if (test.default_template_id) {
        // Skip if already has a template (remove this check if you want to overwrite all)
        console.log(`   ⏩ Skipping ${test.name} (Template already exists)`);
        continue;
    }

    await processTestTemplate(test, anthropic, supabase);
    count++;
    
    // Rate limit: Sleep 2 seconds between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Every 10 requests, take a longer break
    if (count % 10 === 0) {
        console.log("   ⏳ Taking a short break to respect API rate limits...");
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

async function processTestTemplate(test: any, anthropic: Anthropic, supabase: any) {
  console.log(`   👉 Generating Template for: "${test.name}"`);

  // 1. Fetch Analyte Details
  let analyteIds: string[] = [];
  if (Array.isArray(test.analytes)) {
      analyteIds = test.analytes;
  } else if (typeof test.analytes === 'string') {
      try { analyteIds = JSON.parse(test.analytes); } catch (e) {}
  }

  if (analyteIds.length === 0) {
      console.log(`      ⚠️  No analytes linked to ${test.name}. Skipping template generation.`);
      return;
  }

  const { data: analytesData, error: anaError } = await supabase
      .from('analytes')
      .select('*')
      .in('id', analyteIds);

  if (anaError || !analytesData) {
       console.error(`      ❌ Error fetching analytes for ${test.name}:`, anaError?.message);
       return;
  }

  const analytes: AnalyteInfo[] = analytesData;

    // 2. Generate Template with AI
    const analyteInstructions = analytes.map(a => 
        `- ${a.name} (Code: ${a.code}): Use {{ANALYTE_${a.code}_VALUE}}, {{ANALYTE_${a.code}_UNIT}}, {{ANALYTE_${a.code}_REFERENCE}}, {{ANALYTE_${a.code}_FLAG}}`
    ).join('\n');

    const prompt = `
    You are a professional Medical Report Designer.
    Create a PREMIUM, High-Quality HTML/CSS template for the Lab Test: "${test.name}".
    
    CRITICAL: You must use the "Gold Standard" HTML Structure below. 
    The layout must be attractive, professional, and audit-compliant.
    
    HTML Structure (Strictly Follow Class Names):
    <div class="report-container">
      <div class="report-header">
         <h1>${test.name}</h1>
         <div class="report-subtitle">${test.clinical_purpose || 'Laboratory Test Report'}</div>
      </div>
      
      <div class="report-body">
         <div class="section-header">Patient Information</div>
         <table class="patient-info">
           <tbody>
             <tr>
               <td class="label">Patient Name</td> <td class="value">{{patientName}}</td>
               <td class="label">Patient ID</td> <td class="value">{{patientId}}</td>
             </tr>
             <tr>
               <td class="label">Age / Gender</td> <td class="value">{{patientAge}} / {{patientGender}}</td>
               <td class="label">Sample ID</td> <td class="value">{{sampleId}}</td>
             </tr>
             <tr>
               <td class="label">Ref. Doctor</td> <td class="value">{{referringDoctorName}}</td>
               <td class="label">Collected On</td> <td class="value">{{collectionDate}}</td>
             </tr>
           </tbody>
         </table>
         
         <div class="section-header">Test Results</div>
         <table class="report-table">
           <thead>
             <tr>
               <th>Test Parameter</th>
               <th class="col-center">Result</th>
               <th class="col-center">Unit</th>
               <th>Reference Range</th>
               <th class="col-center">Flag</th>
             </tr>
           </thead>
           <tbody>
             <!-- ONE ROW PER ANALYTE BELOW -->
             <!-- Examples: -->
             <!-- <tr>  
                    <td class="param-name">Hemoglobin</td> 
                    <td class="col-center value-optimal">{{ANALYTE_HB_VALUE}}</td> 
                    <td class="col-center">{{ANALYTE_HB_UNIT}}</td> 
                    <td>{{ANALYTE_HB_REFERENCE}}</td> 
                    <td class="col-center">{{ANALYTE_HB_FLAG}}</td>
                  </tr> -->
           </tbody>
         </table>
         
         <!-- Optional Interpretation -->
         <div class="interpretation" style="margin-top:20px; padding:15px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
           <h4 style="margin:0 0 8px; color:#334155;">Clinical Interpretation</h4>
           <div style="font-size:13px; color:#475569;">
             <!-- Add static interpretation text here if available -->
           </div>
         </div>
         
         <div class="report-footer">
           <div class="signatures">
              <p style="font-weight:bold; margin-bottom:4px;">{{signatoryName}}</p>
              <p style="font-size:11px; color:#64748b;">{{signatoryDesignation}}</p>
           </div>
         </div>
      </div>
    </div>
    
    Analytes to Generate Rows For:
    ${analyteInstructions}
    
    CSS Requirement:
    Return the following EXACT CSS in the css_content field (you may minify it slightly if needed, but keep all rules):
    
    /* Theme tokens */
    :root { --primary-blue:#0b4aa2; --light-blue:#eaf2ff; --success-green:#12b76a; --warning-amber:#f79009; --danger-red:#d92d20; --text-dark:#1f2937; --text-muted:#64748b; --border-light:#e5ecf6; --row-alt:#f7faff; --page-bg:#f4f7fb; --card-bg:#ffffff; }
    body { margin:0; padding:24px; font-family: Inter, sans-serif; color:var(--text-dark); background:var(--page-bg); }
    .report-container { max-width:900px; margin:0 auto; background:var(--card-bg); border-radius:14px; overflow:hidden; border:1px solid var(--border-light); box-shadow:0 8px 24px rgba(0,60,120,.08); }
    .report-header { background-color:var(--primary-blue) !important; color:#fff !important; padding:16px 20px; }
    .report-header h1 { margin:0; font-size:20px; font-weight:800; }
    .report-header .report-subtitle { margin-top:4px; font-size:13px; opacity:.92; }
    .report-body { padding:18px 20px 20px; }
    .section-header { background-color:var(--light-blue) !important; color:var(--primary-blue) !important; padding:10px 14px; border-radius:8px; font-weight:800; font-size:15px; margin:18px 0 12px; border:1px solid rgba(11,74,162,.12); }
    .patient-info, .report-table { width:100%; border-collapse:separate; border-spacing:0; background:#fff; border:1px solid var(--border-light); border-radius:12px; overflow:hidden; font-size:13px; }
    .patient-info td, .report-table td { padding:10px 12px; border-bottom:1px solid var(--border-light); vertical-align:middle; }
    .patient-info td.label { width:140px; color:var(--text-muted); font-weight:700; background:#fbfdff; }
    .patient-info td.value { font-weight:700; color:var(--text-dark); }
    .report-table thead th { background-color:var(--primary-blue) !important; color:#fff !important; padding:10px 12px; text-align:left; font-weight:800; font-size:13px; }
    .report-table tbody tr:nth-child(even) { background:var(--row-alt); }
    .param-name { font-weight:800; color:#0f172a; }
    .col-center { text-align:center; }
    .value-high { color:var(--danger-red); font-weight:900; }
    .value-borderline { color:var(--warning-amber); font-weight:900; }
    .value-optimal { color:var(--success-green); font-weight:900; }
    
    Return JSON ONLY:
    {
       "html_content": "...",
       "css_content": "..."
    }
    `;

    let templateData;
    let jsonStr: string;
    try {
        const msg = await anthropic.messages.create({
            model: "claude-3-5-haiku-20241022",
            max_tokens: 6000, // Bump to 6000 for large templates
            messages: [{ role: "user", content: prompt + "\n\nIMPORTANT: Output ONLY valid JSON. Ensure all HTML strings are properly escaped." }],
        });

        const textBlock = msg.content[0];
        if (textBlock.type !== 'text') throw new Error("Unexpected response");
        
        jsonStr = textBlock.text;
        
        // 1. Strip Markdown Code Blocks
        jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '');

        // 2. Find first distinct '{'
        const firstOpen = jsonStr.indexOf('{');
        if (firstOpen !== -1) {
            jsonStr = jsonStr.substring(firstOpen);
        }
        
        // 3. Find last distinct '}'
        const lastClose = jsonStr.lastIndexOf('}');
        if (lastClose !== -1) {
            jsonStr = jsonStr.substring(0, lastClose + 1);
        }
        
        // 4. Trim whitespace
        jsonStr = jsonStr.trim();

        templateData = JSON.parse(jsonStr);

    } catch (apiError: any) {
        console.error(`      ❌ API Call or Initial Parsing Failed for ${test.name}:`, apiError.message);
        return; // Stop processing this test if API call or initial parsing fails
    }

    // 3. Save to Global Template Catalog
    try {
        const { data: newTemplate, error: insError } = await supabase
            .from('global_template_catalog')
            .insert({
                name: `Master Template - ${test.name}`,
                type: 'report_body',
                html_content: templateData.html_content,
                css_content: templateData.css_content,
                is_default: true
            })
            .select('id')
            .single();
        
        if (insError) {
            console.error(`      ❌ Error saving template:`, insError.message);
        } else {
            console.log(`      ✅ Template Created: ${newTemplate.id}`);
            
            const { error: linkError } = await supabase
                .from('global_test_catalog')
                .update({ default_template_id: newTemplate.id }) 
                .eq('id', test.id);
                
             if (linkError) {
                 console.warn(`      ⚠️ Could not link template to test: ${linkError.message}`);
             } else {
                 console.log(`      🔗 Linked template to test: ${test.name}`);
             }
        }
    } catch (dbErr: any) {
         console.error(`      ❌ Database Error:`, dbErr.message);
    }
}

main().catch(console.error);
