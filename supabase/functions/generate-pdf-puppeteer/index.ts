import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PDFRequest {
  html: string;
  orderId: string;
  variant?: 'final' | 'draft' | 'print';
  filename?: string;
  warmup?: boolean;
}

// DigitalOcean Puppeteer Service URL
// Set this as environment variable: PUPPETEER_SERVICE_URL
const PUPPETEER_SERVICE_URL = Deno.env.get('PUPPETEER_SERVICE_URL') || '';

serve(async (req) => {
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { html, orderId, variant = 'final', filename, warmup }: PDFRequest = await req.json();

    // Handle warmup request
    if (warmup) {
      // Forward warmup to Puppeteer service
      if (PUPPETEER_SERVICE_URL) {
        try {
          await fetch(`${PUPPETEER_SERVICE_URL}/warmup`, { method: 'POST' });
        } catch (e) {
          console.warn('Puppeteer warmup failed:', e);
        }
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Function is ready',
          puppeteerService: PUPPETEER_SERVICE_URL ? 'available' : 'not configured',
          timestamp: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!html || !orderId) {
      throw new Error('Missing required fields: html and orderId');
    }

    console.log(`📄 Generating PDF for order: ${orderId}, variant: ${variant}`);
    
    const htmlLoadStart = Date.now();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const htmlLoadTime = Date.now() - htmlLoadStart;
    const pdfGenStart = Date.now();

    let pdfBuffer: Uint8Array;
    let pdfGenTime: number;

    // Try Puppeteer service first if available
    if (PUPPETEER_SERVICE_URL) {
      console.log('🎭 Using Puppeteer service:', PUPPETEER_SERVICE_URL);
      
      try {
        const puppeteerResponse = await fetch(`${PUPPETEER_SERVICE_URL}/generate-pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            html,
            options: {
              format: 'A4',
              margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
              printBackground: true,
            },
          }),
        });

        if (!puppeteerResponse.ok) {
          throw new Error(`Puppeteer service error: ${puppeteerResponse.status}`);
        }

        const puppeteerData = await puppeteerResponse.json();
        
        if (!puppeteerData.success || !puppeteerData.pdf) {
          throw new Error('Puppeteer service returned no PDF');
        }

        // Decode base64 PDF
        pdfBuffer = Uint8Array.from(atob(puppeteerData.pdf), c => c.charCodeAt(0));
        pdfGenTime = puppeteerData.timing?.total || (Date.now() - pdfGenStart);
        
        console.log(`✅ Puppeteer PDF generated in ${pdfGenTime}ms`);
      } catch (puppeteerError) {
        console.warn('⚠️ Puppeteer service failed, falling back to PDF.co:', puppeteerError);
        
        // Fallback to PDF.co
        const pdfCoApiKey = Deno.env.get('PDF_CO_API_KEY');
        if (!pdfCoApiKey) {
          throw new Error('Both Puppeteer service and PDF.co unavailable');
        }

        const pdfResponse = await fetch('https://api.pdf.co/v1/pdf/convert/from/html', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': pdfCoApiKey,
          },
          body: JSON.stringify({
            html,
            name: filename || `${orderId}_${variant}.pdf`,
            margins: '10mm',
            paperSize: 'A4',
            orientation: 'Portrait',
            printBackground: true,
            async: false,
          }),
        });

        if (!pdfResponse.ok) {
          throw new Error(`PDF.co API error: ${pdfResponse.status}`);
        }

        const pdfData = await pdfResponse.json();
        if (!pdfData.url) {
          throw new Error('PDF.co returned no URL');
        }

        const pdfFileResponse = await fetch(pdfData.url);
        const arrayBuffer = await pdfFileResponse.arrayBuffer();
        pdfBuffer = new Uint8Array(arrayBuffer);
        pdfGenTime = Date.now() - pdfGenStart;
        
        console.log(`✅ PDF.co PDF generated in ${pdfGenTime}ms (fallback)`);
      }
    } else {
      // No Puppeteer service configured, use PDF.co directly
      console.log('📄 Using PDF.co (Puppeteer service not configured)');
      
      const pdfCoApiKey = Deno.env.get('PDF_CO_API_KEY');
      if (!pdfCoApiKey) {
        throw new Error('PDF_CO_API_KEY not configured');
      }

      const pdfResponse = await fetch('https://api.pdf.co/v1/pdf/convert/from/html', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': pdfCoApiKey,
        },
        body: JSON.stringify({
          html,
          name: filename || `${orderId}_${variant}.pdf`,
          margins: '10mm',
          paperSize: 'A4',
          orientation: 'Portrait',
          printBackground: true,
          async: false,
        }),
      });

      if (!pdfResponse.ok) {
        throw new Error(`PDF.co API error: ${pdfResponse.status}`);
      }

      const pdfData = await pdfResponse.json();
      if (!pdfData.url) {
        throw new Error('PDF generation failed: No URL returned');
      }

      const pdfFileResponse = await fetch(pdfData.url);
      const arrayBuffer = await pdfFileResponse.arrayBuffer();
      pdfBuffer = new Uint8Array(arrayBuffer);
      pdfGenTime = Date.now() - pdfGenStart;
    }

    const storageUploadStart = Date.now();

    // Upload to Supabase Storage
    const storagePath = `${orderId}/${Date.now()}_${variant}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('reports')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('reports')
      .getPublicUrl(storagePath);

    const storageUploadTime = Date.now() - storageUploadStart;
    const databaseUpdateStart = Date.now();

    // Update reports table
    const fieldName = variant === 'print' ? 'print_pdf_url' : 'pdf_url';
    const { error: updateError } = await supabase
      .from('reports')
      .upsert(
        {
          order_id: orderId,
          [fieldName]: urlData.publicUrl,
          pdf_generated_at: new Date().toISOString(),
          status: 'completed',
          report_type: variant,
        },
        {
          onConflict: 'order_id',
        }
      );

    if (updateError) {
      console.warn('Database update warning:', updateError);
    }

    const databaseUpdateTime = Date.now() - databaseUpdateStart;
    const totalTime = Date.now() - startTime;

    const result = {
      success: true,
      url: urlData.publicUrl,
      generationTime: totalTime,
      breakdown: {
        htmlLoad: htmlLoadTime,
        pdfGeneration: pdfGenTime,
        storageUpload: storageUploadTime,
        databaseUpdate: databaseUpdateTime,
      },
    };

    console.log('✅ PDF generation complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ PDF generation error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
