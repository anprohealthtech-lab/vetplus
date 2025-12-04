import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { isNative } from './platformHelper';
import { Toast } from '@capacitor/toast';
import { Device } from '@capacitor/device';
import { supabase } from './supabase';

export interface PushNotification {
  title?: string;
  body?: string;
  data?: { [key: string]: string };
  id?: string;
}

export interface DeviceInfo {
  model?: string;
  platform?: string;
  operatingSystem?: string;
  osVersion?: string;
  manufacturer?: string;
  appVersion?: string;
  deviceId?: string;
}

/**
 * Save FCM token to database for the current user
 */
const saveTokenToDatabase = async (token: string): Promise<void> => {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('No authenticated user, cannot save FCM token');
      return;
    }

    // Get user's lab_id
    const { data: userData } = await supabase
      .from('users')
      .select('lab_id')
      .eq('id', user.id)
      .single();

    if (!userData?.lab_id) {
      console.warn('User has no lab_id, cannot save FCM token');
      return;
    }

    // Get device info
    let deviceInfo: DeviceInfo = {};
    let deviceId: string | undefined;
    
    try {
      const info = await Device.getInfo();
      const id = await Device.getId();
      
      deviceInfo = {
        model: info.model,
        platform: info.platform,
        operatingSystem: info.operatingSystem,
        osVersion: info.osVersion,
        manufacturer: info.manufacturer,
        appVersion: '1.0.0', // You can get this from your app config
      };
      deviceId = id.identifier;
    } catch (e) {
      console.warn('Could not get device info:', e);
    }

    // Upsert token (update if exists, insert if not)
    const { error } = await supabase
      .from('user_fcm_tokens')
      .upsert(
        {
          user_id: user.id,
          lab_id: userData.lab_id,
          fcm_token: token,
          device_id: deviceId,
          device_info: deviceInfo,
          is_active: true,
          last_used_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,fcm_token',
          ignoreDuplicates: false,
        }
      );

    if (error) {
      // If table doesn't exist yet, just log and continue
      if (error.code === '42P01') {
        console.warn('user_fcm_tokens table does not exist yet. Run the migration first.');
        return;
      }
      console.error('Error saving FCM token to database:', error);
    } else {
      console.log('FCM token saved to database successfully');
    }
  } catch (error) {
    console.error('Failed to save FCM token to database:', error);
  }
};

/**
 * Remove FCM token from database (on logout)
 */
const removeTokenFromDatabase = async (token: string): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_fcm_tokens')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('fcm_token', token);

    if (error && error.code !== '42P01') {
      console.error('Error deactivating FCM token:', error);
    }
  } catch (error) {
    console.error('Failed to remove FCM token from database:', error);
  }
};

/**
 * Initialize Firebase Cloud Messaging
 */
export const initializeFirebaseMessaging = async (): Promise<void> => {
  if (!isNative()) {
    console.log('Firebase Messaging only available on native platforms');
    return;
  }

  try {
    // Request notification permissions
    const permissionResult = await FirebaseMessaging.requestPermissions();
    
    if (permissionResult.receive === 'granted') {
      console.log('Push notification permission granted');
      
      // Get FCM token
      const { token } = await FirebaseMessaging.getToken();
      console.log('FCM Token:', token);
      
      // Save token to database for the current user
      if (token) {
        await saveTokenToDatabase(token);
      }
      
      // Listen for token refresh
      await FirebaseMessaging.addListener('tokenReceived', async (event) => {
        console.log('FCM Token refreshed:', event.token);
        // Update token in database when refreshed
        if (event.token) {
          await saveTokenToDatabase(event.token);
        }
      });
      
      // Listen for incoming notifications
      await FirebaseMessaging.addListener('notificationReceived', (notification) => {
        console.log('Notification received:', notification);
        handleNotification(notification);
      });
      
      // Listen for notification taps
      await FirebaseMessaging.addListener('notificationActionPerformed', (action) => {
        console.log('Notification action performed:', action);
        handleNotificationAction(action);
      });
      
    } else {
      console.warn('Push notification permission denied');
    }
  } catch (error) {
    console.error('Failed to initialize Firebase Messaging:', error);
  }
};

/**
 * Handle incoming notification
 */
