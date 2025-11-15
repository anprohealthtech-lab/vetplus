const PROMPT_INTRO = `You are an expert HTML template assistant for laboratory reports.
You receive:
- currentHtml: the existing GrapesJS HTML template (no scripts allowed).
- currentCss: optional CSS string for the template.
- instructions: user instructions describing desired modifications.
Return JSON with { html: string, css?: string, summary?: string, warnings?: string[] }.

CRITICAL SECURITY RULES (MUST FOLLOW):
- NEVER include <script> tags in the HTML
- NEVER include inline event handlers (onload, onerror, onclick, etc.)
- NEVER include javascript: URLs
- NEVER include <iframe> tags
- ONLY return pure HTML markup with CSS styling

Global layout contract (always enforce, even if the user does not mention it):
1. Immediately after the header logo/banner include a two-column table covering Patient Name, Patient Age, Registration Date, Location/Collection Centre, Sample Collected At, Approved/Verified At, and Referring Doctor. Use existing placeholders when present (e.g. {{patientName}}, {{patientAge}}, {{registrationDate}}, {{locationName}}, {{sampleCollectedAt}}, {{approvedAt}}, {{referringDoctorName}}) and otherwise introduce clearly named placeholders in the same {{snakeCase}} pattern.
2. Preserve or add a header image/logo container at the very top (use a <div> or <figure> with a placeholder <img> whose src is something like {{headerImageUrl}}).
3. Ensure a printable friendly footer image container exists before closing the document, plus a signature block with an <img> placeholder such as {{signatoryImageUrl}} and text placeholders for name/title.
4. Keep placeholders and blocks accessible (semantic headings, table headers, no inline event handlers).
Constraints:
1. Modify only what the user asks for in addition to enforcing the contract above while keeping existing double-curly placeholders exactly intact.
2. Avoid <script>, inline event handlers, javascript: URLs, or remote assets.
3. Keep layout printable and accessible.
If the request is unclear, respond with a summary asking for clarification and leave html empty.

IMPORTANT: Your response must be valid JSON. Do NOT include any <script> tags or JavaScript code in the html field.`;

const GEMINI_MODEL = 'gemini-2.0-flash';

const FORBIDDEN_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /onload\s*=/i,
  /onerror\s*=/i,
  /<iframe/i,
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function sanitizeResponse(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return { warnings: ['AI response was empty or invalid.'] };
  }

  const sanitized = { ...candidate };

  if (sanitized.html) {
    // Check each forbidden pattern individually for better debugging
    const foundPatterns = [];
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(sanitized.html)) {
        foundPatterns.push(pattern.toString());
      }
    }

    if (foundPatterns.length > 0) {
      console.warn('Found forbidden patterns in HTML:', foundPatterns);
      console.warn('HTML preview (first 500 chars):', sanitized.html.substring(0, 500));
      
      sanitized.warnings = [
        ...(Array.isArray(sanitized.warnings) ? sanitized.warnings : []),
        `AI response contained potentially unsafe markup (${foundPatterns.join(', ')}) and was removed.`,
      ];
      sanitized.html = undefined;
    }
  }

  return sanitized;
}

