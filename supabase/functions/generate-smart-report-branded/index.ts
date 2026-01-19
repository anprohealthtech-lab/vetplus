// Supabase Edge Function: Smart Report with Gamma AI + PDF.co Letterhead Overlay
// Combines beautiful Gamma AI layouts with lab branding (header/footer)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GAMMA_API_KEY = Deno.env.get('GAMMA_API_KEY') || 'sk-gamma-lTDqDYXVz6QTreO50hMEnyTnREmjGOMyqgcoYOwpvk';
const PDFCO_API_KEY = Deno.env.get('PDFCO_API_KEY') ?? '';

// A4 dimensions in points (72 points per inch)
const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const HEADER_HEIGHT = 120; // Increased for more space
const FOOTER_HEIGHT = 80;  // Increased for more space
const TOP_MARGIN = 130;    // Content starts below header
const BOTTOM_MARGIN = 90;  // Content ends above footer

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    const { orderId } = await req.json()

    if (!orderId) {
      throw new Error('orderId is required')
    }

    console.log('═══════════════════════════════════════════════════════════')
    console.log('✨ SMART REPORT GENERATION (Gamma + PDF.co Overlay)')
    console.log('═══════════════════════════════════════════════════════════')
    console.log('Order ID:', orderId)

    // ========================================
    // STEP 1: Get HTML Content - Generate directly using same logic
    // ========================================
    console.log('\n📄 Step 1: Generating HTML content...')
    
    const htmlContent = await generateReportHtml(supabaseClient, orderId);
    
    if (!htmlContent) {
      throw new Error('Failed to generate HTML content');
    }

    console.log('✅ HTML content generated, length:', htmlContent.length);

    // ========================================
    // STEP 2: Generate via Gamma AI
    // ========================================
    console.log('\n🎨 Step 2: Generating with Gamma AI...')
    
    const gammaResult = await generateWithGamma(htmlContent);
    
    if (!gammaResult.exportUrl) {
      throw new Error('Gamma did not return a PDF URL');
    }

    console.log('✅ Gamma PDF generated:', gammaResult.exportUrl);

    // ========================================
    // STEP 3: Get Lab Branding Assets
    // ========================================
    console.log('\n🏷️ Step 3: Fetching lab branding...')
    
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('lab_id, patient_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found: ' + orderError?.message);
    }

    const { data: assets } = await supabaseClient
      .from('lab_branding_assets')
      .select('id, asset_type, file_url, asset_name, is_default')
      .eq('lab_id', order.lab_id)
      .eq('is_default', true);

    const headerAsset = assets?.find(a => a.asset_type === 'header');
    const footerAsset = assets?.find(a => a.asset_type === 'footer');

    console.log('Header asset:', headerAsset?.asset_name || 'None');
    console.log('Footer asset:', footerAsset?.asset_name || 'None');

    // ========================================
    // STEP 4: Overlay Branding via PDF.co
    // ========================================
    let finalPdfUrl = gammaResult.exportUrl;

    if ((headerAsset?.file_url || footerAsset?.file_url) && PDFCO_API_KEY) {
      console.log('\n📎 Step 4: Overlaying branding with PDF.co...')
      
      finalPdfUrl = await overlayBrandingWithPdfCo(
        gammaResult.exportUrl,
        headerAsset?.file_url,
        footerAsset?.file_url
      );

      console.log('✅ Branding overlay complete:', finalPdfUrl);
    } else {
      console.log('\n⚠️ Step 4: Skipping overlay (no assets or no PDF.co key)');
    }

    // ========================================
    // STEP 5: Upload to Supabase Storage
    // ========================================
    console.log('\n💾 Step 5: Uploading to storage...')
    
    // Download the PDF
    const pdfResponse = await fetch(finalPdfUrl);
    if (!pdfResponse.ok) {
      throw new Error('Failed to download final PDF');
    }
    
    const pdfBlob = await pdfResponse.blob();
    const pdfBuffer = await pdfBlob.arrayBuffer();
    
    // Generate storage path
    const timestamp = Date.now();
    const filename = `SmartReport_${orderId}_${timestamp}.pdf`;
    const storagePath = `smart-reports/${order.lab_id}/${filename}`;
    
    const { error: uploadError } = await supabaseClient.storage
      .from('reports')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      // Return Gamma URL as fallback
      return new Response(
        JSON.stringify({
          success: true,
          pdfUrl: finalPdfUrl,
          source: 'gamma-direct',
          message: 'Storage upload failed, using direct URL'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL
    const { data: urlData } = supabaseClient.storage
      .from('reports')
      .getPublicUrl(storagePath);

    const publicUrl = urlData?.publicUrl || finalPdfUrl;

    console.log('✅ Uploaded to storage:', publicUrl);

    // ========================================
    // STEP 6: Update Order/Report Record
    // ========================================
    // Optionally save reference to this smart report
    await supabaseClient
      .from('orders')
      .update({ 
        smart_report_url: publicUrl,
        smart_report_generated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('✅ SMART REPORT GENERATION COMPLETE')
    console.log('═══════════════════════════════════════════════════════════')

    return new Response(
      JSON.stringify({
        success: true,
        pdfUrl: publicUrl,
        storagePath,
        gammaUrl: gammaResult.gammaUrl,
        source: 'gamma-branded'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('❌ Smart Report Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})

// ============================================
// Generate Report HTML directly
// ============================================
async function generateReportHtml(supabase: any, orderId: string): Promise<string> {
  // Fetch order with all related data
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id,
      order_date,
      sample_id,
      doctor_name,
      lab_id,
      patient_id,
      patients (
        id,
        name,
        age,
        gender,
        phone
      ),
      labs (
        id,
        name,
        address,
        phone,
        email
      )
    `)
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    throw new Error('Order not found: ' + orderError?.message);
  }

  // Fetch results with values
  const { data: results, error: resultsError } = await supabase
    .from('results')
    .select(`
      id,
      test_group_id,
      verification_status,
      test_groups (
        id,
        name
      ),
      result_values (
        id,
        analyte_id,
        value,
        unit,
        flag,
        reference_range,
        analytes (
          id,
          name,
          display_name
        )
      )
    `)
    .eq('order_id', orderId);

  if (resultsError) {
    console.error('Error fetching results:', resultsError);
  }

  // Build HTML for Gamma with TOP MARGIN for header space
  const patient = order.patients;
  const lab = order.labs;
  
  // Add spacing divs at top for header area
  let html = `
<div style="height: 100px; margin-bottom: 20px;"></div>

# LABORATORY REPORT

## Patient Information
- **Name:** ${patient?.name || 'N/A'}
- **Age/Gender:** ${patient?.age || 'N/A'} years / ${patient?.gender || 'N/A'}
- **Sample ID:** ${order.sample_id || 'N/A'}
- **Order Date:** ${order.order_date ? new Date(order.order_date).toLocaleDateString() : 'N/A'}
- **Referring Doctor:** ${order.doctor_name || 'Self'}

---

## Test Results

`;

  // Group results by test
  const testGroups: Record<string, any[]> = {};
  
  (results || []).forEach((result: any) => {
    const testName = result.test_groups?.name || 'Other Tests';
    if (!testGroups[testName]) {
      testGroups[testName] = [];
    }
    
    (result.result_values || []).forEach((rv: any) => {
      testGroups[testName].push({
        parameter: rv.analytes?.display_name || rv.analytes?.name || 'Unknown',
        value: rv.value || '-',
        unit: rv.unit || '',
        reference: rv.reference_range || '',
        flag: rv.flag || ''
      });
    });
  });

  // Generate table for each test group
  for (const [testName, values] of Object.entries(testGroups)) {
    html += `### ${testName}\n\n`;
    html += `| Parameter | Result | Unit | Reference Range | Flag |\n`;
    html += `|-----------|--------|------|-----------------|------|\n`;
    
    values.forEach((v: any) => {
      const flagDisplay = v.flag ? `**${v.flag}**` : '-';
      html += `| ${v.parameter} | ${v.value} | ${v.unit} | ${v.reference} | ${flagDisplay} |\n`;
    });
    
    html += `\n`;
  }

  html += `
---

## Laboratory Information
- **Lab:** ${lab?.name || 'N/A'}
- **Address:** ${lab?.address || 'N/A'}
- **Contact:** ${lab?.phone || 'N/A'}

*This report is electronically generated and verified.*
`;

  return html;
}

// ============================================
// Gamma AI Generation
// ============================================
async function generateWithGamma(html: string): Promise<{ exportUrl: string; gammaUrl?: string }> {
  console.log('🚀 Initiating Gamma generation...');
  
  // 1. Initiate Generation
  const initiateResponse = await fetch('https://public-api.gamma.app/v1.0/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': GAMMA_API_KEY,
      'accept': 'application/json'
    },
    body: JSON.stringify({
      textMode: "generate",
      inputText: html,
      format: "document",
      themeId: "wbpgwj9c0ty5wbo", // Clean medical theme
      cardSplit: "inputTextBreaks",
      additionalInstructions: `Create a professional medical lab report. 
IMPORTANT LAYOUT REQUIREMENTS:
- Leave 120px blank space at the TOP of EVERY page for letterhead header
- Leave 80px blank space at the BOTTOM of EVERY page for footer
- Start content 130px from the top edge
- Keep all data exactly as provided
- Use clean typography with good contrast
- Use a white/light background so header overlay is visible
- Do not add decorative images or backgrounds
- Tables should have clear borders and good padding`,
      exportAs: "pdf",
      sharingOptions: {
        workspaceAccess: "edit",
        externalAccess: "view"
      },
      imageOptions: {
        source: "none" // Don't add stock images
      }
    })
  });

  if (!initiateResponse.ok) {
    const errText = await initiateResponse.text();
    console.error('❌ Gamma Init Error:', errText);
    throw new Error(`Gamma API Failed: ${initiateResponse.status} - ${errText}`);
  }

  const initData = await initiateResponse.json();
  console.log('📦 Gamma Init Response:', JSON.stringify(initData));
  
  const generationId = initData.generationId;
  
  if (!generationId) {
    throw new Error('No generation ID from Gamma');
  }

  console.log('⏳ Polling for completion, ID:', generationId);

  // 2. Poll for Completion
  let attempts = 0;
  const maxAttempts = 60; // ~2 min timeout
  
  while (attempts < maxAttempts) {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 2000));

    const pollResponse = await fetch(`https://public-api.gamma.app/v1.0/generations/${generationId}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': GAMMA_API_KEY,
        'accept': 'application/json'
      }
    });

    if (!pollResponse.ok) {
      console.warn(`Poll attempt ${attempts} failed`);
      continue;
    }

    const pollData = await pollResponse.json();
    console.log(`Poll ${attempts}:`, pollData.status);

    if (pollData.status === 'completed') {
      return {
        exportUrl: pollData.exportUrl || pollData.pdfUrl,
        gammaUrl: pollData.url || pollData.docUrl
      };
    } else if (pollData.status === 'error' || pollData.status === 'failed') {
      throw new Error(`Gamma generation failed: ${JSON.stringify(pollData)}`);
    }
  }

  throw new Error('Gamma generation timed out');
}

// ============================================
// PDF.co Branding Overlay
// Uses white rectangles + images for clean header/footer
// ============================================
async function overlayBrandingWithPdfCo(
  pdfUrl: string,
  headerUrl?: string,
  footerUrl?: string
): Promise<string> {
  // Build annotations array - white rectangles first, then images on top
  const annotations: any[] = [];
  const images: any[] = [];

  // Add white rectangle for header area (to mask any content)
  if (headerUrl) {
    annotations.push({
      type: "rectangle",
      x: 0,
      y: 0,
      width: A4_WIDTH,
      height: HEADER_HEIGHT + 10, // Slightly larger to ensure coverage
      fillColor: "FFFFFF",
      pages: "0-"
    });
    
    images.push({
      url: headerUrl,
      x: 0,
      y: 0,
      width: A4_WIDTH,
      height: HEADER_HEIGHT,
      pages: "0-"
    });
  }

  // Add white rectangle for footer area
  if (footerUrl) {
    annotations.push({
      type: "rectangle",
      x: 0,
      y: A4_HEIGHT - FOOTER_HEIGHT - 10,
      width: A4_WIDTH,
      height: FOOTER_HEIGHT + 10,
      fillColor: "FFFFFF",
      pages: "0-"
    });
    
    images.push({
      url: footerUrl,
      x: 0,
      y: A4_HEIGHT - FOOTER_HEIGHT,
      width: A4_WIDTH,
      height: FOOTER_HEIGHT,
      pages: "0-"
    });
  }

  if (images.length === 0) {
    return pdfUrl; // No overlay needed
  }

  console.log('📎 PDF.co overlay - annotations:', annotations.length, 'images:', images.length);

  // Use PDF.co's pdf/edit/add endpoint
  const response = await fetch('https://api.pdf.co/v1/pdf/edit/add', {
    method: 'POST',
    headers: {
      'x-api-key': PDFCO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: pdfUrl,
      annotations: annotations.length > 0 ? annotations : undefined,
      images,
      name: 'smart_report_branded.pdf',
      async: false
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('❌ PDF.co Error:', errText);
    throw new Error(`PDF.co overlay failed: ${response.status}`);
  }

  const result = await response.json();
  
  if (result.error) {
    throw new Error(`PDF.co error: ${result.message || result.error}`);
  }

  return result.url;
}
