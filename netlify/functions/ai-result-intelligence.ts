/**
 * AI Result Intelligence - Netlify Edge Function
 * 
 * Provides AI-powered clinical intelligence for laboratory results:
 * 1. Generate missing interpretations for analytes
 * 2. Generate verifier summary for test groups
 * 3. Generate clinical summary for referring doctors
 */

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const GEMINI_MODEL = "gemini-2.0-flash";

interface AnalyteData {
  id: string;
  name: string;
  unit: string;
  reference_range: string;
  interpretation_low?: string | null;
  interpretation_normal?: string | null;
  interpretation_high?: string | null;
}

interface ResultValue {
  id?: string; // result_value ID
  analyte_id?: string;
  analyte_name: string;
  value: string;
  unit: string;
  reference_range: string;
  flag: 'H' | 'L' | 'C' | null;
  interpretation?: string | null;
  ai_suggested_flag?: string | null;
  ai_suggested_interpretation?: string | null;
  trend_interpretation?: string | null;
  // Historical data for trend analysis
  historical_values?: Array<{
    date: string;
    value: string;
    flag?: string | null;
  }>;
}

interface TestGroupContext {
  test_group_name: string;
  test_group_code: string;
  category?: string;
  clinical_purpose?: string;
}

interface PatientContext {
  age?: number;
  gender?: string;
  clinical_notes?: string;
}

// Request types
interface GenerateInterpretationsRequest {
  action: 'generate_interpretations';
  analytes: AnalyteData[];
  test_group: TestGroupContext;
}

interface VerifierSummaryRequest {
  action: 'verifier_summary';
  test_group: TestGroupContext;
  result_values: ResultValue[];
  patient?: PatientContext;
}

interface ClinicalSummaryRequest {
  action: 'clinical_summary';
  test_groups: Array<{
    name: string;
    category: string;
    result_values: ResultValue[];
  }>;
  patient?: PatientContext;
}

interface AnalyzeResultValuesRequest {
  action: 'analyze_result_values';
  result_values: ResultValue[];
  patient?: PatientContext;
  trend_data?: any;
}

type AIRequest = GenerateInterpretationsRequest | VerifierSummaryRequest | ClinicalSummaryRequest | AnalyzeResultValuesRequest;

/**
 * Generate interpretations for analytes missing them
 */
function buildInterpretationsPrompt(request: GenerateInterpretationsRequest): string {
  const { analytes, test_group } = request;
  
  return `You are a clinical laboratory scientist generating standardized interpretation text for laboratory analytes.

Context:
- Test Group: ${test_group.test_group_name} (${test_group.test_group_code})
- Category: ${test_group.category || 'General'}
- Clinical Purpose: ${test_group.clinical_purpose || 'Not specified'}

For each analyte below, generate clinical interpretations for LOW, NORMAL, and HIGH values.
The interpretations should be:
- Professional medical language suitable for lab reports
- Concise but clinically informative (1-2 sentences each)
- Describe clinical significance and potential implications
- Use standard medical terminology

Analytes requiring interpretations:
${analytes.map((a, i) => `
${i + 1}. ${a.name}
   - Unit: ${a.unit}
   - Reference Range: ${a.reference_range}
   - Current interpretation_low: ${a.interpretation_low || 'MISSING'}
   - Current interpretation_normal: ${a.interpretation_normal || 'MISSING'}
   - Current interpretation_high: ${a.interpretation_high || 'MISSING'}
`).join('\n')}

Respond with a JSON object with this exact structure:
{
  "interpretations": [
    {
      "analyte_id": "id from input",
      "analyte_name": "name",
      "interpretation_low": "Clinical text for low values...",
      "interpretation_normal": "Clinical text for normal values...",
      "interpretation_high": "Clinical text for high values..."
    }
  ]
}

Only generate interpretations for fields marked as MISSING. Keep existing interpretations unchanged.
Return ONLY the JSON object, no additional text.`;
}

/**
 * Generate verifier summary for a test group
 */
