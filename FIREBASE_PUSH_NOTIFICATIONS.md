# Firebase Cloud Messaging (FCM) Setup Guide

## Overview
Firebase Cloud Messaging is integrated into LIMS Builder Android app for push notifications. This guide covers the complete setup for production use.

## Configuration Status

### ✅ Completed Setup
1. **Android Configuration**
   - `google-services.json` in `android/app/`
   - Firebase BOM 32.7.0 with FCM dependencies
   - AndroidManifest.xml with FCM meta-data and POST_NOTIFICATIONS permission
   - Notification channel configuration
   - colors.xml with brand colors

2. **Frontend Service**
   - `src/utils/firebaseMessaging.ts` - Complete FCM service with:
     - Permission requests
     - Token management (save to database)
     - Topic subscriptions
     - Notification handling
     - Helper functions for common notification types

3. **Backend Service**
   - `netlify/functions/send-notification.ts` - Server-side notification sender:
     - FCM V1 API integration
     - Single device, batch, and topic notifications
     - OAuth2 JWT authentication

4. **Database Schema**
   - `db/migrations/20250120_add_fcm_token_storage.sql`:
     - `user_fcm_tokens` table for device tokens
     - `notification_logs` table for delivery tracking
     - RLS policies for security

5. **UI Components**
   - `src/components/Settings/NotificationSettings.tsx` - User preferences
   - Integrated into Settings page Notifications tab

### Firebase Project Info
- **Project ID**: task-manager-d391c
- **Project Number**: 967577828067
- **Package Name**: com.lims.builder
- **App ID**: 1:967577828067:android:34a605e57140219f76e3d6

---

## Environment Variables Required

Add these to your Netlify environment variables:

```env
# From Firebase Console → Project Settings → Service Accounts → Generate New Private Key
FIREBASE_PROJECT_ID=task-manager-d391c
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@task-manager-d391c.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=<base64-encoded-private-key>
```

### Getting Firebase Service Account Credentials
1. Go to [Firebase Console](https://console.firebase.google.com/project/task-manager-d391c)
2. Navigate to **Project Settings** → **Service Accounts**
3. Click **Generate new private key**
4. Download the JSON file
5. Extract `client_email` and `private_key`
6. Base64 encode the private key: `base64 -w 0 < private_key.pem`

---

## Usage Examples

### Send Notification from Frontend

```typescript
import { 
  sendPushNotification, 
  notifyOrderCompleted,
  notifyResultReady,
  sendLabNotification 
} from '@/utils/firebaseMessaging';

// Send to single user (all their devices)
await sendPushNotification({
  userId: 'user-uuid',
  title: 'Order Ready',
  body: 'Order #123 is ready for pickup',
  data: { type: 'order_completed', orderId: '123' }
});

// Send to topic
await sendPushNotification({
  topic: 'order-updates',
  title: 'New Order',
  body: 'A new order has been placed'
});

// Use helper functions
await notifyOrderCompleted(userId, orderId, 'ORD-2024-001');
await notifyResultReady(userId, 'John Doe', orderId);

// Send to entire lab
await sendLabNotification(labId, {
  title: 'System Maintenance',
  body: 'System will be down for maintenance at 10 PM'
});
```

### Initialize on App Start

Firebase messaging is auto-initialized in `nativeInit.ts`:
```typescript
import { initializeFirebaseMessaging } from '@/utils/firebaseMessaging';

// Called automatically when app loads on Android
await initializeFirebaseMessaging();
```

### Topic Subscriptions (Settings Page)

Users can manage their notification preferences in Settings → Notifications:
- Order Updates (`order-updates`)
- Results Ready (`result-ready`)
- Payment Reminders (`payment-reminders`)
- System Alerts (`system-alerts`)

---

## Database Schema

### user_fcm_tokens
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
lab_id UUID REFERENCES labs(id)
fcm_token TEXT NOT NULL
device_id TEXT
device_info JSONB
is_active BOOLEAN DEFAULT true
last_used_at TIMESTAMP
created_at TIMESTAMP
updated_at TIMESTAMP
```

### notification_logs
```sql
id UUID PRIMARY KEY
lab_id UUID REFERENCES labs(id)
user_id UUID REFERENCES users(id)
notification_type TEXT NOT NULL
title TEXT NOT NULL
body TEXT NOT NULL
data JSONB
fcm_token TEXT
topic TEXT
message_id TEXT
delivery_status TEXT DEFAULT 'pending'
error_message TEXT
sent_at TIMESTAMP
delivered_at TIMESTAMP
related_table TEXT
related_id UUID
```

---

## Notification Payload Format

### Standard Notification
```json
{
  "token": "device_fcm_token",
  "title": "Order Completed",
  "body": "Order #12345 has been completed",
  "data": {
    "type": "order_completed",
    "orderId": "12345"
  }
}
```

### Topic Notification
```json
{
  "topic": "system-alerts",
  "title": "System Maintenance",
  "body": "System will be under maintenance tonight"
}
```

### Batch Notification
```json
{
  "tokens": ["token1", "token2", "token3"],
  "title": "Lab Announcement",
  "body": "Important update for all staff"
}
```

---

## Notification Types & Actions

| Type | Title | Body | Action |
|------|-------|------|--------|
| `order_completed` | Order Completed | Order #{id} completed | Navigate to order details |
| `result_ready` | Results Ready | Results for {patient} ready | Navigate to results page |
| `payment_due` | Payment Reminder | Payment of ₹{amount} due | Navigate to billing |
| `system_alert` | System Alert | {message} | Show in-app |

---

## Testing

### 1. Test from Firebase Console
1. Go to Firebase Console → Cloud Messaging
2. Click "Send your first message"
3. Enter notification title and body
4. Target: Single device → Paste FCM token (get from app logs)
5. Send test message

### 2. Test via API (Local)
```bash
curl -X POST http://localhost:8888/.netlify/functions/send-notification \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-fcm-token",
    "title": "Test Notification",
    "body": "This is a test"
  }'
