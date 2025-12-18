# Invoice & Report Delivery Tracking System

## Overview

This system tracks all delivery statuses for both **reports** and **invoices** in the LIMS, whether sent via:
- **Backend API** (automatic WhatsApp/Email sending)
- **Manual Links** (user creates and shares links manually)

Both methods are now tracked in the database with timestamps, recipient info, and who sent them.

---

## Database Schema

### Reports Delivery Tracking (Existing)

Table: `reports`

```sql
whatsapp_sent_at TIMESTAMPTZ      -- When WhatsApp was sent
whatsapp_sent_to TEXT              -- Recipient phone number
whatsapp_sent_by UUID              -- User ID who sent it
whatsapp_sent_via TEXT             -- 'api' or 'manual_link'
whatsapp_caption TEXT              -- Message sent with PDF

email_sent_at TIMESTAMPTZ          -- When email was sent
email_sent_to TEXT                 -- Recipient email
email_sent_by UUID                 -- User ID who sent it
email_sent_via TEXT                -- 'api' or 'manual_link'

doctor_informed_at TIMESTAMPTZ     -- When doctor notification sent
doctor_informed_via TEXT           -- 'whatsapp', 'email', or 'both'
doctor_informed_by UUID            -- User ID who sent it
doctor_sent_via TEXT               -- 'api' or 'manual_link'

clinical_summary_included BOOLEAN  -- Whether clinical summary was in send
```

### Invoices Delivery Tracking (NEW)

Table: `invoices`

```sql
whatsapp_sent_at TIMESTAMPTZ       -- When invoice was sent via WhatsApp
whatsapp_sent_to TEXT              -- Recipient phone number
whatsapp_sent_by UUID              -- User ID who sent it
whatsapp_sent_via TEXT             -- 'api' or 'manual_link'
whatsapp_caption TEXT              -- Message sent with PDF

email_sent_at TIMESTAMPTZ          -- When invoice was sent via email
email_sent_to TEXT                 -- Recipient email
email_sent_by UUID                 -- User ID who sent it
email_sent_via TEXT                -- 'api' or 'manual_link'

payment_reminder_count INTEGER     -- Total reminders sent (auto-incremented)
last_reminder_at TIMESTAMPTZ       -- Timestamp of last reminder
reminder_sent_by UUID              -- User ID who sent last reminder
```

---

## How It Works

### 1. Automatic API Sends

When using backend WhatsApp/Email API:

```typescript
// Example: Report sent via backend API
const { data, error } = await database.reports.recordWhatsAppSend(reportId, {
  to: customerPhone,
  caption: 'Your report is ready',
  sentBy: userId,
  sentVia: 'api'  // Automatically tracked
});

// Result: whatsapp_sent_at, whatsapp_sent_to, whatsapp_sent_by, whatsapp_sent_via all set
```

**Status displayed as**: "📱 Sent" with timestamp

### 2. Manual Link Sends

When user creates and shares manual link (WhatsApp Business, Email, etc.):

```typescript
// User creates manual link and shares it
// Later, they record it in UI using InvoiceDeliveryTracker or ReportDeliveryTracker

const { data, error } = await database.invoices.recordWhatsAppSend(invoiceId, {
  to: customerPhone,
  caption: 'Invoice shared via manual link',
  sentBy: userId,
  sentVia: 'manual_link'  // Tracks that it was manual
});

// Result: whatsapp_sent_at set, manual_link recorded
```

**Status displayed as**: "📱 Sent" (same as API, but with 'manual_link' noted in DB)

### 3. Payment Reminders

For invoices, track payment reminders separately:

```typescript
// Record a payment reminder send
const { data, error } = await database.invoices.recordPaymentReminder(invoiceId, {
  sentBy: userId,
  sentVia: 'manual_link' // or 'api'
});

// Result: 
// - payment_reminder_count incremented automatically (via trigger)
// - last_reminder_at set to now()
// - reminder_sent_by set to userId
```

**Status displayed as**: "🔔 2 Payment Reminders"

---

## Dashboard Status Indicators

### On Order Cards

```
Patient Name (35y, Male)
Status: Completed

Delivery Status Badges:
📄 Report Ready          (report_url exists)
👨‍⚕️ Dr Informed           (doctor_informed_at set)
📱 Sent                  (whatsapp_sent_at OR email_sent_at set)
₹430 | Fully Billed      (payment_status)
```

### On Invoice Cards

```
Invoice #INV-2024-0001
Amount: ₹5,000 | Status: Pending

Delivery Status:
📱 Sent / 📧 Emailed     (if whatsapp_sent_at or email_sent_at)
🔔 2 Reminders           (if payment_reminder_count > 0)
```

---

## Components

