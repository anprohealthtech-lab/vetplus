import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SearchRequest {
  userQuery: string
  labId: string
  matchThreshold?: number // 0.0 to 1.0 (default 0.7)
  matchCount?: number // How many suggestions to return (default 5)
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { 
      userQuery, 
      labId, 
      matchThreshold = 0.7, 
      matchCount = 5 
    }: SearchRequest = await req.json()

    if (!userQuery || !labId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'userQuery and labId are required' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Searching placeholders for lab ${labId}: "${userQuery}"`)

    // 1. Generate query embedding via Gemini
    const GOOGLE_API_KEY = Deno.env.get('ALLGOOGLE_KEY')
    if (!GOOGLE_API_KEY) {
      throw new Error('ALLGOOGLE_KEY not configured')
    }

    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })
    
    const result = await model.embedContent(userQuery)
    const queryEmbedding = result.embedding.values

    // 2. Vector similarity search using database function
    const { data: matches, error: searchError } = await supabaseClient.rpc(
      'match_placeholders',
      {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        filter_lab_id: labId,
      }
    )

    if (searchError) {
      console.error('Vector search error:', searchError)
      throw new Error(`Vector search failed: ${searchError.message}`)
    }

    // 3. Format suggestions for AI agent
    const suggestions = matches?.map((match: any) => ({
      placeholder: `{{${match.placeholder_name}}}`,
      displayName: match.display_name,
      confidence: match.similarity,
      context: match.test_group_name 
        ? `Part of ${match.test_group_name} test` 
        : 'General placeholder',
      category: match.category,
      unit: match.unit,
      referenceRange: match.reference_range,
      exampleValue: match.example_value,
      insertHtml: generateInsertHtml(match),
    })) || []

    return new Response(
      JSON.stringify({
        success: true,
        query: userQuery,
        suggestions,
        count: suggestions.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('AI search error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Helper to generate HTML snippet for insertion
function generateInsertHtml(match: any): string {
  const placeholder = `{{${match.placeholder_name}}}`
  
  switch (match.placeholder_type) {
    case 'value':
      return `<p>${match.display_name.replace(' (Value)', '')}: ${placeholder} ${match.unit || ''}</p>`
    case 'flag':
      return `<span class="flag">${placeholder}</span>`
    case 'range':
      return `<p>Reference Range: ${placeholder}</p>`
    default:
      return `<p>${placeholder}</p>`
  }
}
