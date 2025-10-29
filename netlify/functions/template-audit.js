const AUDIT_PROMPT = `You are an auditing assistant for laboratory report HTML templates. Your job is to evaluate if the template satisfies the required layout contract and if placeholders match the provided data context.

You receive:
- templateName: human readable name of the template.
- labId: identifier of the lab using the template (for context only).
- html: full HTML string currently used in GrapesJS.
- css: stylesheet string applied to the template.
- placeholders: array of placeholder tokens exactly as found in the html (double curly braces syntax).
- requiredPlaceholders: mapping of semantic slots -> expected placeholder tokens (they may or may not exist yet).
- testGroup: optional object with test group name and analyte array (each analyte has name, unit, reference_range, flag support, etc.).
- availablePlaceholders: array of placeholder descriptors that authors can insert (each includes placeholder token, label, group, unit, referenceRange).

Your evaluation must:
1. Confirm the patient metadata table immediately after the header exists and includes cells for patientName, patientAge, registrationDate, locationName, sampleCollectedAt, approvedAt, referringDoctorName.
2. Confirm a header image/logo container exists (placeholder src or slot is acceptable).
3. Confirm footer includes an image container and a signature block with placeholders.
4. Validate that placeholders listed in requiredPlaceholders are present in the HTML. If they are absent suggest which placeholder to add.
5. Use availablePlaceholders to decide whether placeholders in the HTML are valid. Flag anything that is not part of the available list unless clearly intentional (e.g., table headings) and recommend replacements from the available list when appropriate.
6. Cross-check analyte placeholders with the supplied test group. If the template references analyte placeholders not in the test group, flag them. If analytes exist in the test group but are missing in the template, note them.
7. Highlight any other missing or malformed placeholders (e.g., malformed braces, duplicates, inconsistent casing).

Return JSON strictly in this shape (no prose, no markdown):
{
  "status": "pass" | "attention" | "fail",
  "summary": "Concise human readable summary",
  "patientMetadata": {
    "tablePresent": boolean,
    "missingColumns": string[]
  },
  "headerFooter": {
    "headerImage": boolean,
    "footerImage": boolean,
    "signatureBlock": boolean
  },
  "placeholders": {
    "requiredMissing": string[],
    "unknownPlaceholders": string[],
    "duplicates": string[]
  },
  "analyteCoverage": {
    "referencedButUnknown": string[],
    "missingFromTemplate": string[]
  },
  "recommendations": string[]
}

Rules:
- "pass" only when all required pieces exist and no missing placeholders.
- "attention" when minor issues exist that can be fixed quickly (e.g., missing optional analytes).
- "fail" when required structures or placeholders are missing.
`;

const GEMINI_MODEL = 'gemini-2.0-flash';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
    const {
      templateName = 'Template',
      labId = 'lab',
      html = '',
      css = '',
      placeholders = [],
      requiredPlaceholders = {},
      testGroup = null,
      availablePlaceholders = [],
    } = payload;

    if (!html) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'HTML is required for auditing.' }),
      };
    }

    const placeholderSet = Array.isArray(placeholders) ? Array.from(new Set(placeholders)) : [];
    const availablePlaceholderList = Array.isArray(availablePlaceholders)
      ? Array.from(
          new Map(
            availablePlaceholders
              .filter((item) => item && typeof item.placeholder === 'string')
              .map((item) => [
                item.placeholder,
                {
                  placeholder: item.placeholder,
                  label: item.label || '',
                  group: item.group || 'lab',
                  unit: item.unit ?? null,
                  referenceRange: item.referenceRange ?? null,
                },
              ])
          ).values()
        )
      : [];

    const prompt = {
      templateName,
      labId,
      html,
      css,
      placeholders: placeholderSet,
      availablePlaceholders: availablePlaceholderList,
      requiredPlaceholders,
      testGroup,
    };

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: AUDIT_PROMPT,
            },
          ],
        },
        {
          role: 'user',
          parts: [
            {
              text: JSON.stringify(prompt, null, 2),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
    );

    const text = await response.text();
    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: CORS_HEADERS,
        body: text || JSON.stringify({ error: 'Gemini API error' }),
      };
    }

    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch (parseErr) {
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: `Failed to parse Gemini response: ${(parseErr && parseErr.message) || 'Unknown error'}` }),
      };
    }

    const candidate = Array.isArray(json.candidates) && json.candidates.length
      ? json.candidates[0]
      : json;

    const responseText = candidate?.content?.parts
      ? candidate.content.parts.map((part) => part.text || '').join('\n').trim()
      : candidate?.text || '';

    if (!responseText) {
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Gemini response did not include a usable payload.' }),
      };
    }

    let auditResult;
    try {
      auditResult = JSON.parse(responseText);
    } catch (err) {
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Gemini audit payload was not valid JSON.' }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audit: auditResult }),
    };
  } catch (error) {
    console.error('Template audit error:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: message }),
    };
  }
};
