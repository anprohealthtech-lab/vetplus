import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

// Initialize clients
// service_role key provided by user
const SUPER_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcWh6YmtrcmFkZmx5d2FyaWVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjI1NDYwOCwiZXhwIjoyMDY3ODMwNjA4fQ.NzWfj0DJXBzr3RQqCzAZxioND8cZn8z8tFmZ00upH7U";

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    SUPER_KEY
);

const anthropic = new Anthropic({
    apiKey: process.env.VITE_ANTHROPIC_API_KEY,
});

const AI_PROMPT = `You are an HTML template transformer. Your job is to clean up lab report templates.

TASK: Merge all clinical interpretation blocks into a SINGLE block.
CRITICAL FORMATTING RULE:
- If the text mentions specific levels (High, Low, Normal, Borderline, Eosinophilia, etc.), break them into SEPARATE ROWS in the table.
- Do NOT put all text into one "Analysis" row if distinct sections exist.
- Use "Analysis" row ONLY if the text is a single paragraph without distinct levels.

REQUIRED STRUCTURE:
   <div class="section-header">Clinical Interpretation</div>
   <figure class="table">
     <table class="tbl-interpretation">
       <thead>
         <tr>
           <th>Level</th>
           <th>Meaning & Potential Causes</th>
         </tr>
       </thead>
       <tbody>
         <!-- AI to insert rows here based on content. Example: -->
         <!--
         <tr>
           <td>High</td>
           <td>Elevated levels indicate...</td>
         </tr>
         <tr>
           <td>Normal</td>
           <td>Levels within range...</td>
         </tr>
         -->
       </tbody>
     </table>
   </figure>
   <div class="note">
     <strong>Note:</strong> factors such as age, sex, and medication can influence results.
   </div>

3. CLEANUP:
   - Ensure the document ends cleanly.
   - RETURN ONLY the HTML fragment (content inside the body/report-container).
   - DO NOT return <!DOCTYPE html>, <html>, <head>, or <body> tags.

RULES:
- CRITICAL: Preserve ALL placeholders exactly as they are ({{patientName}}, {{signatoryName}}, {{signatoryDesignation}}, etc.).
- DO NOT replace {{signatoryName}} with a real name like "Dr. Emily Richardson". Keep it as {{signatoryName}}.
- Keep other HTML exactly as-is. ONLY update the interpretation block.
`;

async function processTemplateWithAI(template) {
    console.log(`\n🔄 Processing: ${template.name} (ID: ${template.id.substring(0, 8)}...)`);

    if (!template.html_content) {
        console.log('  ⚠️  Empty html_content - skipping');
        return { success: true, skipped: true };
    }

    const htmlContent = template.html_content;

    try {
        console.log('  🤖 Calling Claude Haiku 3.5 to transform...');

        const message = await anthropic.messages.create({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 8000,
            messages: [{
                role: 'user',
                content: AI_PROMPT + '\n\nHTML TO TRANSFORM:\n\n' + htmlContent
            }]
        });

        let transformedHtml = message.content[0].text.trim();

        // Cleanup Markdown code blocks
        if (transformedHtml.startsWith('```')) {
            const lines = transformedHtml.split('\n');
            lines.shift();
            if (lines.length > 0 && lines[0].trim().startsWith('```')) lines.shift();
            if (lines.length > 0 && lines[lines.length - 1].trim() === '```') lines.pop();
            transformedHtml = lines.join('\n').trim();
        }

        // Strip preamble text
        const firstTag = transformedHtml.indexOf('<');
        if (firstTag > 0) {
            transformedHtml = transformedHtml.substring(firstTag);
        }

        // Cleanup Body Wrappers
        transformedHtml = transformedHtml.replace(/<head>[\s\S]*?<\/head>/gi, '');

        if (transformedHtml.includes('<body')) {
            const bodyMatch = transformedHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
            if (bodyMatch && bodyMatch[1]) {
                transformedHtml = bodyMatch[1].trim();
            }
        }

        transformedHtml = transformedHtml
            .replace(/<!DOCTYPE html>/gi, '')
            .replace(/<html[^>]*>/gi, '')
            .replace(/<\/html>/gi, '')
            .replace(/<body[^>]*>/gi, '')
            .replace(/<\/body>/gi, '')
            .trim();

        // Validation
        if (!transformedHtml.startsWith('<')) {
            console.error(`  ❌ Error: AI response invalid (does not start with <)`);
            console.log(`  Preview: ${transformedHtml.substring(0, 500)}...`);
            throw new Error('AI response does not appear to be valid HTML');
        }

        const hasNewTable = transformedHtml.includes('<table class="tbl-interpretation">');

        if (!hasNewTable) {
            console.log('  ⚠️  AI response missing table. Dumping full response:');
            console.log(transformedHtml.substring(0, 500));
            throw new Error('AI did not include the new interpretation table');
        }

        console.log('  🔍 PREVIEW OF CHANGE:');
        const previewMatch = transformedHtml.match(/<table class="tbl-interpretation">[\s\S]*?<\/table>/);
        if (previewMatch) {
            console.log('  Found Table:\n' + previewMatch[0]); // Show full table
        } else {
            console.log('  Full Content (First 2000 chars):\n' + transformedHtml.substring(0, 2000) + '...');
        }

        // Update in database
        const { error: updateError } = await supabase
            .from('global_template_catalog')
            .update({
                html_content: transformedHtml,
                updated_at: new Date().toISOString()
            })
            .eq('id', template.id);

        if (updateError) throw updateError;

        console.log('  ✅ Database updated');
        return { success: true, updated: true };

    } catch (error) {
        console.error(`  ❌ Error:`, error.message);
        return { success: false, error: error.message };
    }
}

async function main() {
    console.log('🚀 Starting Global Template AI Update Process (Masters Only, Haiku 3.5, Service Role)\n');
    console.log('📋 Fetching "Master Template -%" from global_template_catalog...\n');

    const { data: templates, error: fetchError } = await supabase
        .from('global_template_catalog')
        .select('*')
        .eq('type', 'report_body')
        .ilike('name', 'Master Template -%')
        .order('name');

    if (fetchError) {
        console.error('❌ Error fetching templates:', fetchError);
        process.exit(1);
    }

    if (!templates || templates.length === 0) {
        console.log('⚠️  No matching templates found');
        process.exit(0);
    }

    console.log(`✅ Found ${templates.length} template(s)\n`);
    console.log('─'.repeat(60));

    const results = { total: templates.length, updated: 0, skipped: 0, failed: 0, errors: [] };

    for (const template of templates) {
        const result = await processTemplateWithAI(template);

        if (result.updated) results.updated++;
        if (result.skipped) results.skipped++;
        if (!result.success) {
            results.failed++;
            results.errors.push({ name: template.name, error: result.error });
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '─'.repeat(60));
    console.log(`\n📊 SUMMARY: Total: ${results.total} | Updated: ${results.updated} | Skipped: ${results.skipped} | Failed: ${results.failed}`);
    if (results.errors.length > 0) {
        console.log('\n⚠️  ERRORS:');
        results.errors.forEach(e => console.log(`   - ${e.name}: ${e.error}`));
    }
    console.log('\n✨ Process complete!\n');
}

main().catch(console.error);