```

### 3. Test Topic Notifications
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/send-notification \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "system-alerts",
    "title": "Test Alert",
    "body": "Testing topic notifications"
  }'
```

---

## Build & Deploy

### Sync Changes to Android
```bash
npm run build
npx cap sync android
```

### Build APK
```bash
npm run android:build
# or for debug
npm run android:build:debug
```

### Run Database Migration
```sql
-- Run in Supabase SQL Editor
-- Copy contents of db/migrations/20250120_add_fcm_token_storage.sql
```

---

## Troubleshooting

### Notifications Not Received
1. **Check Permissions**: Settings → Apps → LIMS Builder → Notifications → Enabled
2. **Check Token**: Look in console logs for "FCM Token:"
3. **Check Database**: Verify token saved in `user_fcm_tokens` table
4. **Check Netlify Logs**: Review function execution logs
5. **Check Battery Optimization**: Disable for LIMS Builder

### Token Not Generated
1. Verify `google-services.json` is in `android/app/`
2. Check Firebase project package name matches `com.lims.builder`
3. Rebuild app: `npm run android:sync`
4. Check logs: `adb logcat | grep FCM`

### Backend Errors
1. Verify environment variables are set in Netlify
2. Check FIREBASE_PRIVATE_KEY is base64 encoded correctly
3. Review Netlify function logs for detailed errors

---

## Security Best Practices

1. ✅ Service account credentials only on server (Netlify functions)
2. ✅ FCM tokens scoped to user via RLS
3. ✅ No sensitive data in notification payloads
4. ✅ Topic subscriptions managed server-side
5. ✅ Token cleanup for inactive devices

---

## Resources

- [Firebase Console](https://console.firebase.google.com/project/task-manager-d391c)
- [Capacitor Firebase Messaging](https://github.com/capawesome-team/capacitor-firebase/tree/main/packages/messaging)
- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [FCM V1 API](https://firebase.google.com/docs/cloud-messaging/migrate-v1)
