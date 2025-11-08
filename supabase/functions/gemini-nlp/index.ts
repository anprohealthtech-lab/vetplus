const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-attachment-id, x-order-id, x-batch-id, x-multi-image',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate authentication - check for either JWT token or API key
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const apiKey = req.headers.get('apikey') || req.headers.get('x-api-key');

    // Allow both anon key and service role key for backward compatibility
    console.log('Gemini NLP function invoked with auth');

    // Check for Gemini API key - try ALLGOOGLE_KEY first, then fallback to GEMINI_API_KEY
    const geminiApiKey = Deno.env.get('ALLGOOGLE_KEY') || Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.error('Google API key not configured');
      return new Response(
        JSON.stringify({ 
          error: 'Google API key not configured',
          details: 'Please set ALLGOOGLE_KEY or GEMINI_API_KEY in Supabase secrets'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const payload = await req.json();

    const {
      rawText,
      visionResults,
      originalBase64Image,
      documentType,
      testType,
      base64Image,
      aiProcessingType,
      aiPromptOverride,
      pipetteDetails,
      expectedColor,
      analyteCatalog,
      analytesToExtract,
      orderId: bodyOrderId,
      testGroupId,
    } = payload as GeminiRequest & {
      analyteCatalog?: Array<{ id?: string; name?: string | null; unit?: string | null; reference_range?: string | null; code?: string | null }>;
      analytesToExtract?: string[];
      orderId?: string;
      testGroupId?: string;
    };

    const focusAnalyteNames = deriveAnalyteFocusList(analyteCatalog, analytesToExtract);
    const extractionTargets = Array.isArray(analytesToExtract)
      ? analytesToExtract.filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
      : [];

    let prompt = '';
    let geminiResponse = '';

    console.log(`Starting Gemini NLP processing for ${aiProcessingType || documentType || testType || 'unknown'} type`);

    // Check if we need to use Gemini Vision fallback for OCR
    const shouldUseFallback = documentType && 
                             (!rawText || rawText.trim().length < 10) && 
                             originalBase64Image;

    if (shouldUseFallback) {
      console.log('Vision OCR extracted insufficient text, using Gemini Vision fallback');
      prompt = applyAnalyteFocus(generatePrompt('vision', documentType, 'fallback'), focusAnalyteNames, extractionTargets);
      geminiResponse = await callGemini(prompt, geminiApiKey, originalBase64Image);
    } else if (aiPromptOverride && aiPromptOverride.trim().length > 0) {
      console.log('Using custom AI prompt override');
      prompt = applyAnalyteFocus(aiPromptOverride, focusAnalyteNames, extractionTargets);
      geminiResponse = await callGemini(prompt, geminiApiKey, originalBase64Image);
    } else if (aiProcessingType) {
      // Use aiProcessingType for modern configuration
      console.log('Using aiProcessingType configuration:', aiProcessingType);
      
      if (aiProcessingType === 'ocr_report') {
        if (!rawText) {
          return new Response(
            JSON.stringify({ error: 'Missing rawText for OCR processing' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        prompt = applyAnalyteFocus(
          generatePrompt('ocr', 'printed-report', rawText),
          focusAnalyteNames,
          extractionTargets,
        );
        geminiResponse = await callGemini(prompt, geminiApiKey);
      } else if (aiProcessingType === 'vision_card') {
        prompt = applyAnalyteFocus(
          generatePrompt('vision', 'test-card', JSON.stringify(visionResults)),
          focusAnalyteNames,
          extractionTargets,
        );
        geminiResponse = await callGemini(prompt, geminiApiKey, base64Image || originalBase64Image);
      } else if (aiProcessingType === 'vision_color') {
        prompt = applyAnalyteFocus(
          generatePrompt('vision', 'color-analysis', JSON.stringify(visionResults)),
          focusAnalyteNames,
          extractionTargets,
        );
        geminiResponse = await callGemini(prompt, geminiApiKey, base64Image || originalBase64Image);
      } else {
        return new Response(
          JSON.stringify({ error: `Unsupported aiProcessingType: ${aiProcessingType}` }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    } else if (documentType) {
      // OCR-based processing (legacy)
      if (!rawText) {
        return new Response(
          JSON.stringify({ error: 'Missing rawText for OCR processing' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      prompt = applyAnalyteFocus(
        generatePrompt('ocr', documentType, rawText),
        focusAnalyteNames,
        extractionTargets,
      );

    if (!geminiResponse) {
      return new Response(
        JSON.stringify({
          error: 'Gemini returned an empty response',
          details: {
            aiProcessingType,
            documentType,
            testType,
            analyteFocusNames: focusAnalyteNames,
            analyteExtractionTargets: extractionTargets,
            orderId: bodyOrderId || null,
            testGroupId: testGroupId || null,
          },
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }
      geminiResponse = await callGemini(prompt, geminiApiKey);
      
    } else if (testType === 'pipette-validation') {
      // Pipette validation processing
      prompt = applyAnalyteFocus(
        generatePrompt('vision', 'pipette-validation', JSON.stringify({visionResults, pipetteDetails, expectedColor})),
        focusAnalyteNames,
        extractionTargets,
      );
      geminiResponse = await callGemini(prompt, geminiApiKey, base64Image);
      
    } else if (testType) {
      // Photo analysis processing
      prompt = applyAnalyteFocus(
        generatePrompt('vision', testType, JSON.stringify(visionResults)),
        focusAnalyteNames,
        extractionTargets,
      );
      geminiResponse = await callGemini(prompt, geminiApiKey, base64Image);
      
    } else {
      return new Response(
        JSON.stringify({ error: 'Missing aiProcessingType, documentType, or testType' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const attachmentIdHeader = req.headers.get('x-attachment-id');
    const orderIdHeader = req.headers.get('x-order-id');
    const requestOrderId = orderIdHeader || bodyOrderId || null;

    console.log(`Gemini processing completed. Type: ${aiProcessingType || documentType || testType}. Response length: ${geminiResponse.length} characters`);

    // Clean and parse Gemini response - handle markdown code blocks
    let cleanedResponse = geminiResponse.trim();
    
    // Remove markdown code block markers if present
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Parse Gemini response
    try {
      const jsonResponse = JSON.parse(cleanedResponse);
      
      // Handle different response types
      if (documentType === 'test-request-form') {
        // Test request form response
        const responseWithMetadata = {
          patient_details: jsonResponse.patient_details || {},
          requested_tests: jsonResponse.requested_tests || [],
          doctor_info: jsonResponse.doctor_info || {},
          metadata: {
            documentType: documentType || aiProcessingType,
            aiProcessingType: aiProcessingType || null,
            customPromptUsed: !!aiPromptOverride,
            processingMethod: 'Supabase Edge Functions + Gemini NLP',
            ocrConfidence: visionResults?.confidence || 0.95,
            extractedTextLength: rawText?.length || 0,
            processingTimestamp: new Date().toISOString(),
            analyteFocusNames: focusAnalyteNames,
            analyteExtractionTargets: extractionTargets,
            orderId: requestOrderId,
            testGroupId: testGroupId || null,
            analyteCatalogSize: analyteCatalog?.length || 0,
          }
        };
        
        return new Response(
          JSON.stringify(responseWithMetadata),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
        
      } else if (testType === 'pipette-validation') {
        // Pipette validation response
        const responseWithMetadata = {
          ...jsonResponse,
          metadata: {
            testType: testType || aiProcessingType,
            aiProcessingType: aiProcessingType || null,
            customPromptUsed: !!aiPromptOverride,
            processingMethod: 'Supabase Edge Functions + Gemini Vision',
            pipetteType: pipetteDetails?.name || 'Unknown',
            expectedColor: expectedColor || null,
            processingTimestamp: new Date().toISOString(),
            analyteFocusNames: focusAnalyteNames,
            analyteExtractionTargets: extractionTargets,
            orderId: requestOrderId,
            testGroupId: testGroupId || null,
            analyteCatalogSize: analyteCatalog?.length || 0,
          }
        };
        
        return new Response(
          JSON.stringify(responseWithMetadata),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
        
      } else if (testType) {
        // Photo analysis response
        const responseWithMetadata = {
          ...jsonResponse,
          metadata: {
            testType: testType || aiProcessingType,
            aiProcessingType: aiProcessingType || null,
            customPromptUsed: !!aiPromptOverride,
            processingMethod: 'Supabase Edge Functions + Gemini Vision',
            visionFeaturesUsed: Object.keys(visionResults || {}),
            processingTimestamp: new Date().toISOString(),
            analyteFocusNames: focusAnalyteNames,
            analyteExtractionTargets: extractionTargets,
            orderId: requestOrderId,
            testGroupId: testGroupId || null,
            analyteCatalogSize: analyteCatalog?.length || 0,
          }
        };
        
        return new Response(
          JSON.stringify(responseWithMetadata),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
        
      } else {
        // Default processing - lab results
        // Match extracted parameters to database analytes
        const enhancedParameters = await matchParametersToAnalytes(jsonResponse);
        
        const responseWithMetadata = {
          extractedParameters: enhancedParameters,
          metadata: {
            documentType: documentType || aiProcessingType,
            aiProcessingType: aiProcessingType || null,
            customPromptUsed: !!aiPromptOverride,
            processingMethod: 'Supabase Edge Functions + Gemini NLP',
            ocrConfidence: visionResults?.confidence || 0.95,
            extractedTextLength: rawText?.length || 0,
            processingTimestamp: new Date().toISOString(),
            matchedParameters: enhancedParameters.filter(p => p.matched).length,
            totalParameters: enhancedParameters.length,
            analyteFocusNames: focusAnalyteNames,
            analyteExtractionTargets: extractionTargets,
            orderId: requestOrderId,
            testGroupId: testGroupId || null,
            analyteCatalogSize: analyteCatalog?.length || 0,
          }
        };

        // If attachmentId and orderId are provided, save AI extraction metadata to results
        const attachmentId = attachmentIdHeader;
        const orderId = requestOrderId;
        
        if (attachmentId && orderId && enhancedParameters.length > 0) {
          const supabaseUrl = Deno.env.get('SUPABASE_URL');
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
          
          if (supabaseUrl && supabaseServiceKey) {
            try {
              // Check if result already exists for this order
              const existingResultResponse = await fetch(
                `${supabaseUrl}/rest/v1/results?order_id=eq.${orderId}&select=id`,
                {
                  headers: {
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'apikey': supabaseServiceKey,
                  },
                }
              );
              
              const existingResults = await existingResultResponse.json();
              
              if (existingResults && existingResults.length > 0) {
                // Update existing result with AI metadata
                await fetch(
                  `${supabaseUrl}/rest/v1/results?id=eq.${existingResults[0].id}`,
                  {
                    method: 'PATCH',
                    headers: {
                      'Authorization': `Bearer ${supabaseServiceKey}`,
                      'apikey': supabaseServiceKey,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      extracted_by_ai: true,
                      ai_confidence: visionResults?.confidence || 0.95,
                      ai_extraction_metadata: {
                        attachment_id: attachmentId,
                        processing_type: aiProcessingType || documentType,
                        custom_prompt_used: !!aiPromptOverride,
                        extraction_timestamp: new Date().toISOString(),
                        parameters_found: enhancedParameters.length,
                        parameters_matched: enhancedParameters.filter(p => p.matched).length,
                        extracted_parameters: enhancedParameters
                      }
                    })
                  }
                );
                console.log(`Updated existing result ${existingResults[0].id} with AI extraction metadata`);
              }
            } catch (updateError) {
              console.error('Failed to update result with AI metadata:', updateError);
              // Don't fail the request if metadata update fails
            }
          }
        }
        
        return new Response(
          JSON.stringify(responseWithMetadata),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
    } catch (jsonError) {
      console.warn('Gemini response was not valid JSON, returning raw text');
      console.log('Cleaned response that failed to parse:', cleanedResponse);
      return new Response(
        JSON.stringify({ 
          rawText: cleanedResponse,
          originalResponse: geminiResponse,
          metadata: {
            documentType: documentType || testType || aiProcessingType,
            aiProcessingType: aiProcessingType || null,
            customPromptUsed: !!aiPromptOverride,
            processingMethod: 'Supabase Edge Functions + Gemini',
            processingTimestamp: new Date().toISOString()
          },
          message: 'Gemini response could not be parsed as JSON.' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('Gemini NLP function error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Gemini processing failed', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

interface GeminiRequest {
  rawText?: string;
  visionResults?: any;
  documentType?: string;
  testType?: string;
  base64Image?: string;
  originalBase64Image?: string;
  pipetteDetails?: any;
  expectedColor?: any;
  aiProcessingType?: string;
  aiPromptOverride?: string;
  analyteCatalog?: AnalyteCatalogEntry[];
  analytesToExtract?: AnalytesToExtract;
  orderId?: string;
  testGroupId?: string;
}

type AnalyteCatalogEntry = {
  id?: string;
  name?: string | null;
  unit?: string | null;
  reference_range?: string | null;
  code?: string | null;
};

type AnalytesToExtract = string[] | string | null | undefined;

/**
 * Prompt template configurations
 */
const PROMPT_TEMPLATES = {
  base: "You are a medical lab assistant AI. Return only a valid JSON object, no additional text.",
  
  formats: {
    labResult: `[{"parameter": "Name", "value": "Value", "unit": "Unit", "reference_range": "Range", "flag": "Normal/High/Low"}]`,
    testCard: `{"testType": "Test Card", "testResult": "Result", "details": {}, "confidenceLevel": 95, "interpretation": "Analysis"}`,
    patientForm: `{"patient_details": {"first_name": "", "last_name": "", "age": 0, "gender": "", "phone": "", "email": ""}, "requested_tests": [], "doctor_info": {"name": ""}}`
  },
  
  instructions: {
    ocr: "Extract lab parameters focusing on: parameter names, numeric values, units, reference ranges, flags (H/L/Normal/Abnormal)",
    vision: "Analyze for diagnostic results focusing on: control/test lines, color changes, overall test validity",
    form: "Extract patient details and requested tests from form"
  }
};

/**
 * Generate optimized prompts
 */
function generatePrompt(type: string, subtype: string, data: string): string {
  const { base, formats, instructions } = PROMPT_TEMPLATES;
  
  if (type === 'ocr') {
    return `${base}\n\nFrom this ${subtype} text, ${instructions.ocr}\n\nExpected format: ${formats.labResult}\n\nText: ${data}`;
  }
  
  if (type === 'vision') {
    return `${base}\n\nAnalyze this ${subtype} image. ${instructions.vision}\n\nExpected format: ${formats.testCard}\n\nVision AI data: ${data}`;
  }
  
  if (type === 'form') {
    return `${base}\n\nFrom this form, ${instructions.form}\n\nExpected format: ${formats.patientForm}\n\nText: ${data}`;
  }
  
  return `${base}\n\nAnalyze this ${subtype} and extract relevant medical data.\n\nExpected format: ${formats.labResult}\n\nData: ${data}`;
}

/**
 * Generate pipette validation prompt
 */
function generatePipettePrompt(visionResults: any, pipetteDetails: any, expectedColor: any): string {
  return `You are a laboratory pipette validation expert. Return only a valid JSON object, no additional text.

Analyze this pipette validation image:

Vision AI detected colors: ${JSON.stringify(visionResults.colors?.slice(0, 3) || [])}
Vision AI detected objects: ${JSON.stringify(visionResults.objects?.slice(0, 5) || [])}

Pipette Details: ${JSON.stringify(pipetteDetails || {})}
Expected Patient Color: ${JSON.stringify(expectedColor || {})}

Expected format:
{
  "volume": 1000,
  "measuredVolume": 995,
  "accuracy": 99.5,
  "precision": 1.2,
  "passFailStatus": "Pass",
  "imageQuality": "Good",
  "validationResults": [
    {
      "volume": 1000,
      "measured": 995,
      "accuracy": 99.5,
      "precision": 1.2,
      "date": "2024-01-20",
      "status": "Pass",
      "imageQuality": "Good",
      "liquidLevel": "Clear detection"
    }
  ]
}

Focus on:
- Liquid volume estimation from meniscus level
- Color validation against expected patient color
- Image quality assessment
- ISO 8655 compliance validation`;
}

/**
 * Call Google Gemini API
 */
async function callGemini(prompt: string, geminiApiKey: string, imageData?: string): Promise<any> {
  // Use updated Gemini models and API endpoint
  const model = imageData ? 'gemini-2.0-flash-exp' : 'gemini-2.0-flash-exp';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

  let requestBody;
  
  if (imageData) {
    // Remove data URL prefix if present
    const cleanBase64 = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // For image-based requests
    requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: cleanBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        topK: 32,
        topP: 1,
        maxOutputTokens: 4096,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };
  } else {
    // For text-only requests
    requestBody = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        topK: 32,
        topP: 1,
        maxOutputTokens: 4096,
      }
    };
  }

  console.log(`Calling Gemini API with model: ${model}`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API Error Details:', errorText);
    throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  
  // Check for API errors in response
  if (result.error) {
    throw new Error(`Gemini API response error: ${result.error.message}`);
  }
  
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) {
    console.error('No text in Gemini response:', JSON.stringify(result, null, 2));
    throw new Error('No response from Gemini');
  }

  return text;
}

/**
 * Match extracted parameters to database analytes
 */
async function matchParametersToAnalytes(extractedParameters: any[]): Promise<any[]> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('Supabase configuration missing, skipping analyte matching');
      return extractedParameters;
    }

    // Fetch all analytes from database
    const analytesResponse = await fetch(
      supabaseUrl + '/rest/v1/analytes?select=id,name,unit,reference_range',
      {
        headers: {
          'Authorization': 'Bearer ' + supabaseServiceKey,
          'apikey': supabaseServiceKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!analytesResponse.ok) {
      console.warn('Failed to fetch analytes, skipping matching');
      return extractedParameters;
    }

    const analytes = await analytesResponse.json();

    // Match each extracted parameter to analytes
    const enhancedParameters = extractedParameters.map(param => {
      const matchedAnalyte = analytes.find((analyte: any) => 
        analyte.name.toLowerCase().trim() === param.parameter.toLowerCase().trim()
      );

      if (matchedAnalyte) {
        return {
          ...param,
          analyte_id: matchedAnalyte.id,
          matched: true,
          reference_range: param.reference_range || matchedAnalyte.reference_range,
          unit: param.unit || matchedAnalyte.unit
        };
      }

      return {
        ...param,
        matched: false
      };
    });

    console.log(`Matched ${enhancedParameters.filter(p => p.matched).length} of ${extractedParameters.length} parameters to database analytes`);

    return enhancedParameters;

  } catch (error) {
    console.warn('Error matching parameters to analytes:', error);
    return extractedParameters;
  }
}

function deriveAnalyteFocusList(
  catalog: AnalyteCatalogEntry[] = [],
  requestedAnalytes: AnalytesToExtract,
): string[] {
  const catalogEntries = catalog.filter((entry) => (entry?.name || '').trim().length > 0);
  const catalogNames = uniqueStrings(
    catalogEntries.map((entry) => (entry.name || '').trim()),
  );

  const requestedList = normalizeAnalyteList(requestedAnalytes);

  if (requestedList.length === 0) {
    return catalogNames;
  }

  const nameLookup = new Map<string, string>();
  const codeLookup = new Map<string, string>();

  catalogEntries.forEach((entry) => {
    const normalizedName = normalizeIdentifier(entry.name);
    const normalizedCode = normalizeIdentifier(entry.code);

    if (normalizedName) {
      nameLookup.set(normalizedName, (entry.name || '').trim());
    }

    if (normalizedCode && entry.name) {
      codeLookup.set(normalizedCode, entry.name.trim());
    }
  });

  const resolvedNames = requestedList
    .map((identifier) => {
      const normalized = normalizeIdentifier(identifier);
      if (!normalized) {
        return null;
      }

      return nameLookup.get(normalized) || codeLookup.get(normalized) || identifier;
    })
    .filter((value): value is string => !!value && value.trim().length > 0);

  return resolvedNames.length > 0 ? uniqueStrings(resolvedNames) : catalogNames;
}

function normalizeIdentifier(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function normalizeAnalyteList(input: AnalytesToExtract): string[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return uniqueStrings(
      input
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0),
    );
  }

  if (typeof input === 'string') {
    return uniqueStrings(
      input
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    );
  }

  return [];
}

function uniqueStrings(values: string[]): string[] {
  return [
    ...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  ];
}

function applyAnalyteFocus(
  basePrompt: string,
  focusAnalytes: string[],
  extractionTargets: string[],
): string {
  if (focusAnalytes.length === 0 && extractionTargets.length === 0) {
    return basePrompt;
  }

  const focusInstructions: string[] = [];

  if (focusAnalytes.length > 0) {
    focusInstructions.push(
      `Focus exclusively on these analytes for interpretation: ${focusAnalytes.join(', ')}`,
    );
  }

  if (extractionTargets.length > 0) {
    focusInstructions.push(
      `Only return structured output for these analytes: ${extractionTargets.join(', ')}`,
    );
  }

  return `${basePrompt}\n\n${focusInstructions.join('\n')}`;
}