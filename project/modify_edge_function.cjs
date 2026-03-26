const fs = require('fs');
const path = 'd:\\LIMS version 2\\project\\supabase\\functions\\generate-report-html\\index.ts';
let content = fs.readFileSync(path, 'utf8');

// Find start (Step 10 or the updateProgress before it)
const updateProg = "await updateProgress(supabaseClient, job.id, 'Generating PDF via PDF.co...', 70)";
let startIndex = content.indexOf(updateProg);

if (startIndex === -1) {
    // Fallback search
    console.log("Could not find updateProgress, searching for Step 10 comment");
    const step10 = "Step 10: Generate PDFs via PDF.co API";
    startIndex = content.indexOf(step10);
    // Adjust to include the comment line (it starts with //)
    if (startIndex !== -1) startIndex -= 4; // approximate
}

if (startIndex === -1) {
    console.error("Start marker not found");
    process.exit(1);
}

// Find end (The catch block of the main try)
// We look for the catch(error) which handles the main logic errors
const endMarker = "} catch (error) {";
const endIndex = content.lastIndexOf(endMarker);

if (endIndex === -1) {
    console.error("End marker not found");
    process.exit(1);
}

console.log(`Replacing valid range: ${startIndex} to ${endIndex}`);

const newLogic = `
    console.log('✅ HTML Generation Complete - Returning HTML payload')

    return new Response(
      JSON.stringify({
        success: true,
        html: processedBody,
        header: processedHeader,
        footer: processedFooter,
        settings: pdfSettings,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
    // Close the try block manually if needed? 
    // No, endIndex starts with } catch... so we just need to end our logic.
`;

// content.substring(endIndex) starts with "} catch (error) {"
// So we insert before it.

const newContent = content.substring(0, startIndex) + newLogic + "\n" + content.substring(endIndex);

fs.writeFileSync(path, newContent, 'utf8');
console.log("Successfully updated index.ts");
