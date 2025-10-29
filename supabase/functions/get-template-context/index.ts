import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const buildCorsHeaders = (req: Request): Record<string, string> => {
  const requestOrigin = req.headers.get('origin') ?? '*';
  const requestedHeaders = req.headers.get('access-control-request-headers');
  const requestedMethod = req.headers.get('access-control-request-method');

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': requestOrigin,
    'Access-Control-Allow-Methods': requestedMethod ?? 'GET, POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin, Access-Control-Request-Headers, Access-Control-Request-Method',
  };

  if (requestedHeaders) {
    headers['Access-Control-Allow-Headers'] = requestedHeaders;
  } else {
    headers['Access-Control-Allow-Headers'] = 'authorization, x-client-info, apikey, content-type, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform';
  }

  return headers;
};

type TemplateContextResponse = {
  success: boolean;
  context?: unknown;
  error?: string;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    const corsHeaders = buildCorsHeaders(req);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const corsHeaders = buildCorsHeaders(req);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const requestPayload = req.method === 'GET' ? null : await req.json().catch(() => null);
    const orderId = requestPayload?.orderId ?? new URL(req.url).searchParams.get('orderId');

    if (!orderId) {
      return new Response(
        JSON.stringify({ success: false, error: 'orderId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: userRecord, error: userRecordError } = await supabaseClient
      .from('users')
      .select('lab_id')
      .eq('id', user.id)
      .single();

    const resolvedLabId = userRecord?.lab_id ?? user.user_metadata?.lab_id ?? null;

    if (userRecordError && userRecordError.code !== 'PGRST116') {
      console.error('Failed to resolve lab for user', userRecordError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unable to resolve lab context' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: orderRecord, error: orderError } = await supabaseClient
      .from('orders')
      .select('id, lab_id')
      .eq('id', orderId)
      .single();

    if (orderError || !orderRecord) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (resolvedLabId && orderRecord.lab_id && orderRecord.lab_id !== resolvedLabId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order does not belong to current lab' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data, error } = await supabaseClient.rpc('get_report_template_context', {
      p_order_id: orderId,
    });

    if (error) {
      console.error('RPC get_report_template_context failed', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to load report context' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const payload: TemplateContextResponse = { success: true, context: data };

    return new Response(
      JSON.stringify(payload),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const corsHeaders = buildCorsHeaders(req);
    console.error('Unexpected error in get-template-context function', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Unexpected server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