function buildVerifierSummaryPrompt(request: VerifierSummaryRequest): string {
  const { test_group, result_values, patient } = request;
  
  const flaggedResults = result_values.filter(r => r.flag);
  const criticalResults = result_values.filter(r => r.flag === 'C');
  
  return `You are a senior clinical laboratory scientist reviewing test results before approval.

Test Group: ${test_group.test_group_name} (${test_group.test_group_code})
Category: ${test_group.category || 'General'}
${patient?.age ? `Patient Age: ${patient.age}` : ''}
${patient?.gender ? `Patient Gender: ${patient.gender}` : ''}
${patient?.clinical_notes ? `Clinical Notes: ${patient.clinical_notes}` : ''}

Results to Review:
${result_values.map(r => `- ${r.analyte_name}: ${r.value} ${r.unit} (Ref: ${r.reference_range})${r.flag ? ` [${r.flag === 'H' ? 'HIGH' : r.flag === 'L' ? 'LOW' : 'CRITICAL'}]` : ''}`).join('\n')}

Summary Statistics:
- Total analytes: ${result_values.length}
- Flagged results: ${flaggedResults.length}
- Critical values: ${criticalResults.length}

Generate a concise verifier summary that includes:
1. Overall assessment (1 sentence)
2. Key abnormal findings requiring attention
3. Any critical values that need immediate action
4. Recommendation (approve/needs clarification/reject)

Respond with a JSON object:
{
  "overall_assessment": "Brief overall assessment...",
  "abnormal_findings": ["Finding 1...", "Finding 2..."],
  "critical_alerts": ["Critical alert if any..."],
  "recommendation": "approve|needs_clarification|reject",
  "recommendation_reason": "Brief reason for recommendation...",
  "verifier_notes": "Optional notes for the record..."
}

Return ONLY the JSON object, no additional text.`;
}

/**
 * Generate clinical summary for referring doctors
 */
function buildClinicalSummaryPrompt(request: ClinicalSummaryRequest): string {
  const { test_groups, patient } = request;
  
  const allResults = test_groups.flatMap(tg => 
    tg.result_values.map(r => ({ ...r, test_group: tg.name }))
  );
  const abnormalResults = allResults.filter(r => r.flag);
  
  return `You are a clinical pathologist generating a summary report for a referring physician.

${patient?.age ? `Patient Age: ${patient.age} years` : ''}
${patient?.gender ? `Patient Gender: ${patient.gender}` : ''}
${patient?.clinical_notes ? `Clinical History: ${patient.clinical_notes}` : ''}

Test Results by Group:
${test_groups.map(tg => `
**${tg.name}** (${tg.category})
${tg.result_values.map(r => `  - ${r.analyte_name}: ${r.value} ${r.unit}${r.flag ? ` [${r.flag === 'H' ? '↑' : r.flag === 'L' ? '↓' : '⚠️'}]` : ''}`).join('\n')}
`).join('\n')}

Generate a clinical summary suitable for the referring doctor that includes:
1. Brief interpretation of results (suitable for non-laboratory clinicians)
2. Clinically significant findings
3. Suggested correlations or follow-up tests if applicable
4. Any urgent findings requiring immediate attention

The tone should be professional, concise, and clinically useful.

Respond with a JSON object:
{
  "executive_summary": "2-3 sentence overview for quick reading...",
  "significant_findings": [
    {
      "finding": "Description of finding...",
      "clinical_significance": "Why this matters...",
      "test_group": "Which test group"
    }
  ],
  "suggested_followup": ["Suggested action or test if any..."],
  "urgent_findings": ["Any findings requiring immediate attention..."],
  "clinical_interpretation": "Detailed interpretation paragraph for the report..."
}

Return ONLY the JSON object, no additional text.`;
}

/**
 * Analyze result values and generate AI suggestions
 */
