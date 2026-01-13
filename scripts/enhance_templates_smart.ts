/**
 * Smart Template Enhancement Script
 * 
 * Two-step process:
 * 1. Bulk update Global CSS for all templates
 * 2. Generate interpretation content ONLY using AI + knowledge base
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const DO_AGENT_ENDPOINT = 'https://sirvwszn3jrtvmxtnirmvwjz.agents.do-ai.run/api/v1/chat/completions';
const DO_AGENT_KEY = '__DCbWcpyImSHl0kDwhSVAY5Afe2NjQp';

// Fixed Global CSS
const GLOBAL_CSS = `
:root{--primary-blue:#0b4aa2;--light-blue:#eaf2ff;--success-green:#12b76a;--warning-amber:#f79009;--danger-red:#d92d20;--text-dark:#1f2937;--text-muted:#64748b;--border-light:#e5ecf6;--row-alt:#f7faff;--page-bg:#ffffff;--card-bg:#ffffff;}
html,body{margin:0;padding:0;width:100%;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:var(--text-dark);background:var(--page-bg);}
figure.table{margin:12px 0;width:100%!important;max-width:100%!important;}
figure.table table,.patient-info,.report-table,.tbl-meta,.tbl-results,.tbl-interpretation{width:100%!important;max-width:100%!important;border-collapse:collapse;box-sizing:border-box;}
.patient-info,.report-table,.tbl-meta,.tbl-results,.tbl-interpretation{border:1px solid var(--border-light);border-radius:10px;overflow:hidden;background:#fff;}
.patient-info td,.report-table td,.tbl-meta td,.tbl-results td,.tbl-interpretation td{border:1px solid var(--border-light);padding:10px 12px;font-size:13px;word-break:break-word;}
.report-table thead th,.tbl-results thead th,.tbl-interpretation thead th{background:var(--primary-blue)!important;color:#fff!important;font-weight:900;}
.note{margin-top:14px;padding:12px 14px;border-left:4px solid var(--primary-blue);background:#f8fafc;font-size:13px;font-style:italic;}
`.trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * STEP 1: Bulk update CSS for all templates
 */
async function bulkUpdateCSS() {
  console.log('\n📦 STEP 1: Bulk Updating Global CSS...\n');
  
  const { data: templates, error: fetchError } = await supabase
    .from('global_template_catalog')
    .select('id, name')
    .eq('type', 'report_body');

  if (fetchError) throw new Error(fetchError.message);
  
  console.log(`Found ${templates.length} templates`);

  for (const template of templates) {
    const { error } = await supabase
      .from('global_template_catalog')
      .update({ css_content: GLOBAL_CSS })
      .eq('id', template.id);

    if (error) {
      console.log(`   ❌ ${template.name}: ${error.message}`);
    } else {
      console.log(`   ✅ ${template.name}`);
    }
  }
}

/**
 * Generate interpretation content using AI + KB
 */
async function generateInterpretation(testName: string): Promise<string> {
  const prompt = `Generate clinical interpretation for: ${testName}

Use your knowledge base to provide accurate, test-specific information.
Return ONLY the HTML block (no markdown, no extra text).`;

  const response = await fetch(DO_AGENT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DO_AGENT_KEY}`
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      include_retrieval_info: true  // Enable knowledge base
    })
  });

  if (!response.ok) {
    throw new Error(`Agent error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * STEP 2: Add interpretation sections
 */
async function addInterpretations() {
  console.log('\n📚 STEP 2: Generating Interpretation Sections...\n');
  
  const { data: templates, error } = await supabase
    .from('global_template_catalog')
    .select('id, name, html_content')
    .eq('type', 'report_body')
    .limit(5);  // Process 5 at a time

  if (error) throw new Error(error.message);

  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    console.log(`\n[${i + 1}/${templates.length}] ${template.name}`);
    
    try {
      // Check if interpretation already exists
      if (template.html_content.includes('Clinical Interpretation')) {
        console.log('   ⚠️  Already has interpretation, skipping');
        continue;
      }

      console.log('   🤖 Asking AI + knowledge base...');
      const interpretationHtml = await generateInterpretation(template.name);
      
      // Find where to insert (after results table, before footer/signatures)
      let updatedHtml = template.html_content;
      
      // Strategy: Insert before footer or at end
      const footerMarkers = [
        '</figure>\n</section>',  // Before closing section
        '<div class="footer',      // Before footer div
        '<div class="signature',   // Before signatures
        '</body>',                 // Before body close (shouldn't be there but just in case)
      ];

      let inserted = false;
      for (const marker of footerMarkers) {
        if (updatedHtml.includes(marker)) {
          updatedHtml = updatedHtml.replace(marker, `\n${interpretationHtml}\n\n${marker}`);
          inserted = true;
          break;
        }
      }

      if (!inserted) {
        // Fallback: append at end
        updatedHtml += `\n\n${interpretationHtml}`;
      }

      console.log('   💾 Updating database...');
      const { error: updateError } = await supabase
        .from('global_template_catalog')
        .update({ html_content: updatedHtml })
        .eq('id', template.id);

      if (updateError) throw updateError;
      
      console.log('   ✅ Success!');
      
      // Rate limit
      if (i < templates.length - 1) {
        console.log('   ⏳ Waiting 3s...');
        await new Promise(r => setTimeout(r, 3000));
      }
      
    } catch (err) {
      console.error(`   ❌ Failed: ${err.message}`);
    }
  }
}

/**
 * Main process
 */
async function main() {
  console.log('🚀 Smart Template Enhancement');
  console.log('='.repeat(60));

  // Step 1: Bulk update CSS
  await bulkUpdateCSS();

  // Step 2: Add interpretations
  await addInterpretations();

  console.log('\n' + '='.repeat(60));
  console.log('\n🎉 Enhancement Complete!\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  });