const handleNotification = async (notification: PushNotification): Promise<void> => {
  try {
    // Show toast for foreground notifications
    await Toast.show({
      text: `${notification.title}: ${notification.body}`,
      duration: 'long',
      position: 'top',
    });
    
    // You can add custom logic here based on notification data
    if (notification.data?.type === 'order_completed') {
      // Navigate to orders page or refresh data
      console.log('Order completed notification');
    } else if (notification.data?.type === 'result_ready') {
      // Navigate to results page
      console.log('Result ready notification');
    }
  } catch (error) {
    console.error('Error handling notification:', error);
  }
};

/**
 * Handle notification tap/action
 */
const handleNotificationAction = (action: any): void => {
  const { notification, actionId } = action;
  
  console.log('User tapped notification:', notification);
  console.log('Action ID:', actionId);
  
  // Navigate based on notification data
  if (notification.data?.orderId) {
    // TODO: Navigate to order details
    window.location.href = `/orders/${notification.data.orderId}`;
  } else if (notification.data?.patientId) {
    // TODO: Navigate to patient details
    window.location.href = `/patients/${notification.data.patientId}`;
  }
};

/**
 * Get current FCM token
 */
export const getFirebaseToken = async (): Promise<string | null> => {
  if (!isNative()) {
    return null;
  }
  
  try {
    const { token } = await FirebaseMessaging.getToken();
    return token;
  } catch (error) {
    console.error('Failed to get FCM token:', error);
    return null;
  }
};

/**
 * Delete FCM token (logout scenario)
 */
export const deleteFirebaseToken = async (): Promise<void> => {
  if (!isNative()) {
    return;
  }
  
  try {
    // Get current token before deleting
    const { token } = await FirebaseMessaging.getToken();
    
    // Remove from database
    if (token) {
      await removeTokenFromDatabase(token);
    }
    
    // Delete from Firebase
    await FirebaseMessaging.deleteToken();
    console.log('FCM token deleted');
  } catch (error) {
    console.error('Failed to delete FCM token:', error);
  }
};

/**
 * Subscribe to a topic
 */
export const subscribeToTopic = async (topic: string): Promise<void> => {
  if (!isNative()) {
    return;
  }
  
  try {
    await FirebaseMessaging.subscribeToTopic({ topic });
    console.log(`Subscribed to topic: ${topic}`);
  } catch (error) {
    console.error(`Failed to subscribe to topic ${topic}:`, error);
  }
};

/**
 * Unsubscribe from a topic
 */
export const unsubscribeFromTopic = async (topic: string): Promise<void> => {
  if (!isNative()) {
    return;
  }
  
  try {
    await FirebaseMessaging.unsubscribeFromTopic({ topic });
    console.log(`Unsubscribed from topic: ${topic}`);
  } catch (error) {
    console.error(`Failed to unsubscribe from topic ${topic}:`, error);
  }
};

/**
 * Remove all notification listeners
 */
export const cleanupFirebaseMessaging = async (): Promise<void> => {
  if (!isNative()) {
    return;
  }
  
  try {
    await FirebaseMessaging.removeAllListeners();
    console.log('Firebase Messaging listeners cleaned up');
  } catch (error) {
    console.error('Failed to cleanup Firebase Messaging:', error);
  }
};

// ============================================
// Server-Side Notification Helpers
// ============================================

export interface SendNotificationPayload {
  // Target (one of these required)
  token?: string;          // Single device FCM token
  topic?: string;          // Topic name (e.g., 'order-updates')
  tokens?: string[];       // Multiple device tokens (batch)
  userId?: string;         // Send to all devices of a user (will fetch tokens from DB)
  
  // Notification content
  title: string;
  body: string;
  imageUrl?: string;
  
  // Custom data payload
  data?: {
    type?: 'order_completed' | 'result_ready' | 'payment_due' | 'system_alert' | string;
    orderId?: string;
    patientId?: string;
    invoiceId?: string;
    url?: string;
    [key: string]: string | undefined;
  };
}

export interface SendNotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  failedTokens?: string[];
}

/**
 * Get FCM tokens for a specific user from database
 */
export const getUserFCMTokens = async (userId: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('user_fcm_tokens')
      .select('fcm_token')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching user FCM tokens:', error);
      return [];
    }

    return (data || []).map(row => row.fcm_token);
  } catch (error) {
    console.error('Failed to get user FCM tokens:', error);
    return [];
  }
};

