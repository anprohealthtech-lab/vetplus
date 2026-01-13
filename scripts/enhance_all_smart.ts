/**
 * Smart Template Enhancement - Quality Check & Regenerate
 * 
 * Only regenerates interpretations that are:
 * - Too short (< 500 characters)
 * - Generic (doesn't contain medical specifics)
 * - Missing
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DO_AGENT_ENDPOINT = 'https://sirvwszn3jrtvmxtnirmvwjz.agents.do-ai.run/api/v1/chat/completions';
const DO_AGENT_KEY = '__DCbWcpyImSHl0kDwhSVAY5Afe2NjQp';

const GLOBAL_CSS = `:root{--primary-blue:#0b4aa2;--light-blue:#eaf2ff;--success-green:#12b76a;--warning-amber:#f79009;--danger-red:#d92d20;--text-dark:#1f2937;--text-muted:#64748b;--border-light:#e5ecf6;--row-alt:#f7faff;--page-bg:#ffffff;--card-bg:#ffffff;}html,body{margin:0;padding:0;width:100%;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:var(--text-dark);background:var(--page-bg);}figure.table{margin:12px 0;width:100%!important;max-width:100%!important;}figure.table table,.patient-info,.report-table,.tbl-meta,.tbl-results,.tbl-interpretation{width:100%!important;max-width:100%!important;border-collapse:collapse;box-sizing:border-box;}.patient-info,.report-table,.tbl-meta,.tbl-results,.tbl-interpretation{border:1px solid var(--border-light);border-radius:10px;overflow:hidden;background:#fff;}.patient-info td,.report-table td,.tbl-meta td,.tbl-results td,.tbl-interpretation td{border:1px solid var(--border-light);padding:10px 12px;font-size:13px;word-break:break-word;}.report-table thead th,.tbl-results thead th,.tbl-interpretation thead th{background:var(--primary-blue)!important;color:#fff!important;font-weight:900;}.note{margin-top:14px;padding:12px 14px;border-left:4px solid var(--primary-blue);background:#f8fafc;font-size:13px;font-style:italic;}`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Extract existing interpretation section from HTML
 */
function extractInterpretation(html: string): string | null {
  const start = html.indexOf('<div class="section-header">Clinical Interpretation</div>');
  if (start === -1) return null;
  
  const endMarker = '</div>\n\n</section>';
  const end = html.indexOf(endMarker, start);
  if (end === -1) {
    // Try alternative end markers
    const altEnd = html.indexOf('</section>', start);
    if (altEnd === -1) return null;
    return html.substring(start, altEnd);
  }
  
  return html.substring(start, end + 6); // Include closing </div>
}

/**
 * Check if interpretation needs regeneration
 */
function needsRegeneration(interpretation: string | null, templateName: string): { needed: boolean; reason: string } {
  if (!interpretation) {
    return { needed: true, reason: 'Missing interpretation' };
  }

  // Check length (too short = generic/poor quality)
  if (interpretation.length < 500) {
    return { needed: true, reason: `Too short (${interpretation.length} chars)` };
  }

  // Check for generic content markers
  const genericPhrases = [
    'may suggest inflammation/infection',
    'correlate clinically',
    'Results within reference ranges'
  ];
  
  const specificMarkers = [
    'HbA1c',
    'diabetes',
    'prediabetes',
    'glucose',
    'cholesterol',
    'triglycerides',
    'hemoglobin',
    'platelet',
    'white blood cell',
    'anemia',
    'thyroid',
    'kidney',
    'liver'
  ];

  // Count generic vs specific content
  const genericCount = genericPhrases.filter(p => interpretation.toLowerCase().includes(p.toLowerCase())).length;
  const specificCount = specificMarkers.filter(m => interpretation.toLowerCase().includes(m.toLowerCase())).length;

  // If mostly generic and no specific terms, needs regeneration
  if (genericCount >= 2 && specificCount === 0) {
    return { needed: true, reason: 'Too generic (no specific medical terms)' };
  }

  return { needed: false, reason: 'Good quality' };
}

