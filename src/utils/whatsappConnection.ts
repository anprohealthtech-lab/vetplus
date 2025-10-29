/**
 * WhatsApp Connection Management Utility
 * Handles session status checking, QR code retrieval, and connection establishment
 */

export interface WhatsAppStatus {
  success: boolean;
  connected: boolean;
  sessionId?: string;
  phoneNumber?: string;
  error?: string;
  qrCode?: string;
}

export interface WhatsAppQRResponse {
  success: boolean;
  qrCode?: string;
  error?: string;
}

export interface WhatsAppConnectResponse {
  success: boolean;
  sessionId?: string;
  connected?: boolean;
  error?: string;
}

/**
 * Check WhatsApp connection status for a user
 */
export const checkWhatsAppStatus = async (userId: string, labId?: string): Promise<WhatsAppStatus> => {
  try {
    const params = new URLSearchParams({ userId });
    if (labId) params.append('labId', labId);
    
    const response = await fetch(`/.netlify/functions/whatsapp-status?${params}`);
    const data = await response.json();
    
    return {
      success: response.ok,
      connected: data.connected || false,
      sessionId: data.sessionId,
      phoneNumber: data.phoneNumber,
      error: data.error,
    };
  } catch (error) {
    console.error('Error checking WhatsApp status:', error);
    return {
      success: false,
      connected: false,
      error: String(error),
    };
  }
};

/**
 * Get QR code for WhatsApp connection
 */
export const getWhatsAppQR = async (userId: string, labId?: string): Promise<WhatsAppQRResponse> => {
  try {
    const params = new URLSearchParams({ userId });
    if (labId) params.append('labId', labId);
    
    const response = await fetch(`/.netlify/functions/whatsapp-qr?${params}`);
    const data = await response.json();
    
    return {
      success: response.ok,
      qrCode: data.qrCode || data.qr,
      error: data.error,
    };
  } catch (error) {
    console.error('Error getting WhatsApp QR:', error);
    return {
      success: false,
      error: String(error),
    };
  }
};

/**
 * Initiate WhatsApp connection
 */
export const connectWhatsApp = async (userId: string, labId?: string): Promise<WhatsAppConnectResponse> => {
  try {
    const response = await fetch('/.netlify/functions/whatsapp-connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, labId }),
    });
    
    const data = await response.json();
    
    return {
      success: response.ok,
      sessionId: data.sessionId,
      connected: data.connected,
      error: data.error,
    };
  } catch (error) {
    console.error('Error connecting WhatsApp:', error);
    return {
      success: false,
      error: String(error),
    };
  }
};

/**
 * Complete WhatsApp connection workflow
 * 1. Check status
 * 2. If not connected, get QR code
 * 3. Return connection instructions
 */
export const initiateWhatsAppConnection = async (userId: string, labId?: string) => {
  try {
    // Step 1: Check current status
    const status = await checkWhatsAppStatus(userId, labId);
    
    if (status.connected) {
      return {
        success: true,
        connected: true,
        sessionId: status.sessionId,
        message: 'WhatsApp is already connected',
      };
    }
    
    // Step 2: Get QR code for connection
    const qrResponse = await getWhatsAppQR(userId, labId);
    
    if (!qrResponse.success) {
      return {
        success: false,
        connected: false,
        error: qrResponse.error,
        message: 'Failed to get QR code for WhatsApp connection',
      };
    }
    
    return {
      success: true,
      connected: false,
      qrCode: qrResponse.qrCode,
      sessionId: status.sessionId,
      message: 'Scan the QR code with WhatsApp to connect',
      instructions: [
        '1. Open WhatsApp on your phone',
        '2. Go to Settings > Linked Devices',
        '3. Tap "Link a Device"',
        '4. Scan the QR code below',
        '5. Once connected, you can send reports via WhatsApp',
      ],
    };
  } catch (error) {
    console.error('Error in WhatsApp connection workflow:', error);
    return {
      success: false,
      connected: false,
      error: String(error),
      message: 'Failed to initiate WhatsApp connection',
    };
  }
};

/**
 * Format phone number to E.164 format (add + if missing)
 */
export const formatPhoneNumber = (phoneNumber: string): string => {
  // Remove any spaces, dashes, or other formatting
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // If it doesn't start with +, add it
  if (!phoneNumber.startsWith('+') && cleaned.length >= 10) {
    return `+${cleaned}`;
  }
  
  return phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
};

/**
 * Enhanced WhatsApp document sending with connection check
 */
export const sendWhatsAppDocument = async (
  sessionId: string,
  phoneNumber: string,
  fileUrl: string,
  options: {
    fileName?: string;
    patientName?: string;
    testName?: string;
    content?: string;
  } = {}
) => {
  try {
    // Format phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    // Send document
    const response = await fetch('/.netlify/functions/send-report-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        phoneNumber: formattedPhone,
        url: fileUrl,
        fileName: options.fileName || 'report.pdf',
        patientName: options.patientName,
        testName: options.testName,
        content: options.content || `Report for ${options.patientName || 'Patient'}`,
      }),
    });
    
    const data = await response.json();
    
    // If session not ready, provide connection instructions
    if (!data.success && data.error === 'SESSION_NOT_READY') {
      return {
        success: false,
        error: 'SESSION_NOT_READY',
        message: 'WhatsApp session is not connected. Please connect your WhatsApp first.',
        needsConnection: true,
      };
    }
    
    return {
      success: data.success,
      error: data.error,
      message: data.message,
      messageId: data.messageId,
    };
  } catch (error) {
    console.error('Error sending WhatsApp document:', error);
    return {
      success: false,
      error: String(error),
      message: 'Failed to send WhatsApp document',
    };
  }
};