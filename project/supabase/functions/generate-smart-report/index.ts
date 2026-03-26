
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GAMMA_API_KEY = 'sk-gamma-lTDqDYXVz6QTreO50hMEnyTnREmjGOMyqgcoYOwpvk';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { html } = await req.json()

    if (!html) {
      console.error('❌ Error: Missing HTML content in request body');
      throw new Error('Missing HTML content')
    }

    console.log(`📝 Received HTML input length: ${html.length}`);
    console.log(`📝 HTML Snippet: ${html.substring(0, 100)}...`);

    // 1. Initiate Generation
    console.log('🚀 Initiating Gamma direct generation...');
    
    const initiateResponse = await fetch('https://public-api.gamma.app/v1.0/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': GAMMA_API_KEY,
        'accept': 'application/json'
      },
      body: JSON.stringify({
        textMode: "generate",
        inputText: `https://ik.imagekit.io/18tsendxqy/Screenshot%202026-01-05%20213225.png\n\n${html}`,
        format: "document",
        themeId: "wbpgwj9c0ty5wbo",
        cardSplit: "inputTextBreaks",
        additionalInstructions: "dont add any oher image render all url",
        exportAs: "pdf",
        sharingOptions: {
          workspaceAccess: "edit",
          externalAccess: "edit"
        },
        imageOptions: {
          source: "placeholder"
        }
      })
    })

    if (!initiateResponse.ok) {
        const errText = await initiateResponse.text()
        console.error('❌ Gamma Init Error:', errText)
        throw new Error(`Gamma API Initialization Failed: ${initiateResponse.status} - ${errText}`)
    }

    const initData = await initiateResponse.json()
    console.log('📦 Gamma Init Response:', JSON.stringify(initData));
    
    const generationId = initData.generationId
    
    if (!generationId) {
        throw new Error('No generation ID received from Gamma')
    }

    console.log('✅ Generation started with ID:', generationId)

    // 2. Poll for Completion
    let attempts = 0
    const maxAttempts = 60 // 60 attempts * 2s = ~2 mins timeout
    let result = null

    while (attempts < maxAttempts) {
        attempts++
        await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2s

        const pollResponse = await fetch(`https://public-api.gamma.app/v1.0/generations/${generationId}`, {
            method: 'GET',
            headers: {
                'X-API-KEY': GAMMA_API_KEY,
                'accept': 'application/json'
            }
        })

        if (!pollResponse.ok) {
             console.warn(`Poll attempt ${attempts} failed:`, await pollResponse.text())
             continue
        }

        const pollData = await pollResponse.json()
        console.log(`Poll status (${attempts}):`, pollData.status)

        if (pollData.status === 'completed') {
            result = pollData
            break
        } else if (pollData.status === 'error' || pollData.status === 'failed') {
            throw new Error(`Gamma generation failed: ${JSON.stringify(pollData)}`)
        }
    }

    if (!result) {
        throw new Error('Gamma generation timed out')
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