/**
 * Remove old interpretation section
 */
function removeInterpretation(html: string): string {
  const interpretation = extractInterpretation(html);
  if (!interpretation) return html;
  
  return html.replace(interpretation, '').replace(/\n\n\n+/g, '\n\n');
}

/**
 * Generate new interpretation
 */
async function generateInterpretation(testName: string): Promise<string> {
  const response = await fetch(DO_AGENT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DO_AGENT_KEY}`
    },
    body: JSON.stringify({
      messages: [{
        role: 'user',
        content: `Generate clinical interpretation for: ${testName}\n\nUse your knowledge base. Return ONLY the HTML block.`
      }],
      stream: false,
      include_retrieval_info: true
    })
  });

  if (!response.ok) throw new Error(`Agent error: ${response.status}`);
  
  const data = await response.json();
  return data.choices[0].message.content;
}

async function main() {
  console.log('🚀 Smart Template Enhancement (Quality Check)\n');
  console.log('='.repeat(60));

  // Fetch ALL templates
  const { data: templates, error } = await supabase
    .from('global_template_catalog')
    .select('id, name, html_content, css_content')
    .eq('type', 'report_body');

  if (error || !templates) {
    console.error('❌ Error fetching templates:', error);
    return;
  }

  console.log(`\n✅ Found ${templates.length} templates\n`);

  let processed = 0;
  let skipped = 0;
  let regenerated = 0;
  let cssUpdated = 0;
  let failed = 0;

  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    console.log(`\n[${i + 1}/${templates.length}] ${template.name}`);

    try {
      if (!template.html_content) {
        console.log('   ⚠️  Null HTML, skipping');
        skipped++;
        continue;
      }

      // Always update CSS
      console.log('   📦 Updating CSS...');
      await supabase
        .from('global_template_catalog')
        .update({ css_content: GLOBAL_CSS })
        .eq('id', template.id);
      cssUpdated++;

      // Check interpretation quality
      const existingInterp = extractInterpretation(template.html_content);
      const qualityCheck = needsRegeneration(existingInterp, template.name);

      if (!qualityCheck.needed) {
        console.log(`   ✅ ${qualityCheck.reason}, keeping existing`);
        processed++;
        continue;
      }

      console.log(`   🔄 ${qualityCheck.reason}, regenerating...`);

      // Remove old interpretation
      let cleanHtml = removeInterpretation(template.html_content);

      // Generate new interpretation
      console.log('   🤖 Asking AI + knowledge base...');
      const newInterp = await generateInterpretation(template.name);

      // Insert new interpretation
      if (cleanHtml.includes('</figure>\n</section>')) {
        cleanHtml = cleanHtml.replace('</figure>\n</section>', `</figure>\n\n${newInterp}\n\n</section>`);
      } else {
        cleanHtml += `\n\n${newInterp}`;
      }

      // Update database
      await supabase
        .from('global_template_catalog')
        .update({ html_content: cleanHtml })
        .eq('id', template.id);

      console.log('   ✅ Regenerated!');
      regenerated++;
      processed++;

      // Rate limit
      if (i < templates.length - 1 && qualityCheck.needed) {
        console.log('   ⏳ Waiting 3s...');
        await new Promise(r => setTimeout(r, 3000));
      }

    } catch (err: any) {
      console.error(`   ❌ Failed: ${err.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Summary:');
  console.log(`   Total processed: ${processed}`);
  console.log(`   CSS updated: ${cssUpdated}`);
  console.log(`   Interpretations regenerated: ${regenerated}`);
  console.log(`   Skipped (null HTML): ${skipped}`);
  console.log(`   Failed: ${failed}`);
  console.log('\n🎉 Done!\n');
}

main().then(() => process.exit(0)).catch(console.error);
