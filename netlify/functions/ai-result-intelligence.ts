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
  // Flag can come in various formats - all should be handled
  flag: 'H' | 'L' | 'C' | 'N' | 'high' | 'low' | 'critical' | 'normal' | null | string;
  interpretation?: string | null;
  ai_suggested_flag?: string | null;
  ai_suggested_interpretation?: string | null;
  trend_interpretation?: string | null;
  // Historical data for trend analysis (from past orders and external reports)
  historical_values?: Array<{
    date: string;
    value: string;
    flag?: string | null;
    source: 'internal' | 'external';
    lab_name?: string; // For external reports
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

/** Supported languages for patient summary */
type SupportedLanguage = 
  | 'english' 
  | 'hindi' 
  | 'marathi' 
  | 'gujarati' 
  | 'tamil' 
  | 'telugu' 
  | 'kannada' 
  | 'bengali' 
  | 'punjabi' 
  | 'malayalam'
  | 'odia'
  | 'assamese';

interface PatientSummaryRequest {
  action: 'patient_summary';
  test_groups: Array<{
    name: string;
    category: string;
    result_values: ResultValue[];
  }>;
  language: SupportedLanguage;
  referring_doctor_name?: string;
  patient?: PatientContext;
}

type AIRequest = GenerateInterpretationsRequest | VerifierSummaryRequest | ClinicalSummaryRequest | AnalyzeResultValuesRequest | PatientSummaryRequest;

/**
 * Helper function to determine if a flag indicates abnormality
 * The flag field is the SOURCE OF TRUTH - we trust it completely
 */
function isAbnormalFlag(flag: string | null | undefined): boolean {
  if (!flag) return false;
  const normalizedFlag = flag.toLowerCase().trim();
  // These indicate abnormal results
  const abnormalFlags = ['h', 'l', 'c', 'high', 'low', 'critical', 'abnormal', 'critical_high', 'critical_low'];
  return abnormalFlags.includes(normalizedFlag);
}

/**
 * Helper function to determine if a flag indicates normal
 */
function isNormalFlag(flag: string | null | undefined): boolean {
  if (!flag) return true; // No flag = normal
  const normalizedFlag = flag.toLowerCase().trim();
  // These indicate normal results
  const normalFlags = ['n', 'normal', ''];
  return normalFlags.includes(normalizedFlag);
}

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
 * Includes historical data from past orders and external reports for trend analysis
 */
function buildClinicalSummaryPrompt(request: ClinicalSummaryRequest): string {
  const { test_groups, patient } = request;
  
  const allResults = test_groups.flatMap(tg => 
    tg.result_values.map(r => ({ ...r, test_group: tg.name }))
  );
  const abnormalResults = allResults.filter(r => r.flag);
  const resultsWithHistory = allResults.filter(r => r.historical_values && r.historical_values.length > 0);
  
  // Helper to format historical data for a result
  const formatHistory = (r: ResultValue): string => {
    if (!r.historical_values || r.historical_values.length === 0) return '';
    const history = r.historical_values
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5) // Last 5 values
      .map(h => `${h.date}: ${h.value}${h.flag ? ` [${h.flag}]` : ''} (${h.source}${h.lab_name ? ` - ${h.lab_name}` : ''})`);
    return `\n      Historical: ${history.join(' → ')}`;
  };

  const patientInfo = [
    patient?.age ? `Patient Age: ${patient.age} years` : '',
    patient?.gender ? `Patient Gender: ${patient.gender}` : '',
    patient?.clinical_notes ? `Clinical History: ${patient.clinical_notes}` : ''
  ].filter(Boolean).join('\n');

  const testResultsSection = test_groups.map(tg => {
    const testName = `**${tg.name}** (${tg.category})`;
    const results = tg.result_values.map(r => {
      const flag = r.flag ? ` [${r.flag === 'H' ? '↑' : r.flag === 'L' ? '↓' : '⚠️'}]` : '';
      return `  - ${r.analyte_name}: ${r.value} ${r.unit}${flag}${formatHistory(r)}`;
    }).join('\n');
    return `${testName}\n${results}`;
  }).join('\n\n');

  const historyNote = resultsWithHistory.length > 0 ? `
IMPORTANT: Historical data is available for ${resultsWithHistory.length} parameter(s). 
Analyze these trends to identify:
- Improving or worsening patterns
- Sudden changes that may indicate acute conditions
- Chronic abnormalities requiring monitoring
- Response to treatment (if clinical notes suggest any)
` : '';

  return `You are a clinical pathologist generating a comprehensive summary report for a referring physician.

${patientInfo}

Test Results by Group (current values with historical trends):
${testResultsSection}
${historyNote}
Generate a clinical summary suitable for the referring doctor that includes:
1. Brief interpretation of results (suitable for non-laboratory clinicians)
2. Clinically significant findings (highlight any notable trends from historical data)
3. Trend analysis where historical data is available (improving/worsening/stable)
4. Suggested correlations or follow-up tests if applicable
5. Any urgent findings requiring immediate attention

The tone should be professional, concise, and clinically useful.

Respond with a JSON object:
{
  "executive_summary": "2-3 sentence overview for quick reading...",
  "significant_findings": [
    {
      "finding": "Description of finding...",
      "clinical_significance": "Why this matters...",
      "test_group": "Which test group",
      "trend": "improving/worsening/stable/new_finding (if historical data exists)"
    }
  ],
  "trend_analysis": "Summary of trends observed from historical data (if available)...",
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
 * Generate patient-friendly summary in selected language
 * Medical/pathology terms remain in English for accuracy
 * Includes historical data from past orders and external reports
 */
function buildPatientSummaryPrompt(request: PatientSummaryRequest): string {
  const { test_groups, language, referring_doctor_name, patient } = request;
  
  const allResults = test_groups.flatMap(tg => 
    tg.result_values.map(r => ({ ...r, test_group: tg.name }))
  );
  
  // CRITICAL: Use helper functions to determine abnormal vs normal
  // The flag field is the source of truth - trust it!
  const abnormalResults = allResults.filter(r => isAbnormalFlag(r.flag));
  const normalResults = allResults.filter(r => isNormalFlag(r.flag));
  const resultsWithHistory = allResults.filter(r => r.historical_values && r.historical_values.length > 0);
  
  // Helper to format historical data for a result (simplified for patient understanding)
  const formatHistory = (r: ResultValue): string => {
    if (!r.historical_values || r.historical_values.length === 0) return '';
    const history = r.historical_values
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3) // Last 3 values for patient simplicity
      .map(h => `${h.date}: ${h.value}`);
    return ` (Previous: ${history.join(' → ')})`;
  };
  
  // Language display names for the prompt
  const languageNames: Record<SupportedLanguage, string> = {
    english: 'English',
    hindi: 'Hindi (हिन्दी)',
    marathi: 'Marathi (मराठी)',
    gujarati: 'Gujarati (ગુજરાતી)',
    tamil: 'Tamil (தமிழ்)',
    telugu: 'Telugu (తెలుగు)',
    kannada: 'Kannada (ಕನ್ನಡ)',
    bengali: 'Bengali (বাংলা)',
    punjabi: 'Punjabi (ਪੰਜਾਬੀ)',
    malayalam: 'Malayalam (മലയാളം)',
    odia: 'Odia (ଓଡ଼ିଆ)',
    assamese: 'Assamese (অসমীয়া)',
  };
  
  const targetLanguage = languageNames[language] || 'English';
  const doctorName = referring_doctor_name || 'your doctor';

  const patientInfo = [
    patient?.age ? `Age: ${patient.age} years` : 'Age: Not specified',
    patient?.gender ? `Gender: ${patient.gender}` : 'Gender: Not specified'
  ].join('\n');

  // Format results with clear status markers using helper function
  const testResultsSection = test_groups.map(tg => {
    const testName = `**${tg.name}**`;
    const results = tg.result_values.map(r => {
      // Use helper function to determine if this result is abnormal
      const abnormal = isAbnormalFlag(r.flag);
      const flagLower = (r.flag || '').toString().toLowerCase();
      const flagDisplay = abnormal
        ? ` [${flagLower === 'h' || flagLower === 'high' ? 'HIGH ↑ ABNORMAL' : flagLower === 'l' || flagLower === 'low' ? 'LOW ↓ ABNORMAL' : flagLower === 'c' || flagLower === 'critical' || flagLower === 'critical_high' || flagLower === 'critical_low' ? 'CRITICAL ⚠️' : 'ABNORMAL'}]`
        : ' [NORMAL ✓]';
      return `  - ${r.analyte_name}: ${r.value} ${r.unit} (Ref: ${r.reference_range})${flagDisplay}${formatHistory(r)}`;
    }).join('\n');
    return `${testName}\n${results}`;
  }).join('\n\n');

  // Pre-compute the list of actually abnormal findings to include in prompt
  const abnormalFindingsForPrompt = abnormalResults.length > 0 
    ? `\n\n⚠️ ACTUAL ABNORMAL FINDINGS TO EXPLAIN (only these ${abnormalResults.length} results are abnormal):\n${abnormalResults.map(r => `- ${r.analyte_name}: ${r.value} ${r.unit} [FLAG: ${r.flag}]`).join('\n')}`
    : '\n\n✅ ALL RESULTS ARE NORMAL - No abnormal findings to report.';

  const historyNote = resultsWithHistory.length > 0 ? `
HISTORICAL TREND DATA AVAILABLE:
${resultsWithHistory.length} test(s) have previous results from past visits. 
When explaining findings to the patient:
- Compare current values with previous ones
- Use simple terms like "improving", "stable", or "needs attention"
- Reassure if trends are positive
- Be honest but gentle if trends show concern
` : '';

  return `You are a healthcare communication specialist creating a patient-friendly summary of laboratory test results.

TARGET LANGUAGE: ${targetLanguage}

═══════════════════════════════════════════════════════════════════
🚨 CRITICAL INSTRUCTION - READ CAREFULLY 🚨
═══════════════════════════════════════════════════════════════════

The "flag" field in the input data is the AUTHORITATIVE SOURCE OF TRUTH.
- If flag = "normal", "N", or null/empty → The result is NORMAL. Do NOT mark it as abnormal.
- If flag = "H", "high" → The result is HIGH/ABNORMAL.
- If flag = "L", "low" → The result is LOW/ABNORMAL.  
- If flag = "C", "critical" → The result is CRITICAL.

DO NOT re-evaluate or second-guess the flag values!
DO NOT compare values against reference ranges yourself!
TRUST the flag field completely - it has been validated by the laboratory system.

If ALL results have flag = "normal" or no flag, then ALL results are normal.
Only include results in "abnormal_findings" if they have flag = H, L, C, high, low, or critical.

═══════════════════════════════════════════════════════════════════

IMPORTANT LANGUAGE RULES:
1. Write all explanations and descriptions in ${targetLanguage}
2. ALWAYS keep medical/pathology terms in ENGLISH (e.g., CBC, Hemoglobin, LDL Cholesterol, Lipid Profile, Creatinine)
3. The patient might not understand medical jargon - explain findings in simple, everyday language
4. If ${language} is 'english', write everything in English
5. For non-English languages, mix English medical terms naturally into ${targetLanguage} sentences

Patient Information:
${patientInfo}

Test Results (FLAG IS THE SOURCE OF TRUTH):
${testResultsSection}
${abnormalFindingsForPrompt}

Summary Statistics (BASED ON FLAGS):
- Total tests: ${allResults.length}
- NORMAL results (flag = normal/N/null): ${normalResults.length}
- ABNORMAL results (flag = H/L/C): ${abnormalResults.length}
- Tests with previous results: ${resultsWithHistory.length}
${historyNote}
Create a DETAILED and DESCRIPTIVE patient-friendly summary following these rules:

1. IF ALL RESULTS ARE NORMAL (abnormal count = 0):
   - Give a positive, reassuring message explaining the good news
   - "abnormal_findings" array MUST be empty []
   - "needs_consultation" should be false
   - STILL provide detailed explanations of EACH test in "normal_findings_detailed"
   - Provide personalized health maintenance tips

2. IF THERE ARE ABNORMAL RESULTS (abnormal count > 0):
   - Only explain the ACTUALLY abnormal results (those with flag = H/L/C) in "abnormal_findings"
   - Do NOT include normal results in the abnormal_findings array
   - Be honest but gentle about concerning findings
   - "needs_consultation" should be true
   - Recommend consulting ${doctorName}
   - STILL explain all normal results in "normal_findings_detailed"

3. For EVERY test result (normal or abnormal):
   - Explain what the test measures in simple terms
   - What does a normal value mean for the patient's health
   - Why this test is important for overall health

4. For historical data (if available):
   - Mention if values are improving, stable, or need attention
   - Compare current values with previous ones using simple terms

The tone should be:
- Warm, reassuring, and EDUCATIONAL
- Easy to understand for someone without medical background
- Help the patient understand what each test means for their body
- Empowering the patient with knowledge about their health
- Honest about abnormal findings without causing panic

Respond with a JSON object (all text content in ${targetLanguage} except medical terms in English):
{
  "health_status": "2-3 sentence overall health status. Be descriptive and reassuring. Mention the overall picture of health based on these results. In ${targetLanguage}...",
  "normal_findings_detailed": [
    // IMPORTANT: Include a detailed entry for EACH normal test result
    // This helps patients understand what their tests mean
    {
      "test_name": "Medical term in ENGLISH (e.g., Hemoglobin)",
      "value": "actual value with unit",
      "what_it_measures": "Simple 1-sentence explanation in ${targetLanguage} of what this test checks in the body...",
      "your_result_means": "Simple explanation in ${targetLanguage} of what having a normal result means for the patient's health and body function..."
    }
  ],
  "abnormal_findings": [
    // ONLY include results where flag = H, L, C, high, low, critical
    // If all results are normal, this array MUST be empty []
    {
      "test_name": "Medical term in ENGLISH (e.g., Hemoglobin)",
      "value": "actual value with unit",
      "status": "high|low|critical",
      "what_it_measures": "Simple explanation in ${targetLanguage} of what this test checks...",
      "explanation": "Simple explanation in ${targetLanguage} what the abnormal result means for the patient's health...",
      "what_to_do": "Simple actionable advice in ${targetLanguage}...",
      "trend": "improving|worsening|stable|new (only if historical data exists)"
    }
  ],
  "needs_consultation": ${abnormalResults.length > 0 ? 'true' : 'false'},
  "consultation_recommendation": "Message in ${targetLanguage}. If abnormal findings exist, recommend consulting ${doctorName} with specific reason. If all normal, provide reassurance and mention routine checkup recommendations...",
  "health_tips": [
    // Provide 3-5 SPECIFIC and PERSONALIZED health tips based on the actual tests performed
    "Specific health tip 1 in ${targetLanguage} relevant to maintaining good results for the tests done...",
    "Specific health tip 2 in ${targetLanguage}...",
    "Specific health tip 3 in ${targetLanguage}...",
    "Specific health tip 4 in ${targetLanguage} (optional but encouraged)...",
    "Specific health tip 5 in ${targetLanguage} (optional)..."
  ],
  "summary_message": "A warm, encouraging 2-3 sentence closing message in ${targetLanguage}. Thank them for taking care of their health. If all normal, celebrate that. If some abnormal, reassure them that with proper care things can improve...",
  "language": "${language}"
}

FINAL REMINDER: Only put results in "abnormal_findings" if their flag indicates abnormality (H/L/C/high/low/critical).
If all results are flagged as "normal" or have no flag, return an EMPTY abnormal_findings array: []

Return ONLY the JSON object, no additional text.`;
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
          maxOutputTokens: 8000,
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

      case 'patient_summary':
        if (!body.test_groups || !body.language) {
          return new Response(
            JSON.stringify({ error: 'test_groups and language are required for patient_summary' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        prompt = buildPatientSummaryPrompt(body as PatientSummaryRequest);
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
