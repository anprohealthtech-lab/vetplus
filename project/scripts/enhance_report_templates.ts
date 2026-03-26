/**
 * Report Template Enhancement Script
 * Uses DigitalOcean RAG Agent to enhance report templates
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// DigitalOcean Agent Configuration
const DO_AGENT_BASE = 'https://sirvwszn3jrtvmxtnirmvwjz.agents.do-ai.run';
const DO_AGENT_KEY = '__DCbWcpyImSHl0kDwhSVAY5Afe2NjQp';
const DO_AGENT_ENDPOINT = `${DO_AGENT_BASE}/api/v1/chat/completions`;

// Global CSS - will be applied to all templates
const GLOBAL_CSS = `
:root{
  --primary-blue:#0b4aa2;
  --light-blue:#eaf2ff;
  --success-green:#12b76a;
  --warning-amber:#f79009;
  --danger-red:#d92d20;
  --text-dark:#1f2937;
  --text-muted:#64748b;
  --border-light:#e5ecf6;
  --row-alt:#f7faff;
  --page-bg:#ffffff;
  --card-bg:#ffffff;
}

html, body{
  margin:0;
  padding:0;
  width:100%;
  font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  color:var(--text-dark);
  background:var(--page-bg);
}

figure.table{
  margin:12px 0;
  width:100% !important;
  max-width:100% !important;
}

figure.table table,
.patient-info,
.report-table,
.tbl-meta,
.tbl-results,
.tbl-interpretation{
  width:100% !important;
  max-width:100% !important;
  border-collapse:collapse;
  box-sizing:border-box;
}

.patient-info,
.report-table,
.tbl-meta,
.tbl-results,
.tbl-interpretation{
  border:1px solid var(--border-light);
  border-radius:10px;
  overflow:hidden;
  background:#fff;
}

.patient-info td,
.report-table td,
.tbl-meta td,
.tbl-results td,
.tbl-interpretation td{
  border:1px solid var(--border-light);
  padding:10px 12px;
  font-size:13px;
  word-break:break-word;
}

.report-table thead th,
.tbl-results thead th,
.tbl-interpretation thead th{
  background:var(--primary-blue) !important;
  color:#fff !important;
  font-weight:900;
}

.note{
  margin-top:14px;
  padding:12px 14px;
  border-left:4px solid var(--primary-blue);
  background:#f8fafc;
  font-size:13px;
  font-style:italic;
}
`.trim();

interface Template {
  id: string;
  name: string;
  html_content: string;
  css_content: string;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Call DO Agent to enhance template
 */
async function enhanceWithAgent(inputHtml: string): Promise<{ html: string; css: string }> {
  const prompt = `You are "ReportTemplateEnhancer".

TASK: Add clinical interpretation section and notes to this lab report template.

INPUT HTML (fragment only, no wrappers):
${inputHtml}

RULES:
1. Keep ALL existing content (patient tables, results tables, placeholders like {{patientName}})
2. NO inline styles (no style="")
3. Insert AFTER results table, BEFORE footer:

<div class="section-header">Clinical Interpretation</div>
<figure class="table">
  <table class="tbl-interpretation">
    <thead><tr><th>Level</th><th>Meaning & Potential Causes</th></tr></thead>
    <tbody>
      <tr><td>High</td><td>May suggest inflammation/infection; correlate clinically.</td></tr>
      <tr><td>Normal</td><td>Results within reference ranges.</td></tr>
      <tr><td>Low</td><td>May suggest anemia/immune suppression; correlate clinically.</td></tr>
    </tbody>
  </table>
</figure>

<div class="note">
  <strong>Note on Reference Ranges:</strong> Reference ranges may vary by laboratory. Always interpret results using the reference range reported by your laboratory.
  <br><br>
  <strong>Additional Note:</strong> Certain conditions can affect interpretation (e.g., medications, recent illness). If results are unexpected, correlation with clinical findings may be considered.
</div>

Return ONLY valid JSON (no markdown):
{
  "updated_html": "<full enhanced html here>",
  "summary": "Added interpretation section after results table"
}`;

  const response = await fetch(DO_AGENT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DO_AGENT_KEY}`
    },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: prompt }
      ],
      stream: false,
      include_retrieval_info: false
    })
  });

  if (!response.ok) {
    throw new Error(`Agent error: ${response.status}`);
  }

  const data = await response.json();
  const agentMessage = data.choices[0].message.content;
  
  // Extract JSON from agent response
  const jsonMatch = agentMessage.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON in agent response');
  }

  const result = JSON.parse(jsonMatch[0]);
  return {
    html: result.updated_html,
    css: GLOBAL_CSS
  };
}

/**
 * Fetch templates
 */
async function fetchTemplates(limit: number = 5): Promise<Template[]> {
  const { data, error } = await supabase
    .from('global_template_catalog')
    .select('id, name, html_content, css_content')
    .eq('type', 'report_body')
    .not('html_content', 'is', null)
    .limit(limit);

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Update template
 */
async function updateTemplate(id: string, html: string, css: string): Promise<void> {
  const { error } = await supabase
    .from('global_template_catalog')
    .update({
      html_content: html,
      css_content: css,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Main process
 */
async function main() {
  console.log('🚀 Template Enhancement Started\n');
  console.log('='.repeat(60));

  const templates = await fetchTemplates(5);
  console.log(`\n✅ Found ${templates.length} templates\n`);

  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    console.log(`\n📋 [${i + 1}/${templates.length}] ${template.name}`);
    console.log(`   ID: ${template.id}`);

    try {
      console.log('   📤 Calling agent...');
      const enhanced = await enhanceWithAgent(template.html_content);
      
      console.log('   💾 Updating database...');
      await updateTemplate(template.id, enhanced.html, enhanced.css);
      
      console.log('   ✅ Success!');
      
      if (i < templates.length - 1) {
        console.log('   ⏳ Waiting 2s...');
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n🎉 Done! Enhanced', templates.length, 'templates\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Fatal:', err);
    process.exit(1);
  });
