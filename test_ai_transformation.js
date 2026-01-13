import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

const anthropic = new Anthropic({
    apiKey: process.env.VITE_ANTHROPIC_API_KEY,
});

const AI_PROMPT = `You are an HTML template transformer. Your job is to clean up lab report templates.

CRITICAL TASK - YOU MUST DO BOTH STEPS:

STEP 1: REMOVE THE OLD INTERPRETATION BLOCK
Find and DELETE this entire section (it appears BEFORE the report-footer):

<div class='interpretation' style='margin-top:20px; padding:15px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;'>
    <h4 style='margin:0 0 8px; color:#334155;'>Clinical Interpretation</h4>
    <div style='font-size:13px; color:#475569;'>
        [any text here - DELETE IT ALL]
    </div>
</div>

This old block might use single quotes (') or double quotes ("). You MUST find it and DELETE the ENTIRE div including all nested content. Look for class="interpretation" OR class='interpretation'.

STEP 2: MOVE THE NEW INTERPRETATION
The NEW interpretation content appears AFTER the </html> tag at the very end of the document. It looks like:

<div class="section-header">Clinical Interpretation</div>
<figure class="table">
  <table class="tbl-interpretation">
    ...detailed table...
  </table>
</figure>
<div class="note">
  ...notes...
</div>

You MUST:
1. EXTRACT this entire block from after </html>
2. INSERT it BEFORE <div class='report-footer'> (with proper indentation)
3. REMOVE everything after </html> (so the file ends cleanly with </html>)

RULES:
- Keep ALL other HTML exactly as-is
- Preserve ALL placeholders: {{patientName}}, {{ANALYTE_*}}, etc.
- Match indentation of surrounding code (use spaces, not tabs)
- Return ONLY HTML, no markdown code blocks, no explanations

DO NOT return the HTML wrapped in markdown code blocks. Return the raw HTML directly.`;

async function testTransformation() {
    const templateId = 'ef19c1ca-6944-48e8-bf47-865f436e08d6';

    console.log(`🔍 Fetching template ${templateId}...\n`);

    const { data: template, error } = await supabase
        .from('global_template_catalog')
        .select('*')
        .eq('id', templateId)
        .single();

    if (error || !template) {
        console.error('❌ Error:', error);
        process.exit(1);
    }

    console.log(`✅ Template: ${template.name}\n`);
    console.log('🤖 Sending to Claude Haiku 3.5...\n');

    const message = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 8000,
        messages: [{
            role: 'user',
            content: AI_PROMPT + '\n\nHTML TO TRANSFORM:\n\n' + template.html_content
        }]
    });

    let transformedHtml = message.content[0].text.trim();

    console.log('📝 Response length:', transformedHtml.length);
    console.log('📝 Starts with:', transformedHtml.substring(0, 50));

    // Strip markdown if present
    if (transformedHtml.startsWith('```')) {
        console.log('⚠️  Stripping markdown...');
        const lines = transformedHtml.split('\n');
        lines.shift();
        if (lines[lines.length - 1].trim() === '```') {
            lines.pop();
        }
        transformedHtml = lines.join('\n').trim();
    }

    // Save both versions
    fs.writeFileSync('test_before.html', template.html_content);
    fs.writeFileSync('test_after.html', transformedHtml);

    // Check results
    const hasDoctype = transformedHtml.includes('<!DOCTYPE html>');
    const hasClosingHtml = transformedHtml.includes('</html>');
    const hasNewTable = transformedHtml.includes('<table class="tbl-interpretation">');
    const hasOldBlock = transformedHtml.includes('class="interpretation"') || transformedHtml.includes("class='interpretation'");
    const endIndex = transformedHtml.lastIndexOf('</html>');
    const afterContent = endIndex !== -1 ? transformedHtml.substring(endIndex + 7).trim() : '';

    console.log('\n✅ VALIDATION:');
    console.log(`   Has DOCTYPE: ${hasDoctype ? '✅' : '❌'}`);
    console.log(`   Has </html>: ${hasClosingHtml ? '✅' : '❌'}`);
    console.log(`   Has new table: ${hasNewTable ? '✅' : '❌'}`);
    console.log(`   Old block removed: ${!hasOldBlock ? '✅' : '❌ STILL THERE'}`);
    console.log(`   Clean ending: ${!afterContent ? '✅' : '❌ Has ' + afterContent.length + ' chars after </html>'}`);

    if (hasDoctype && hasClosingHtml && hasNewTable && !hasOldBlock && !afterContent) {
        console.log('\n🎉 PERFECT! Transformation successful!');
        console.log('\n📄 Files created:');
        console.log('   - test_before.html (original)');
        console.log('   - test_after.html (transformed)');
    } else {
        console.log('\n⚠️  Issues detected - check test_after.html');
    }
}

testTransformation().catch(console.error);