### 1. InvoiceDeliveryTracker (`src/components/Billing/InvoiceDeliveryTracker.tsx`)

**Purpose**: Modal for recording invoice deliveries (manual or API)

**Features**:
- Shows current delivery status (WhatsApp, Email, Reminders)
- Record WhatsApp send (manual link)
- Record Email send (manual link)
- Record payment reminder
- All tracked with timestamp, recipient, and who sent it

**Usage**:
```typescript
<InvoiceDeliveryTracker
  invoiceId={invoice.id}
  invoiceNumber={invoice.invoice_number}
  customerPhone={customer.phone}
  customerEmail={customer.email}
  onDeliveryTracked={() => refresh()}
/>
```

### 2. InvoiceDeliveryStatus (`src/components/Billing/InvoiceDeliveryStatus.tsx`)

**Purpose**: Display current delivery status

**Props**:
- `whatsappSentAt` - Timestamp when sent via WhatsApp
- `emailSentAt` - Timestamp when sent via email
- `paymentReminderCount` - Number of reminders sent
- `compact` - Icon-only (true) or full badges (false)

**Usage**:
```typescript
// Compact icons for lists/tables
<InvoiceDeliveryStatus
  whatsappSentAt={invoice.whatsapp_sent_at}
  emailSentAt={invoice.email_sent_at}
  paymentReminderCount={invoice.payment_reminder_count}
  compact={true}
/>

// Full badges for detail views
<InvoiceDeliveryStatus
  whatsappSentAt={invoice.whatsapp_sent_at}
  emailSentAt={invoice.email_sent_at}
  paymentReminderCount={invoice.payment_reminder_count}
  compact={false}
/>
```

### 3. ReportDeliveryTracker (Similar to InvoiceDeliveryTracker)

For reports, same pattern:
- Record WhatsApp send
- Record Email send
- Record doctor notification

---

## Database Functions in supabase.ts

### Reports (Existing - Enhanced)

```typescript
database.reports.recordWhatsAppSend(reportId, {
  to: string,
  caption: string,
  sentBy: string,
  includedClinicalSummary: boolean,
  sentVia?: 'api' | 'manual_link'
})

database.reports.recordEmailSend(reportId, {
  to: string,
  sentBy: string,
  includedClinicalSummary: boolean,
  sentVia?: 'api' | 'manual_link'
})

database.reports.recordDoctorNotification(reportId, {
  via: 'whatsapp' | 'email' | 'both',
  sentBy: string,
  sentVia?: 'api' | 'manual_link'
})

database.reports.getDeliveryStatus(reportId)
database.reports.wasAlreadySent(reportId, type: 'whatsapp' | 'email' | 'doctor')
```

### Invoices (NEW)

```typescript
database.invoices.recordWhatsAppSend(invoiceId, {
  to: string,
  caption: string,
  sentBy: string,
  sentVia?: 'api' | 'manual_link'
})

database.invoices.recordEmailSend(invoiceId, {
  to: string,
  sentBy: string,
  sentVia?: 'api' | 'manual_link'
})

database.invoices.recordPaymentReminder(invoiceId, {
  sentBy: string,
  sentVia?: 'api' | 'manual_link'
})

database.invoices.getDeliveryStatus(invoiceId)
database.invoices.wasAlreadySent(invoiceId, type: 'whatsapp' | 'email')
```

---

## Query Examples

### Get all unsent invoices for today

```sql
SELECT * FROM invoices 
WHERE 
  DATE(created_at) = CURRENT_DATE 
  AND whatsapp_sent_at IS NULL 
  AND email_sent_at IS NULL
ORDER BY created_at DESC;
```

### Get invoices with multiple reminders

```sql
SELECT invoice_number, customer_phone, payment_reminder_count, last_reminder_at 
FROM invoices 
WHERE payment_reminder_count > 0
ORDER BY last_reminder_at DESC;
```

### Get delivery stats by lab and date

```sql
SELECT 
  DATE(whatsapp_sent_at) as date,
  COUNT(*) as total_sent,
  COUNT(DISTINCT lab_id) as labs_using_whatsapp,
  COUNT(CASE WHEN whatsapp_sent_via = 'api' THEN 1 END) as api_sends,
  COUNT(CASE WHEN whatsapp_sent_via = 'manual_link' THEN 1 END) as manual_sends
FROM invoices 
WHERE whatsapp_sent_at IS NOT NULL
GROUP BY DATE(whatsapp_sent_at)
ORDER BY date DESC;
```

---

## Workflow: Recording Manual Sends

### Scenario: User shares invoice via WhatsApp manually

**Step 1**: User creates manual link (e.g., using WhatsApp Web, creates a Supabase public link, etc.)

**Step 2**: User shares the link to customer

