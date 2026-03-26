// Supabase Edge Function: Direct HTML to PDF via PDF.co
// Simple, fast PDF generation from pre-rendered HTML

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PDFCO_API_URL = 'https://api.pdf.co/v1/pdf/convert/from/html'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { html, orderId, fileName } = await req.json()

    if (!html) {
      return new Response(
        JSON.stringify({ error: 'HTML content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get PDF.co API key
    const pdfcoApiKey = Deno.env.get('PDFCO_API_KEY')
    if (!pdfcoApiKey) {
      throw new Error('PDF.co API key not configured')
    }

    console.log('📄 Generating PDF directly from HTML...')

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const pdfFileName = fileName || `report_${orderId || timestamp}.pdf`
    const storagePath = `${orderId || 'direct'}/${pdfFileName}`

    // Send HTML directly to PDF.co
    const pdfcoResponse = await fetch(PDFCO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': pdfcoApiKey,
      },
      body: JSON.stringify({
        html: html,
        name: pdfFileName,
        margins: '0mm 0mm 0mm 0mm', // No margins - HTML should handle spacing
        paperSize: 'A4',
        orientation: 'portrait',
        printBackground: true,
        mediaType: 'screen',
        async: false, // Synchronous for immediate response
      }),
    })

    const pdfcoResult = await pdfcoResponse.json()

    if (!pdfcoResult.url) {
      console.error('PDF.co error:', pdfcoResult)
      throw new Error(pdfcoResult.message || 'PDF generation failed')
    }

    console.log('✅ PDF generated:', pdfcoResult.url)

    // Download PDF from PDF.co
    const pdfResponse = await fetch(pdfcoResult.url)
    const pdfBlob = await pdfResponse.arrayBuffer()

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('reports')
      .upload(storagePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      throw uploadError
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('reports')
      .getPublicUrl(storagePath)

    const pdfUrl = urlData.publicUrl

    console.log('✅ PDF saved to storage:', pdfUrl)

    // Update order with PDF URL if orderId provided
    if (orderId) {
      await supabase
        .from('orders')
        .update({
          pdf_url: pdfUrl,
          pdf_generated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
    }

    return new Response(
      JSON.stringify({
        success: true,
        pdfUrl: pdfUrl,
        storagePath: storagePath,
        message: 'PDF generated successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error generating PDF:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to generate PDF',
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
