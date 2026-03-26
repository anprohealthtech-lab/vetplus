import type { APIRoute } from 'astro';

const PROMPT_INTRO = `You are an expert HTML email/report designer assisting lab technicians.
You receive:
- currentHtml: the existing template HTML used inside GrapesJS (no scripts allowed)
- currentCss: optional CSS string
- instructions: human instructions describing the desired modifications
Return a JSON object with { html: string, css?: string, summary?: string, warnings?: string[] }.
Constraints:
1. Update only what is necessary to satisfy instructions.
2. Preserve placeholders like {{patientName}} exactly as provided.
3. Avoid <script>, inline event handlers, external JS/CSS, or remote images.
4. Keep structure accessible and printable.
If the request is unclear, respond with a summary asking for clarifications and leave html empty.`;

interface TemplateEditorRequestBody {
  prompt: string;
  html: string;
  css?: string;
  templateName?: string;
  labId?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface GeminiTemplateResponse {
  html?: string;
  css?: string;
  summary?: string;
  warnings?: string[];
}

const GEMINI_MODEL = 'gemini-1.5-flash';

const FORBIDDEN_PATTERNS: RegExp[] = [
  /<script/i,
  /javascript:/i,
  /onload\s*=/i,
  /onerror\s*=/i,
  /<iframe/i,
];

function sanitizeResponse(candidate: GeminiTemplateResponse): GeminiTemplateResponse {
  const sanitised = { ...candidate };

  if (sanitised.html && FORBIDDEN_PATTERNS.some((pattern) => pattern.test(sanitised.html!))) {
    sanitised.warnings = [
      ...(sanitised.warnings || []),
      'Potentially unsafe markup was detected and removed from the AI response.',
    ];
    sanitised.html = undefined;
  }

  return sanitised;
}

async function callGemini(body: TemplateEditorRequestBody): Promise<GeminiTemplateResponse> {
  const apiKey = import.meta.env?.ALLGOOGLE_KEY || import.meta.env?.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const promptParts = [
    { role: 'user' as const, parts: [{ text: PROMPT_INTRO }] },
    ...((body.history || []).map((entry) => ({
      role: entry.role,
      parts: [{ text: entry.content }],
    })) as Array<{ role: 'user' | 'assistant'; parts: Array<{ text: string }> }>),
    {
      role: 'user' as const,
      parts: [
        {
          text: JSON.stringify(
            {
              instructions: body.prompt,
              templateName: body.templateName || 'Template',
              labId: body.labId || 'lab',
              currentHtml: body.html,
              currentCss: body.css || '',
            },
            null,
            2,
          ),
        },
      ],
    },
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: promptParts,
        generationConfig: {
          temperature: 0.4,
          topP: 0.95,
          topK: 32,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${errorText}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  try {
    const parsed: GeminiTemplateResponse = JSON.parse(text);
    return sanitizeResponse(parsed);
  } catch (err) {
    throw new Error(`Failed to parse Gemini response: ${(err as Error).message}`);
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as TemplateEditorRequestBody;

    if (!body.prompt || !body.html) {
      return new Response(
        JSON.stringify({ error: 'Prompt and current HTML are required.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const aiResponse = await callGemini(body);

    return new Response(JSON.stringify(aiResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI template-editor error:', error);

    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Unexpected AI service error.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
};
