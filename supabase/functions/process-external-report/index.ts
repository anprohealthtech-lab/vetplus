import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { file_url, patient_id } = await req.json()

    if (!file_url) {
      throw new Error('Missing file_url')
    }

    console.log(`Processing external report: ${file_url} for patient: ${patient_id}`);

    // 1. Fetch the file content
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch file: ${fileResponse.statusText}`);
    }
    const fileBlob = await fileResponse.blob();
    const arrayBuffer = await fileBlob.arrayBuffer();
    
    // Use Deno's standard library for efficient Base64 encoding to avoid stack overflow on large files
    const { encode } = await import("https://deno.land/std@0.168.0/encoding/base64.ts");
    const base64Data = encode(new Uint8Array(arrayBuffer));
    
    const mimeType = fileBlob.type; // e.g., 'application/pdf' or 'image/jpeg'

    // 2. Prepare Gemini Request
    const GEMINI_API_KEY = Deno.env.get('ALLGOOGLE_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('ALLGOOGLE_KEY is not set');
    }

    const prompt = `
      You are an expert lab report analyzer. Your task is to extract structured result data from the provided medical lab report.
      
      Extract the following fields for each test result found:
      - original_analyte_name: The name of the test or analyte exactly as it appears.
      - value: The numeric or text result value.
      - unit: The unit of measurement (e.g., mg/dL, g/L). If none, use null.
      - reference_range: The reference interval provided. If none, use null.
      - confidence: Your confidence score (0.0 to 1.0) in this extraction.

      Strictly return ONLY a JSON object with a "data" property containing an array of these objects. Do not include markdown formatting like \`\`\`json.
      
      Example format:
      {
        "data": [
          { "original_analyte_name": "Hemoglobin", "value": "13.5", "unit": "g/dL", "reference_range": "12.0-15.5", "confidence": 0.99 }
        ]
      }
    `;

    // 3. Call Gemini API (using gemini-2.0-flash-exp)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;
    
    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }]
    };

    const aiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`Gemini API Error: ${errorText}`);
    }

    const aiResult = await aiResponse.json();
    
    // 4. Parse AI Response
    let rawText = aiResult.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Empty response from AI');
    }

    // Clean up potential markdown formatting
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    let extractedData;
    try {
      const parsed = JSON.parse(rawText);
      extractedData = parsed.data || parsed; // Handle if AI returns array directly or wrapped in object
      if (!Array.isArray(extractedData)) {
         if (Array.isArray(parsed)) extractedData = parsed;
         else throw new Error('AI did not return an array');
      }
    } catch (e) {
      console.error("JSON Parse Error:", rawText);
      throw new Error('Failed to parse AI response as JSON');
    }

    // 5. Enhance with Metadata
    const responseData = {
      success: true,
      data: extractedData.map((item: any) => ({
        original_analyte_name: item.original_analyte_name || "Unknown",
        value: String(item.value || ""),
        unit: item.unit || "",
        reference_range: item.reference_range || "",
        confidence: item.confidence || 0,
        suggested_analyte_id: null
      })),
      ai_metadata: {
        model: "gemini-2.0-flash-exp",
        raw_response_length: rawText.length
      }
    };

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (error) {
    console.error("Error processing report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
