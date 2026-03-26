# Delivery Status Tracking System - Complete Implementation

## Overview
This document describes the complete delivery tracking system for **Reports** and **Invoices** in the LIMS, supporting both **API sends** and **manual link tracking**.

## Database Schema

### Reports Table - Delivery Tracking Columns
```sql
-- Added in migration: 20251211_add_report_delivery_tracking.sql
ALTER TABLE reports
ADD COLUMN whatsapp_sent_at TIMESTAMPTZ,
ADD COLUMN whatsapp_sent_to TEXT,
ADD COLUMN whatsapp_sent_by UUID REFERENCES users(id),
ADD COLUMN whatsapp_sent_via TEXT CHECK (whatsapp_sent_via IN ('api', 'manual_link')),
ADD COLUMN whatsapp_caption TEXT,
ADD COLUMN email_sent_at TIMESTAMPTZ,
ADD COLUMN email_sent_to TEXT,
ADD COLUMN email_sent_by UUID REFERENCES users(id),
ADD COLUMN email_sent_via TEXT CHECK (email_sent_via IN ('api', 'manual_link')),
ADD COLUMN doctor_informed_at TIMESTAMPTZ,
ADD COLUMN doctor_informed_via TEXT CHECK (doctor_informed_via IN ('whatsapp', 'email', 'both')),
ADD COLUMN doctor_informed_by UUID REFERENCES users(id),
ADD COLUMN doctor_sent_via TEXT CHECK (doctor_sent_via IN ('api', 'manual_link')),
ADD COLUMN clinical_summary_included BOOLEAN DEFAULT false;
```

### Invoices Table - Delivery Tracking Columns
```sql
-- Added in migration: 20251218_add_invoice_delivery_tracking.sql
ALTER TABLE invoices
ADD COLUMN whatsapp_sent_at TIMESTAMPTZ,
ADD COLUMN whatsapp_sent_to TEXT,
ADD COLUMN whatsapp_sent_by UUID REFERENCES users(id),
ADD COLUMN whatsapp_sent_via TEXT CHECK (whatsapp_sent_via IN ('api', 'manual_link')),
ADD COLUMN whatsapp_caption TEXT,
ADD COLUMN email_sent_at TIMESTAMPTZ,
ADD COLUMN email_sent_to TEXT,
ADD COLUMN email_sent_by UUID REFERENCES users(id),
ADD COLUMN email_sent_via TEXT CHECK (email_sent_via IN ('api', 'manual_link')),
ADD COLUMN payment_reminder_count INTEGER DEFAULT 0,
ADD COLUMN last_reminder_at TIMESTAMPTZ,
ADD COLUMN reminder_sent_by UUID REFERENCES users(id);
```

## API Methods (src/utils/supabase.ts)

### Reports Object
```typescript
database.reports = {
  // Record WhatsApp send (API or manual link)
  recordWhatsAppSend: async (reportId: string, params: {
    to: string;
    caption: string;
    sentBy: string;
    includedClinicalSummary: boolean;
    sentVia?: 'api' | 'manual_link';
  }) => Promise<{data, error}>
  
  // Record email send (API or manual link)
  recordEmailSend: async (reportId: string, params: {
    to: string;
    sentBy: string;
    includedClinicalSummary: boolean;
    sentVia?: 'api' | 'manual_link';
  }) => Promise<{data, error}>
  
  // Record doctor notification (API or manual link)
  recordDoctorNotification: async (reportId: string, params: {
    via: 'whatsapp' | 'email' | 'both';
    sentBy: string;
    sentVia?: 'api' | 'manual_link';
  }) => Promise<{data, error}>
  
  // Get delivery status
  getDeliveryStatus: async (reportId: string) => Promise<{data, error}>
  
  // Check if already sent
  wasAlreadySent: async (reportId: string, type: 'whatsapp' | 'email' | 'doctor') => Promise<boolean>
}
```

### Invoices Object
```typescript
database.invoices = {
  // Record WhatsApp send (API or manual link)
  recordWhatsAppSend: async (invoiceId: string, params: {
    to: string;
    caption: string;
    sentBy: string;
    sentVia?: 'api' | 'manual_link';
  }) => Promise<{data, error}>
  
  // Record email send (API or manual link)
  recordEmailSend: async (invoiceId: string, params: {
    to: string;
    sentBy: string;
    sentVia?: 'api' | 'manual_link';
  }) => Promise<{data, error}>
  
  // Record payment reminder
  recordPaymentReminder: async (invoiceId: string, params: {
    sentBy: string;
    sentVia?: 'api' | 'manual_link';
  }) => Promise<{data, error}>
  
  // Get delivery status
  getDeliveryStatus: async (invoiceId: string) => Promise<{data, error}>
  
  // Check if already sent
  wasAlreadySent: async (invoiceId: string, type: 'whatsapp' | 'email') => Promise<boolean>
}
```

## UI Components

### Report Delivery Tracker
**File**: `src/components/Reports/ReportDeliveryTracker.tsx`

Features:
- WhatsApp send tracking (manual link)
- Email send tracking (manual link)
- Doctor notification tracking (manual link)
- Clinical summary inclusion checkbox
- Real-time status display
- Delivery history

Usage:
```tsx
<ReportDeliveryTracker
  reportId={report.id}
  patientPhone={patient.phone}
  patientEmail={patient.email}
  doctorPhone={doctor.phone}
  doctorEmail={doctor.email}
  onDeliveryTracked={() => refreshDashboard()}
/>
```

### Invoice Delivery Tracker
**File**: `src/components/Billing/InvoiceDeliveryTracker.tsx`