**Step 3**: User comes back to app and records it:
- Opens Invoice detail
- Clicks "Track Delivery" button
- Selects "Record WhatsApp Send (Manual Link)"
- Enters customer phone number
- Enters optional message
- Clicks "Record WhatsApp Send"

**Step 4**: System updates invoice with:
```sql
whatsapp_sent_at = NOW()
whatsapp_sent_to = '<phone>'
whatsapp_sent_by = '<user_id>'
whatsapp_sent_via = 'manual_link'
whatsapp_caption = '<message>'
```

**Step 5**: Dashboard shows: "📱 Sent" with timestamp

---

## Benefits of This Approach

### ✅ For Automatic API Sends
- Backend automatically records delivery when sent
- Timestamp proves when it was delivered
- Recipient phone/email logged for audit trail
- `sentVia: 'api'` indicates reliable delivery

### ✅ For Manual Sends
- User can record after sharing manually
- System doesn't lose track of manual deliveries
- Timestamp and who-sent-it still tracked
- `sentVia: 'manual_link'` indicates manual/unverified delivery
- Supports any manual delivery method (WhatsApp Web, Email client, SMS, etc.)

### ✅ For Payments
- Payment reminder count auto-increments
- Know exactly how many reminders sent
- Track last reminder time for cooldown logic
- Business rule: No more than 1 reminder per day per invoice (enforced via trigger)

### ✅ For Compliance & Audit
- Every send tracked with timestamp, recipient, sender
- Distinguish between API (verified) and manual (user-recorded) sends
- Full audit trail for customer communications
- Report generation possible: "Show all invoices sent to this customer"

---

## Safety Features

### 1. Cooldown Check (Trigger)

Prevents duplicate sends on the same day:

```sql
-- Trigger: check_invoice_send_cooldown
-- Raises error if trying to send same invoice via same channel twice in one day
```

### 2. Reminder Count Auto-Increment (Trigger)

Automatically increments `payment_reminder_count`:

```sql
-- Trigger: increment_invoice_reminder_count
-- Increments counter when last_reminder_at is updated
```

### 3. Type Safety

All fields have check constraints:
- `whatsapp_sent_via IN ('api', 'manual_link')`
- `email_sent_via IN ('api', 'manual_link')`
- Foreign keys to `users` table for audit trail

---

## Future Enhancements

1. **Delivery Receipts**: When backend API can track read receipts from WhatsApp, add:
   - `whatsapp_read_at`
   - `whatsapp_read_by_phone`

2. **Reply Tracking**: When customer replies, log:
   - `customer_reply_at`
   - `customer_reply_text`

3. **Analytics Dashboard**:
   - Delivery rates by method
   - Time to payment after send/reminder
   - Most effective reminder timing
   - Customer contact preferences

4. **Automation Rules**:
   - Auto-send payment reminder if unpaid after 5 days
   - Auto-send follow-up after 14 days
   - Smart throttling (no more than 2 reminders/week)

---

## Testing

### Test Manual Invoice Send Recording

1. Navigate to Billing → Invoice List
2. Click "Track Delivery" on any unpaid invoice
3. Click "Record WhatsApp Send (Manual Link)"
4. Enter phone: `9876543210`
5. Enter message: `Test invoice - please pay`
6. Click "Record WhatsApp Send"
7. Verify: `whatsapp_sent_at` now shows current timestamp
8. Verify: Display shows "📱 Sent" with timestamp
9. Verify: Database has `whatsapp_sent_via = 'manual_link'`

### Test Payment Reminder

1. Click "Record Payment Reminder" in same modal
2. Verify: `payment_reminder_count` increments to 1
3. Verify: Display shows "🔔 1 Payment Reminder"
4. Click again to increment to 2
5. Verify: Display shows "🔔 2 Payment Reminders"

### Test Cooldown

1. Record WhatsApp send for invoice
2. Try to record another WhatsApp send immediately
3. Should get error: "Invoice was already sent via WhatsApp today..."

---

## Migration

Run migration to add columns:
```bash
supabase migration up --file supabase/migrations/20251218_add_invoice_delivery_tracking.sql
```

Or execute manually in Supabase dashboard SQL editor.

---

## Related Files

- `supabase/migrations/20251218_add_invoice_delivery_tracking.sql` - Database schema
- `supabase/migrations/20251211_add_report_delivery_tracking.sql` - Report tracking (existing)
- `src/utils/supabase.ts` - Database API (lines 3356+)
- `src/components/Billing/InvoiceDeliveryTracker.tsx` - Manual send recording UI
- `src/components/Billing/InvoiceDeliveryStatus.tsx` - Status display component
- `src/components/Dashboard/DashboardOrderModal.tsx` - Uses delivery status indicators