/**
 * Get FCM tokens for all users in a lab
 */
export const getLabFCMTokens = async (labId: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('user_fcm_tokens')
      .select('fcm_token')
      .eq('lab_id', labId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching lab FCM tokens:', error);
      return [];
    }

    return (data || []).map(row => row.fcm_token);
  } catch (error) {
    console.error('Failed to get lab FCM tokens:', error);
    return [];
  }
};

/**
 * Send push notification via backend Netlify function
 * 
 * @example
 * // Send to single device
 * await sendPushNotification({
 *   token: 'device_fcm_token',
 *   title: 'Order Ready',
 *   body: 'Order #123 is ready for pickup',
 *   data: { type: 'order_completed', orderId: '123' }
 * });
 * 
 * @example
 * // Send to topic
 * await sendPushNotification({
 *   topic: 'order-updates',
 *   title: 'New Order',
 *   body: 'A new order has been placed'
 * });
 * 
 * @example
 * // Send to user (all their devices)
 * await sendPushNotification({
 *   userId: 'user-uuid',
 *   title: 'Result Ready',
 *   body: 'Test results are now available'
 * });
 */
export const sendPushNotification = async (
  payload: SendNotificationPayload
): Promise<SendNotificationResult> => {
  try {
    // If userId is provided, fetch their tokens
    let tokens = payload.tokens;
    if (payload.userId && !payload.token && !payload.topic) {
      tokens = await getUserFCMTokens(payload.userId);
      if (tokens.length === 0) {
        return {
          success: false,
          error: 'No active FCM tokens found for this user'
        };
      }
    }

    // Prepare request payload
    const requestPayload: any = {
      title: payload.title,
      body: payload.body,
      data: payload.data,
    };

    if (payload.imageUrl) {
      requestPayload.imageUrl = payload.imageUrl;
    }

    if (tokens && tokens.length > 0) {
      requestPayload.tokens = tokens;
    } else if (payload.token) {
      requestPayload.token = payload.token;
    } else if (payload.topic) {
      requestPayload.topic = payload.topic;
    }

    // Call Netlify function
    const response = await fetch('/.netlify/functions/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Failed to send notification',
        failedTokens: result.failedTokens,
      };
    }

    return {
      success: true,
      messageId: result.messageId,
      failedTokens: result.failedTokens,
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Send notification to all users in a lab
 */
export const sendLabNotification = async (
  labId: string,
  payload: Omit<SendNotificationPayload, 'token' | 'tokens' | 'topic' | 'userId'>
): Promise<SendNotificationResult> => {
  const tokens = await getLabFCMTokens(labId);
  
  if (tokens.length === 0) {
    return {
      success: false,
      error: 'No active FCM tokens found for this lab'
    };
  }

  return sendPushNotification({
    ...payload,
    tokens,
  });
};

/**
 * Helper: Send order completion notification
 */
export const notifyOrderCompleted = async (
  userId: string,
  orderId: string,
  orderNumber: string
): Promise<SendNotificationResult> => {
  return sendPushNotification({
    userId,
    title: 'Order Completed',
    body: `Order #${orderNumber} has been completed`,
    data: {
      type: 'order_completed',
      orderId,
    },
  });
};

/**
 * Helper: Send result ready notification
 */
export const notifyResultReady = async (
  userId: string,
  patientName: string,
  orderId: string
): Promise<SendNotificationResult> => {
  return sendPushNotification({
    userId,
    title: 'Results Ready',
    body: `Test results for ${patientName} are now available`,
    data: {
      type: 'result_ready',
      orderId,
    },
  });
};

/**
 * Helper: Send payment reminder notification
 */
export const notifyPaymentDue = async (
  userId: string,
  invoiceId: string,
  amount: number
): Promise<SendNotificationResult> => {
  return sendPushNotification({
    userId,
    title: 'Payment Reminder',
    body: `Payment of ₹${amount.toFixed(2)} is pending`,
    data: {
      type: 'payment_due',
      invoiceId,
    },
  });
};

/**
 * Helper: Send system alert to topic
 */
export const sendSystemAlert = async (
  title: string,
  body: string
): Promise<SendNotificationResult> => {
  return sendPushNotification({
    topic: 'system-alerts',
    title,
    body,
    data: {
      type: 'system_alert',
    },
  });
};
