/**
 * Smart Template Enhancement - Process 5 templates only
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

async function main() {
  console.log('🚀 Template Enhancement (50 templates)\n');
  console.log('='.repeat(60));

  // Fetch 50 templates
  const { data: templates, error } = await supabase
    .from('global_template_catalog')
    .select('id, name, html_content, css_content')
    .eq('type', 'report_body')
    .limit(50);

  if (error || !templates) {
    console.error('❌ Error fetching templates:', error);
    return;
  }

  console.log(`\n✅ Found ${templates.length} templates\n`);

  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    console.log(`\n[${ i + 1}/${templates.length}] ${template.name}`);
    console.log(`   ID: ${template.id.substring(0, 8)}...`);

    try {
      // STEP 1: Update CSS
      console.log('   📦 Updating CSS...');
      await supabase
        .from('global_template_catalog')
        .update({ css_content: GLOBAL_CSS })
        .eq('id', template.id);

      // STEP 2: Add interpretation (if not exists)
      if (template.html_content.includes('Clinical Interpretation')) {
        console.log('   ⚠️  Already has interpretation');
      } else {
        console.log('   🤖 Generating interpretation...');
        
        // Call agent
        const response = await fetch(DO_AGENT_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DO_AGENT_KEY}`
          },
          body: JSON.stringify({
            messages: [{
              role: 'user',
              content: `Generate clinical interpretation for: ${template.name}\n\nReturn ONLY the HTML block (no markdown).`
            }],
            stream: false,
            include_retrieval_info: true
          })
        });

        if (response.ok) {
          const data = await response.json();
          const interpretationHtml = data.choices[0].message.content;

          // Insert interpretation
          let updatedHtml = template.html_content;
          if (updatedHtml.includes('</figure>\n</section>')) {
            updatedHtml = updatedHtml.replace('</figure>\n</section>', `</figure>\n\n${interpretationHtml}\n\n</section>`);
          } else {
            updatedHtml += `\n\n${interpretationHtml}`;
          }

          await supabase
            .from('global_template_catalog')
            .update({ html_content: updatedHtml })
            .eq('id', template.id);

          console.log('   💾 Interpretation added');
        }
      }

      console.log('   ✅ Complete!');

      if (i < templates.length - 1) {
        console.log('   ⏳ Waiting 3s...');
        await new Promise(r => setTimeout(r, 3000));
      }

    } catch (err: any) {
      console.error(`   ❌ Failed: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n🎉 Done!\n');
}

main().then(() => process.exit(0)).catch(console.error);