function extractCandidatePayload(rawResponse) {
  if (!rawResponse || typeof rawResponse !== 'object') {
    return null;
  }
  // Try common candidate shapes from different Gemini / GL API versions
  const candidates = Array.isArray(rawResponse.candidates) ? rawResponse.candidates : [];
  for (const candidate of candidates) {
    // Newer responses may include content.parts (array)
    const parts = candidate?.content?.parts || candidate?.content || candidate?.output?.content;
    if (Array.isArray(parts) && parts.length) {
      const textPayload = parts
        .map((part) => {
          if (!part) return '';
          if (typeof part === 'string') return part;
          if (typeof part.text === 'string') return part.text;
          if (typeof part.content === 'string') return part.content;
          return '';
        })
        .join('\n')
        .trim();

      if (textPayload) {
        try {
          return JSON.parse(textPayload);
        } catch (err) {
          // Not JSON — try to return an object with text in case the model returned a plain object
          try {
            // sometimes the model returns a JSON-like string with surrounding text; try to extract JSON
            const jsonMatch = textPayload.match(/({[\s\S]*})/);
            if (jsonMatch) {
              return JSON.parse(jsonMatch[1]);
            }
          } catch (innerErr) {
            /* fall through */
          }
          console.warn('Failed to parse candidate text as JSON, skipping candidate:', err);
        }
      }
    }

    // Some candidates may expose a direct text field
    if (typeof candidate.text === 'string' && candidate.text.trim()) {
      try {
        return JSON.parse(candidate.text.trim());
      } catch (err) {
        console.warn('Failed to parse candidate.text as JSON, skipping:', err);
      }
    }
  }

  // Some Gemini responses may already be in the expected shape.
  if (rawResponse && (rawResponse.html || rawResponse.summary || rawResponse.css)) {
    return rawResponse;
  }

  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: 'ok',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const apiKey = process.env.ALLGOOGLE_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Gemini API key not configured' }),
      };
    }

    const payload = JSON.parse(event.body || '{}');
    const prompt = payload.prompt || payload.instruction || '';
    const html = payload.html || payload.currentHtml || '';
    const css = payload.css || payload.currentCss || '';
    const templateName = payload.templateName || 'Template';
    const labId = payload.labId || payload.labContext || 'lab';
    const history = Array.isArray(payload.history) ? payload.history : [];

    if (!prompt || !html) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Prompt and HTML are required.' }),
      };
    }

    const promptParts = [
      {
        role: 'user',
        parts: [{ text: PROMPT_INTRO }],
      },
      ...history.map((entry) => ({
        role: entry.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: Array.isArray(entry.content) ? JSON.stringify(entry.content) : String(entry.content ?? '') }],
      })),
      {
        role: 'user',
        parts: [
          {
            text: JSON.stringify(
              {
                instructions: prompt,
                templateName,
                labId,
                currentHtml: html,
                currentCss: css,
              },
              null,
              2,
            ),
          },
        ],
      },
    ];

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: promptParts,
          generationConfig: {
            temperature: 0.35,
            topP: 0.9,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    const responseText = await geminiResponse.text();

    if (!geminiResponse.ok) {
      return {
        statusCode: geminiResponse.status,
        headers: CORS_HEADERS,
        body: responseText || JSON.stringify({ error: 'Gemini API error' }),
      };
    }

    let parsed;
    try {
      parsed = responseText ? JSON.parse(responseText) : {};
    } catch (parseErr) {
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: `Failed to parse Gemini response: ${(parseErr && parseErr.message) || 'Unknown error'}` }),
      };
    }

  let candidatePayload = extractCandidatePayload(parsed);
    if (!candidatePayload) {
      // Fallback: try to extract a JSON object embedded anywhere inside the raw response text
      try {
        const jsonMatch = responseText.match(/({[\s\S]*})/);
        if (jsonMatch) {
          candidatePayload = JSON.parse(jsonMatch[1]);
        }
      } catch (err) {
        console.warn('Fallback JSON extraction failed:', err);
      }
    }

    if (!candidatePayload) {
      console.error('Failed to extract candidate payload. Full response:', responseText.substring(0, 1000));
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Gemini response did not include a usable candidate payload.' }),
      };
    }

    console.log('Extracted candidate payload keys:', Object.keys(candidatePayload));
    console.log('Has HTML:', !!candidatePayload.html);
    console.log('Has CSS:', !!candidatePayload.css);
    console.log('Summary:', candidatePayload.summary);
    
    // Log the full HTML response for debugging
    if (candidatePayload.html) {
      console.log('=== FULL HTML RESPONSE (first 2000 chars) ===');
      console.log(candidatePayload.html.substring(0, 2000));
      console.log('=== END HTML RESPONSE ===');
    }

    const result = sanitizeResponse(candidatePayload);

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('Template editor AI function error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: message }),
    };
  }
};
