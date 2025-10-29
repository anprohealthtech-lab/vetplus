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
  const base = process.env.WHATSAPP_API_BASE_URL || process.env.VITE_WHATSAPP_API_BASE_URL || 'https://lionfish-app-nmodi.ondigitalocean.app';
    const body = event.body ? JSON.parse(event.body) : {};
    const { sessionId, phoneNumber, message, userId, labId, to, ...rest } = body;
    
    // Support both new API format (sessionId/phoneNumber) and legacy format (userId/to)
    const finalSessionId = sessionId || userId;
    const finalPhoneNumber = phoneNumber || to;
    const finalMessage = message || rest.content;
    
    if (!finalSessionId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'sessionId is required' }) };
    }
    
    if (!finalPhoneNumber) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'phoneNumber is required' }) };
    }
    
    if (!finalMessage) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'message content is required' }) };
    }

    // Use correct external API endpoint for messages
    const apiUrl = `${base}/api/external/messages/send`;

    // Prepare headers with proper authentication (hardcoded like the sample)
    const API_KEY = 'whatsapp-lims-secure-api-key-2024';
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,  // Use capitalized header name as shown in curl examples
    };
    
    console.log('Using hardcoded API key for authentication');
    
    // Legacy authorization header support
    if (event.headers.authorization) {
      headers['Authorization'] = event.headers.authorization;
    }

    // Send message using External API format
    const upstream = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        sessionId: finalSessionId,
        phoneNumber: finalPhoneNumber,
        content: finalMessage  // Backend expects 'content', not 'message'
      }),
    });

    const data = await upstream.json();
    
    // Log the response for debugging
    console.log('Backend send-message response:', JSON.stringify(data, null, 2));
    
    return {
      statusCode: upstream.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: String(err) }),
    };
  }
};
