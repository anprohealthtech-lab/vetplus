# Invoice & Report Delivery Status Tracking System

## Overview
Both **Reports** and **Invoices** now have identical delivery tracking systems that work for **both automatic (API) and manual (link-based) sends**.

---

## Database Schema

### Reports Table - Delivery Tracking Columns
```sql
whatsapp_sent_at TIMESTAMPTZ          -- When sent via WhatsApp
whatsapp_sent_to TEXT                 -- Recipient phone
whatsapp_sent_by UUID                 -- User who sent
whatsapp_sent_via TEXT                -- 'api' or 'manual_link'
whatsapp_caption TEXT                 -- Message sent

email_sent_at TIMESTAMPTZ             -- When sent via Email
email_sent_to TEXT                    -- Recipient email
email_sent_by UUID                    -- User who sent
email_sent_via TEXT                   -- 'api' or 'manual_link'

doctor_informed_at TIMESTAMPTZ        -- When doctor was informed
doctor_informed_via TEXT              -- 'whatsapp', 'email', or 'both'
doctor_informed_by UUID               -- User who informed
doctor_sent_via TEXT                  -- 'api' or 'manual_link'

clinical_summary_included BOOLEAN     -- Whether clinical summary was included
```

### Invoices Table - Delivery Tracking Columns
```sql
whatsapp_sent_at TIMESTAMPTZ          -- When sent via WhatsApp
whatsapp_sent_to TEXT                 -- Recipient phone
whatsapp_sent_by UUID                 -- User who sent
whatsapp_sent_via TEXT                -- 'api' or 'manual_link'
whatsapp_caption TEXT                 -- Message sent

email_sent_at TIMESTAMPTZ             -- When sent via Email
email_sent_to TEXT                    -- Recipient email
email_sent_by UUID                    -- User who sent
email_sent_via TEXT                   -- 'api' or 'manual_link'

payment_reminder_count INTEGER        -- Number of payment reminders
last_reminder_at TIMESTAMPTZ          -- When last reminder was sent
reminder_sent_by UUID                 -- User who sent reminder
```

---

## Status Tracking Flow

### Automatic API Send (Backend WhatsApp Service)
```
User clicks "Send via WhatsApp" button
    ↓
Backend API processes send
    ↓
recordWhatsAppSend() called with sentVia='api'
    ↓
Database updated:
  - whatsapp_sent_at = NOW()
  - whatsapp_sent_via = 'api'
  - whatsapp_sent_by = current_user_id
    ↓
Dashboard shows: ✓ Sent (via API)
```

### Manual Link Send (User Creates Link, Shares Manually)
```
User clicks "Create Shareable Link"
    ↓
Frontend generates secure link
    ↓
User copies link and sends via WhatsApp/Email manually
    ↓
User returns and clicks "Mark as Sent"
    ↓
recordWhatsAppSend() called with sentVia='manual_link'
    ↓
Database updated:
  - whatsapp_sent_at = NOW()
  - whatsapp_sent_via = 'manual_link'
  - whatsapp_sent_by = current_user_id
    ↓
Dashboard shows: ✓ Sent (manual)
```

**Key Point**: Both methods set the SAME status columns. The `sentVia` flag only distinguishes HOW it was sent.

---

## Database Functions and Methods

### For Reports
```typescript
// In src/utils/supabase.ts -> database.reports object

recordWhatsAppSend(reportId, { to, caption, sentBy, sentVia })
  → Updates reports table with whatsapp_sent_at, whatsapp_sent_via='api'|'manual_link'

recordEmailSend(reportId, { to, sentBy, sentVia })
  → Updates reports table with email_sent_at, email_sent_via='api'|'manual_link'

recordDoctorNotification(reportId, { via, sentBy, sentVia })
  → Updates reports table with doctor_informed_at, doctor_informed_via, doctor_sent_via

getDeliveryStatus(reportId)
  → Retrieves all delivery tracking fields

wasAlreadySent(reportId, 'whatsapp'|'email'|'doctor')
  → Returns boolean if already sent
```

### For Invoices
```typescript
// In src/utils/supabase.ts -> database.invoices object

recordWhatsAppSend(invoiceId, { to, caption, sentBy, sentVia })
  → Updates invoices table with whatsapp_sent_at, whatsapp_sent_via='api'|'manual_link'

recordEmailSend(invoiceId, { to, sentBy, sentVia })
  → Updates invoices table with email_sent_at, email_sent_via='api'|'manual_link'

recordPaymentReminder(invoiceId, { sentBy, sentVia })
  → Updates invoices table with last_reminder_at, increments payment_reminder_count

getDeliveryStatus(invoiceId)
  → Retrieves all delivery tracking fields

wasAlreadySent(invoiceId, 'whatsapp'|'email')
  → Returns boolean if already sent
```

---

## UI Components

### InvoiceDeliveryTracker Component
**Location**: `src/components/Billing/InvoiceDeliveryTracker.tsx`

**Features**:
- Shows current delivery status (WhatsApp, Email, Payment Reminders)
- Displays when sent, to whom, and via which method (API or manual)
- Manual recording interface for WhatsApp sends
- Manual recording interface for Email sends
- Payment reminder tracking
- Prevents duplicate sends on same day (database trigger)

**Usage in Dashboard**:
```tsx
<InvoiceDeliveryTracker
  invoiceId={invoice.id}
  invoiceNumber={invoice.invoice_number}
  customerPhone={customer.phone}
  customerEmail={customer.email}
  onDeliveryTracked={() => refreshInvoice()}
/>
```

### ReportDeliveryTracker Component
**Location**: Similar component for reports

