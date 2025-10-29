const fetch = globalThis.fetch;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: 'ok' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
  }

  try {
    const base = process.env.VITE_WHATSAPP_API_BASE_URL || 'https://lionfish-app-nmodi.ondigitalocean.app';
    const body = event.body ? JSON.parse(event.body) : {};

    // Proxy to backend user sync
    const upstream = await fetch(new URL('/api/whatsapp/sync-user', base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': event.headers.authorization || '',
      },
      body: JSON.stringify(body),
    });

    const data = await upstream.text();
    return {
      statusCode: upstream.status,
      headers: { ...corsHeaders, 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
      body: data,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: String(err) }),
    };
  }
};
