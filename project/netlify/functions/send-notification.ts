import { Handler } from '@netlify/functions';

/**
 * Firebase Cloud Messaging Server-Side Notification Function
 * 
 * This Netlify Function sends push notifications via Firebase Cloud Messaging V1 API.
 * It uses Firebase Admin SDK to securely send notifications to specific devices or topics.
 * 
 * Required Environment Variables:
 * - FIREBASE_PROJECT_ID: Your Firebase project ID (e.g., 'task-manager-d391c')
 * - FIREBASE_CLIENT_EMAIL: Service account email from Firebase
 * - FIREBASE_PRIVATE_KEY: Service account private key from Firebase (base64 encoded recommended)
 * 
 * To get these credentials:
 * 1. Go to Firebase Console → Project Settings → Service Accounts
 * 2. Click "Generate new private key"
 * 3. Download the JSON file and extract the required values
 * 4. Set them as environment variables in Netlify
 */

interface NotificationPayload {
  // Target (one of these required)
  token?: string;          // Single device FCM token
  topic?: string;          // Topic name (e.g., 'order-updates')
  tokens?: string[];       // Multiple device tokens (batch)
  
  // Notification content
  title: string;
  body: string;
  imageUrl?: string;
  
  // Custom data payload for app handling
  data?: {
    type?: string;         // 'order_completed' | 'result_ready' | 'payment_due' | 'system_alert'
    orderId?: string;
    patientId?: string;
    invoiceId?: string;
    url?: string;
    [key: string]: string | undefined;
  };
  
  // Optional Android-specific settings
  android?: {
    priority?: 'high' | 'normal';
    channelId?: string;
    sound?: string;
    color?: string;
  };
}

interface FCMResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  failedTokens?: string[];
}

/**
 * Get OAuth2 access token for Firebase Admin API
 * Using Google OAuth2 JWT flow with service account
 */
async function getAccessToken(): Promise<string> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY');
  }
  
  // Handle base64 encoded private key or escaped newlines
  if (!privateKey.includes('-----BEGIN')) {
    try {
      privateKey = Buffer.from(privateKey, 'base64').toString('utf-8');
    } catch {
      // Try replacing escaped newlines
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
  }
  
  // Create JWT for Google OAuth2
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600 // 1 hour
  };
  
  // Sign JWT using Web Crypto API
  const encoder = new TextEncoder();
  const headerBase64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadBase64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerBase64}.${payloadBase64}`;
  
  // Import the private key
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKey.substring(
    privateKey.indexOf(pemHeader) + pemHeader.length,
    privateKey.indexOf(pemFooter)
  ).replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  // Sign the token
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(unsignedToken)
  );
  
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const jwt = `${unsignedToken}.${signatureBase64}`;
  
  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  
  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${errorText}`);
  }
  
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

/**
 * Send notification via FCM V1 API
 */
async function sendFCMNotification(
  accessToken: string,
  projectId: string,
  payload: NotificationPayload
): Promise<FCMResponse> {
  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  
  // Build FCM message
  const message: any = {
    notification: {
      title: payload.title,
      body: payload.body,
    }
  };
  
  // Add image if provided
  if (payload.imageUrl) {
    message.notification.image = payload.imageUrl;
  }
  
  // Add custom data
  if (payload.data) {
    message.data = {};
    for (const [key, value] of Object.entries(payload.data)) {
      if (value !== undefined) {
        message.data[key] = String(value);
      }
    }
  }
  
  // Android-specific config
  message.android = {
    priority: payload.android?.priority || 'high',
    notification: {
      sound: payload.android?.sound || 'default',
      channel_id: payload.android?.channelId || 'lims_default_channel',
      color: payload.android?.color || '#1a56db'
    }
  };
  
  // Set target
  if (payload.token) {
    message.token = payload.token;
  } else if (payload.topic) {
    message.topic = payload.topic;
  }
  
  const response = await fetch(fcmUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message })
  });
  
  const responseData = await response.json();
  
  if (!response.ok) {
    return {
      success: false,
      error: responseData.error?.message || 'Unknown FCM error'
    };
  }
  
  return {
    success: true,
    messageId: responseData.name
  };
}

/**
 * Send batch notifications to multiple tokens
 */
async function sendBatchNotifications(
  accessToken: string,
  projectId: string,
  payload: NotificationPayload
): Promise<FCMResponse> {
  if (!payload.tokens || payload.tokens.length === 0) {
    return { success: false, error: 'No tokens provided for batch send' };
  }
  
  const results = await Promise.all(
    payload.tokens.map(token => 
      sendFCMNotification(accessToken, projectId, { ...payload, token })
    )
  );
  
  const failedTokens = payload.tokens.filter((_, idx) => !results[idx].success);
  const successCount = results.filter(r => r.success).length;
  
  return {
    success: successCount > 0,
    messageId: `batch-${successCount}/${payload.tokens.length}`,
    failedTokens: failedTokens.length > 0 ? failedTokens : undefined
  };
}

export const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    const payload: NotificationPayload = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!payload.title || !payload.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'title and body are required' })
      };
    }
    
    if (!payload.token && !payload.topic && !payload.tokens) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'token, topic, or tokens array is required' })
      };
    }
    
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Firebase project not configured' })
      };
    }
    
    // Get access token
    const accessToken = await getAccessToken();
    
    let result: FCMResponse;
    
    // Handle batch vs single send
    if (payload.tokens && payload.tokens.length > 0) {
      result = await sendBatchNotifications(accessToken, projectId, payload);
    } else {
      result = await sendFCMNotification(accessToken, projectId, payload);
    }
    
    if (!result.success) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: result.error,
          failedTokens: result.failedTokens
        })
      };
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        messageId: result.messageId,
        failedTokens: result.failedTokens
      })
    };
    
  } catch (error) {
    console.error('Push notification error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error'
      })
    };
  }
};