Features:
- WhatsApp send tracking (manual link)
- Email send tracking (manual link)
- Payment reminder tracking
- Real-time status display
- Delivery history

Usage:
```tsx
<InvoiceDeliveryTracker
  invoiceId={invoice.id}
  invoiceNumber={invoice.invoice_number}
  customerPhone={customer.phone}
  customerEmail={customer.email}
  onDeliveryTracked={() => refreshDashboard()}
/>
```

## Dashboard Integration

### Status Badges
Both reports and invoices show delivery status badges on the Dashboard:

**Report Badges:**
- 📄 Report Ready (when report_url exists)
- 👨‍⚕️ Dr Informed (when doctor_informed_at exists)
- 📱 Sent / 📧 Emailed (when whatsapp_sent_at or email_sent_at exists)

**Invoice Badges:**
- 💰 Invoice Ready (when pdf_url exists)
- 📱 Invoice Sent / 📧 Invoice Emailed (when whatsapp_sent_at or email_sent_at exists)

### Badge Display Logic
```typescript
// Report delivery badges
{o.report_url && <Badge>📄 Report Ready</Badge>}
{o.doctor_informed_at && <Badge>👨‍⚕️ Dr Informed</Badge>}
{(o.whatsapp_sent_at || o.email_sent_at) && <Badge>📱 Sent</Badge>}

// Invoice delivery badges
{o.invoice_pdf_url && <Badge>💰 Invoice Ready</Badge>}
{o.invoice_whatsapp_sent_at && <Badge>📱 Invoice Sent</Badge>}
{o.invoice_email_sent_at && <Badge>📧 Invoice Emailed</Badge>}
```

## Tracking Methods

### 1. API Send (Automatic)
When using the WhatsApp backend API or email service:
```typescript
// Automatically set sentVia: 'api'
await database.reports.recordWhatsAppSend(reportId, {
  to: phone,
  caption: message,
  sentBy: userId,
  includedClinicalSummary: true,
  sentVia: 'api'
});
```

### 2. Manual Link (User-Created Links)
When user creates a WhatsApp/email link manually:
```typescript
// User clicks "Track Delivery" button
// Selects WhatsApp or Email
// Enters phone/email
// Records: sentVia: 'manual_link'
await database.reports.recordWhatsAppSend(reportId, {
  to: phone,
  caption: message,
  sentBy: userId,
  includedClinicalSummary: false,
  sentVia: 'manual_link'
});
```

## Status Flow

### Reports
1. **Report Generation** → `report_url` populated
2. **Send to Patient** → `whatsapp_sent_at` or `email_sent_at` populated
3. **Inform Doctor** → `doctor_informed_at` populated
4. **Dashboard Updates** → Badges show status in real-time

### Invoices
1. **Invoice Generation** → `pdf_url` populated
2. **Send to Customer** → `whatsapp_sent_at` or `email_sent_at` populated
3. **Payment Reminder** → `last_reminder_at` populated, `payment_reminder_count` incremented
4. **Dashboard Updates** → Badges show status in real-time

## Benefits

### For Lab Staff
- ✅ **Single Source of Truth**: All delivery tracking in one place
- ✅ **Manual + API Tracking**: Both methods recorded equally
- ✅ **Audit Trail**: Who sent, when sent, how sent (API vs manual)
- ✅ **Visual Status**: Quick badges on Dashboard
- ✅ **Delivery History**: Complete timeline of all sends

### For Workflow
- ✅ **No Duplicate Sends**: Can check if already sent before sending again
- ✅ **SLA Tracking**: Can measure time from report ready to sent
- ✅ **Follow-ups**: Can identify unsent reports/invoices
- ✅ **Payment Reminders**: Track reminder count and frequency

## Example Queries

### Find Unsent Reports
```sql
SELECT * FROM reports
WHERE report_url IS NOT NULL
  AND whatsapp_sent_at IS NULL
  AND email_sent_at IS NULL
  AND created_at < NOW() - INTERVAL '1 day';
```

### Find Unpaid Invoices Not Sent
```sql
SELECT * FROM invoices
WHERE status != 'paid'
  AND pdf_url IS NOT NULL
  AND whatsapp_sent_at IS NULL
  AND email_sent_at IS NULL;
```

### Track Manual vs API Sends
```sql
-- Manual link sends
SELECT COUNT(*) FROM reports WHERE whatsapp_sent_via = 'manual_link';

-- API sends
SELECT COUNT(*) FROM reports WHERE whatsapp_sent_via = 'api';
```

## Testing Checklist

- [x] Database migrations applied
- [x] Report delivery tracking (API)
- [x] Report delivery tracking (manual link)
- [x] Invoice delivery tracking (manual link)
- [x] Dashboard badges show report status
- [x] Dashboard badges show invoice status
- [x] Delivery status persists after page refresh
- [x] `_via` field correctly stores 'api' or 'manual_link'
- [ ] API send integration (WhatsApp backend)
- [ ] Email send integration
- [ ] Payment reminder workflow

## Future Enhancements

1. **Delivery Analytics Dashboard**
   - Send rate by lab/user/location
   - Manual vs API send comparison
   - Average time to send after report ready

2. **Automated Reminders**
   - Auto-send reports after 24 hours if not sent
   - Payment reminders after due date
   - Doctor notification automation

3. **Bulk Operations**
   - Bulk send reports
   - Bulk payment reminders
   - Batch export delivery status

4. **Template Management**
   - Save message templates per lab
   - WhatsApp template approval workflow
   - Email template builder

---

**Status**: ✅ Core implementation complete
**Last Updated**: 2025-12-18
**Version**: 2.0
