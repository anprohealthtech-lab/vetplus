interface InvokeOptions {
  body?: unknown;
  headers?: Record<string, string>;
  method?: string;
  signal?: AbortSignal;
}

interface InvokeError {
  message: string;
  status: number;
  details?: unknown;
}

interface InvokeResult<T> {
  data: T | null;
  error: InvokeError | null;
  status: number;
  raw: unknown;
}

const NETLIFY_FUNCTION_BASE = '/.netlify/functions';

function buildRequestInit(options: InvokeOptions): {
  init: RequestInit;
  bodyPayload: BodyInit | null;
} {
  const { body, headers = {}, method = 'POST', signal } = options;
  const requestHeaders = new Headers(headers);

  let bodyPayload: BodyInit | null = null;
  if (body !== undefined && body !== null) {
    const hasJsonContentType = headers['Content-Type']?.toLowerCase().includes('application/json')
      || headers['content-type']?.toLowerCase().includes('application/json')
      || requestHeaders.get('Content-Type')?.toLowerCase().includes('application/json')
      || requestHeaders.get('content-type')?.toLowerCase().includes('application/json');

    if (typeof body === 'string' || body instanceof Blob || body instanceof FormData || body instanceof ArrayBuffer) {
      bodyPayload = body as BodyInit;
    } else {
      if (!hasJsonContentType) {
        requestHeaders.set('Content-Type', 'application/json');
      }
      bodyPayload = JSON.stringify(body);
    }
  }

  if (!requestHeaders.has('Accept')) {
    requestHeaders.set('Accept', 'application/json');
  }

  return {
    init: {
      method,
      headers: requestHeaders,
      body: bodyPayload,
      signal,
      credentials: 'include',
    },
    bodyPayload,
  };
}

export async function invokeNetlifyFunction<T = unknown>(
  functionName: string,
  options: InvokeOptions = {},
): Promise<InvokeResult<T>> {
  const url = `${NETLIFY_FUNCTION_BASE}/${functionName}`;
  const { init } = buildRequestInit(options);

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    return {
      data: null,
      error: {
        message: error instanceof Error ? error.message : 'Network error',
        status: 0,
        details: error,
      },
      status: 0,
      raw: null,
    };
  }

  const text = await response.text();
  let parsed: unknown = text;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch (_err) {
      parsed = text;
    }
  } else {
    parsed = null;
  }

  if (!response.ok) {
    const message =
      typeof parsed === 'object' && parsed !== null && 'error' in (parsed as Record<string, unknown>)
        ? String((parsed as Record<string, unknown>).error)
        : response.statusText || 'Request failed';

    return {
      data: null,
      error: {
        message,
        status: response.status,
        details: parsed,
      },
      status: response.status,
      raw: parsed,
    };
  }

  return {
    data: parsed as T,
    error: null,
    status: response.status,
    raw: parsed,
  };
}
