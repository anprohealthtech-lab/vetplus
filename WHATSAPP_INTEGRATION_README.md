# WhatsApp Integration - LIMS v2

## Overview
Complete WhatsApp integration for sending PDF reports directly from the LIMS system. The integration includes connection management, messaging interface, and seamless report sending functionality.

## Features Implemented

### 1. WhatsApp Connection Management
- **QR Code Connection**: Display QR codes for WhatsApp Web connection
- **Real-time Status**: WebSocket-based connection status monitoring
- **Auto-reconnection**: Automatic reconnection handling

### 2. Message Sending Interface
- **Template Messages**: Pre-defined message templates for different report types
- **File Attachments**: Support for PDF report attachments
- **Phone Validation**: International phone number validation
- **Bulk Messaging**: Send reports to multiple recipients

### 3. Message History & Tracking
- **Sent Messages**: Complete history of sent messages
- **Delivery Status**: Track message delivery and read status
- **Filtering**: Filter by date range, recipient, status
- **Export**: Export message history for reporting

### 4. Quick Send Integration
- **Reports Page**: Quick send button on existing reports page
- **Modal Interface**: Popup modal for quick WhatsApp sending
- **Pre-filled Data**: Auto-populate patient and report information

## File Structure

### Core API (`src/utils/whatsappAPI.ts`)
```typescript
// Connection Management
connectWhatsApp(labId: string)
disconnectWhatsApp(labId: string)
getConnectionStatus(labId: string)

// Message Sending
sendMessage(to: string, message: string, labId: string)
sendReport(to: string, reportUrl: string, message: string, labId: string)

// History & Tracking
getMessageHistory(labId: string, filters?)
getMessageStatus(messageId: string)
```

### Components
- `WhatsApp.tsx` - Main WhatsApp integration page with tabs
- `WhatsAppDashboard.tsx` - Connection management and QR code display
- `WhatsAppMessaging.tsx` - Message composition and sending interface
- `MessageHistory.tsx` - Message history and tracking
- `QuickSendReport.tsx` - Quick send modal for integration

### UI Components
- `tabs.tsx` - Custom tab component for WhatsApp interface

## Usage Instructions

### 1. Initial Setup
1. Navigate to WhatsApp page (`/whatsapp`)
2. Scan QR code with WhatsApp mobile app
3. Verify connection status shows "Connected"

### 2. Sending Reports from Reports Page
1. Go to Reports page (`/reports`)
2. Find the desired report
3. Click the WhatsApp icon next to download buttons
4. Enter recipient phone number
5. Customize message if needed
6. Click "Send Report"

### 3. Bulk Messaging
1. Go to WhatsApp → Messaging tab
2. Select message template
3. Upload recipient list (CSV format)
4. Attach PDF files if needed
5. Send to multiple recipients

### 4. Managing Messages
1. View sent messages in History tab
2. Filter by date, status, or recipient
3. Check delivery and read status
4. Export message data for reporting

## API Endpoints

### Backend Integration
The frontend integrates with the following backend endpoints:

```
POST /api/whatsapp/connect
GET  /api/whatsapp/status/:labId
POST /api/whatsapp/send-message
POST /api/whatsapp/send-file
GET  /api/whatsapp/messages/:labId
WebSocket /api/whatsapp/status-updates
```

### Database Tables
- `whatsapp_connections` - Connection status and QR data
- `whatsapp_messages` - Sent message history
- `whatsapp_attachments` - File attachment tracking

## Security Features

### 1. Lab-based Isolation
- All WhatsApp operations are lab-scoped
- Users can only access their lab's WhatsApp integration
- Connection and message data isolated per lab

### 2. Authentication
- Supabase JWT authentication required
- API endpoints protected with auth middleware
- User permissions validated per operation

### 3. File Security
- Secure file upload to Supabase Storage
- Temporary URLs for file sharing
- Automatic file cleanup after sending

## Configuration

### Environment Variables
```env
# Backend WhatsApp API
WHATSAPP_API_URL=http://localhost:3001/api/whatsapp
WHATSAPP_WEBHOOK_SECRET=your_webhook_secret

# File Storage
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Message Templates
Default message templates are stored in the database and can be customized per lab:

```sql
INSERT INTO whatsapp_templates (lab_id, name, message) VALUES
('lab_id', 'report_ready', 'Hi {patient_name}, your {test_name} report is ready. Please find it attached.'),
('lab_id', 'followup', 'Dear {patient_name}, please review your test results and contact us if you have questions.');
```

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Ensure WhatsApp Web is accessible
   - Check network connectivity
   - Verify QR code is not expired

2. **Message Not Sending**
   - Verify phone number format (+country_code)
   - Check WhatsApp connection status
   - Ensure recipient has WhatsApp installed

3. **File Upload Issues**
   - Check file size limits (max 16MB)
   - Verify file format is supported
   - Ensure Supabase storage is configured

### Debug Mode
Enable debug logging by setting:
```typescript
const DEBUG_WHATSAPP = true;
```

## Future Enhancements

### Planned Features
- [ ] Message scheduling
- [ ] WhatsApp Business API integration
- [ ] Rich media messages (images, videos)
- [ ] Message automation based on order status
- [ ] Advanced analytics and reporting
- [ ] Multi-device support

### Integration Opportunities
- [ ] Patient notification system
- [ ] Appointment reminders
- [ ] Marketing campaigns
- [ ] Customer support chat

## Support
For technical support or feature requests, please contact the development team or create an issue in the project repository.