**Features**:
- Same as InvoiceDeliveryTracker but for reports
- Also tracks doctor notifications

---

## Dashboard Display

### Report Delivery Badges
```
📄 Report Ready      (when report_url exists)
👨‍⚕️ Dr Informed       (when doctor_informed_at is set)
📱 Sent              (when whatsapp_sent_at is set)
📧 Emailed           (when email_sent_at is set)
```

### Invoice Delivery Badges (NEW)
```
📱 WhatsApp Sent     (when whatsapp_sent_at is set)
📧 Email Sent        (when email_sent_at is set)
🔔 Reminders: N      (when payment_reminder_count > 0)
```

Both show on dashboard as pills with timestamps on hover.

---

## Example Scenarios

### Scenario 1: API Send (Automatic)
```
1. User goes to Order Detail → Invoice section
2. Clicks "Send via WhatsApp"
3. Backend WhatsApp service sends file
4. On success: database.invoices.recordWhatsAppSend(invoiceId, {
     to: '+919876543210',
     caption: 'Your invoice is ready',
     sentBy: user_id,
     sentVia: 'api'    ← FLAG: Backend sent it
   })
5. Dashboard shows: "📱 Sent (via API)" with timestamp
6. Status persists in database indefinitely
```

### Scenario 2: Manual Link Send
```
1. User goes to Order Detail → Invoice section
2. Clicks "Create Shareable Link"
3. Frontend generates shareable PDF link
4. User copies link and sends via WhatsApp manually
5. User returns to order and clicks "Mark as Sent"
6. Clicks "Record WhatsApp Send"
7. Enters phone number
8. Clicks "Record"
9. database.invoices.recordWhatsAppSend(invoiceId, {
     to: '+919876543210',
     caption: 'Invoice link shared',
     sentBy: user_id,
     sentVia: 'manual_link'  ← FLAG: User manually sent it
   })
10. Dashboard shows: "📱 Sent (manual)" with timestamp
11. Status persists in database indefinitely
```

### Scenario 3: Multiple Sends (Email After WhatsApp)
```
Day 1:
  - recordWhatsAppSend() → whatsapp_sent_at = 2025-12-18 10:00 AM

Day 2:
  - recordEmailSend() → email_sent_at = 2025-12-19 2:30 PM

Dashboard now shows:
  📱 Sent  📧 Sent
  Both timestamps recorded
```

---

## Safety Mechanisms

### 1. Duplicate Send Prevention (Trigger)
```sql
-- check_invoice_send_cooldown() trigger
-- Prevents sending via same channel on same day
-- Raises exception if attempted
```

### 2. Reminder Count Auto-Increment (Trigger)
```sql
-- increment_invoice_reminder_count() trigger
-- Automatically increments counter when last_reminder_at is updated
```

### 3. RLS Policies
- Users can only see/update invoices from their lab
- Same policies as existing invoices table

---

## Migration Applied

**File**: `supabase/migrations/20251218_add_invoice_delivery_tracking.sql`

**What it does**:
1. Adds 13 new columns to invoices table
2. Creates 3 indexes for fast delivery queries
3. Creates 2 triggers for safety (cooldown + reminder counting)
4. Adds detailed comments on each column

**How to apply**:
```bash
# Automatic (Supabase CLI)
supabase db push

# Or manual SQL in Supabase dashboard
# Settings → SQL Editor → Run migration
```

---

## Testing Checklist

- [ ] API WhatsApp send records with `sentVia='api'`
- [ ] Manual WhatsApp send records with `sentVia='manual_link'`
- [ ] Email send works for both API and manual
- [ ] Dashboard shows both report and invoice delivery status
- [ ] Delivery tracker component displays in invoice modal
- [ ] Timestamp shows correct date/time
- [ ] Cooldown trigger prevents duplicate sends same day
- [ ] Reminder count increments correctly
- [ ] Status persists after page refresh
- [ ] Multiple sends on different days work
- [ ] User info displayed correctly (who sent, when)

---

## Code Examples

### Recording API Send (from WhatsApp Service)
```typescript
const { data, error } = await database.reports.recordWhatsAppSend(reportId, {
  to: '+919876543210',
  caption: 'Your test report is ready',
  sentBy: user_id,
  includedClinicalSummary: true,
  sentVia: 'api'  // Backend WhatsApp service sent it
});
```

### Recording Manual Send (from UI)
```typescript
const { data, error } = await database.invoices.recordWhatsAppSend(invoiceId, {
  to: customerPhone,
  caption: `Invoice ${invoiceNumber} is ready`,
  sentBy: user_id,
  sentVia: 'manual_link'  // User manually created and sent link
});
```

### Checking Delivery Status
```typescript
const { data: status, error } = await database.invoices.getDeliveryStatus(invoiceId);

// Returns:
{
  whatsapp_sent_at: '2025-12-18T10:30:00Z',
  whatsapp_sent_to: '+919876543210',
  whatsapp_sent_by: 'user-id-123',
  whatsapp_sent_via: 'api',
  email_sent_at: null,
  email_sent_to: null,
  payment_reminder_count: 2,
  last_reminder_at: '2025-12-18T09:00:00Z'
}
```

---

## Summary

✅ **Reports**: Already had delivery tracking (report_ready, dr_informed, sent)
✅ **Invoices**: Now have identical tracking system
✅ **Both Methods**: API and manual sends save same status
✅ **Differentiation**: `sentVia` flag shows which method was used
✅ **Persistence**: Status saved permanently in database
✅ **Dashboard**: Shows all delivery statuses with timestamps
✅ **Safety**: Triggers prevent duplicate sends and auto-count reminders
✅ **User Tracking**: Records who sent and when, for all sends