function buildAnalyzeResultValuesPrompt(request: AnalyzeResultValuesRequest): string {
  const { result_values, patient, trend_data } = request;
  
  return `You are an AI assistant helping laboratory technicians by suggesting flags and interpretations for test result values.

${patient?.age ? `Patient Age: ${patient.age} years` : ''}
${patient?.gender ? `Patient Gender: ${patient.gender}` : ''}
${patient?.clinical_notes ? `Clinical Notes: ${patient.clinical_notes}` : ''}

For each result value below, analyze and provide:
1. **Suggested Flag**: Based on reference range comparison (L=Low, H=High, C=Critical, N=Normal)
2. **Value Interpretation**: Clinical interpretation of THIS specific result value (2-3 sentences)
3. **Trend Interpretation**: If historical data is provided, comment on the trend (improving/worsening/stable)

Result Values to Analyze:
${result_values.map((rv, i) => `
${i + 1}. ID: "${rv.id || 'unknown'}"
   Analyte: ${rv.analyte_name}
   Current Value: ${rv.value} ${rv.unit}
   Reference Range: ${rv.reference_range}
   ${rv.historical_values ? `Historical Values: ${rv.historical_values.map(h => `${h.date}: ${h.value}${h.flag ? ` (${h.flag})` : ''}`).join(', ')}` : 'No historical data'}
`).join('\n')}

Guidelines:
- For Flag: Compare value to reference range. Use 'C' for critically abnormal values that require immediate attention.
- For Value Interpretation: Explain what this result means clinically. Be specific and concise.
- For Trend Interpretation: Only if historical data exists, comment on whether the value is improving, worsening, or stable over time.

IMPORTANT: You MUST include the exact "id" value from the input in your response for each result.

Respond with a JSON array:
[
  {
    "id": "exact id from input - REQUIRED",
    "analyte_name": "name",
    "ai_suggested_flag": "L|H|C|N",
    "ai_suggested_interpretation": "Clinical interpretation of this specific value...",
    "trend_interpretation": "Trend analysis if historical data provided, otherwise null"
  }
]

Return ONLY the JSON array, no additional text.`;
}

/**
 * Extract JSON from Gemini response
 */
function extractJsonFromResponse(response: any): any {
  // Check candidates array
  if (response?.candidates && Array.isArray(response.candidates)) {
    for (const candidate of response.candidates) {
      // Check content.parts array
      if (candidate?.content?.parts && Array.isArray(candidate.content.parts)) {
        for (const part of candidate.content.parts) {
          if (part?.text) {
            const text = part.text.trim();
            try {
              // Try direct parse
              return JSON.parse(text);
            } catch {
              // Try to extract JSON from markdown code blocks
              const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
              if (jsonMatch) {
                return JSON.parse(jsonMatch[1].trim());
              }
              // Try to find JSON object in text
              const objMatch = text.match(/\{[\s\S]*\}/);
              if (objMatch) {
                return JSON.parse(objMatch[0]);
              }
            }
          }
        }
      }
    }
  }
  
  throw new Error('Could not extract JSON from Gemini response');
}

async function callGemini(prompt: string, apiKey: string): Promise<any> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2, // Low temperature for consistent medical language
          topP: 0.9,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const responseData = await response.json();
  return extractJsonFromResponse(responseData);
}

async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const apiKey = process.env.ALLGOOGLE_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: AIRequest = await req.json();
    
    if (!body.action) {
      return new Response(
        JSON.stringify({ error: 'Action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let prompt: string;
    let result: any;

    switch (body.action) {
      case 'generate_interpretations':
        if (!body.analytes || !body.test_group) {
          return new Response(
            JSON.stringify({ error: 'analytes and test_group are required for generate_interpretations' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        prompt = buildInterpretationsPrompt(body as GenerateInterpretationsRequest);
        result = await callGemini(prompt, apiKey);
        break;

      case 'verifier_summary':
        if (!body.test_group || !body.result_values) {
          return new Response(
            JSON.stringify({ error: 'test_group and result_values are required for verifier_summary' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        prompt = buildVerifierSummaryPrompt(body as VerifierSummaryRequest);
        result = await callGemini(prompt, apiKey);
        break;

      case 'clinical_summary':
        if (!body.test_groups) {
          return new Response(
            JSON.stringify({ error: 'test_groups are required for clinical_summary' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        prompt = buildClinicalSummaryPrompt(body as ClinicalSummaryRequest);
        result = await callGemini(prompt, apiKey);
        break;

      case 'analyze_result_values':
        if (!body.result_values) {
          return new Response(
            JSON.stringify({ error: 'result_values are required for analyze_result_values' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        prompt = buildAnalyzeResultValuesPrompt(body as AnalyzeResultValuesRequest);
        result = await callGemini(prompt, apiKey);
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${(body as any).action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI Result Intelligence error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process AI request', 
        details: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

export default handler;
export const config = { runtime: 'edge' };
