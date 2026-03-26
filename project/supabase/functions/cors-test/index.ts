// Minimal CORS test function
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

serve(async (req) => {
  console.log('📥 Request received:', req.method, req.url)
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    console.log('✅ Returning OPTIONS response')
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    })
  }

  console.log('✅ Returning POST response')
  return new Response(
    JSON.stringify({ success: true, message: 'CORS test passed!' }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
})
