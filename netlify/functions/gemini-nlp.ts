const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-attachment-id, x-order-id, x-batch-id, x-multi-image",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { supabaseUrl, serviceKey };
}

function buildForwardHeaders(request: Request, serviceKey: string) {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${serviceKey}`);
  headers.set("apikey", serviceKey);

  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  for (const [key, value] of request.headers.entries()) {
    if (key.startsWith("x-")) {
      headers.set(key, value);
    }
  }

  return headers;
}

async function proxyToSupabaseFunction(req: Request, functionName: string): Promise<Response> {
  const { supabaseUrl, serviceKey } = getSupabaseConfig();

  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: "Supabase configuration is missing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const forwardHeaders = buildForwardHeaders(req, serviceKey);
  let body: string | null = null;

  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.text();
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: req.method,
    headers: forwardHeaders,
    body: body && body.length > 0 ? body : null,
  });

  const responseBody = await response.text();
  const resultHeaders = new Headers(corsHeaders);
  const responseContentType = response.headers.get("content-type");
  if (responseContentType) {
    resultHeaders.set("Content-Type", responseContentType);
  } else if (!resultHeaders.has("Content-Type")) {
    resultHeaders.set("Content-Type", "application/json");
  }

  return new Response(responseBody, {
    status: response.status,
    headers: resultHeaders,
  });
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    return await proxyToSupabaseFunction(req, "gemini-nlp");
  } catch (error) {
    console.error("Netlify gemini-nlp proxy error", error);
    return new Response(
      JSON.stringify({ error: "Failed to execute Gemini NLP", details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

export default handler;
export const config = { runtime: "edge" };
