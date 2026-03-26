# PDF Auto-Generation Webhook Setup

This guide explains how to automatically generate PDFs when all test groups for an order are approved.

## How It Works

1. **User approves test group** → `verify_result()` RPC updates `results.verification_status = 'verified'`
2. **Database trigger fires** → `trigger_queue_pdf_on_approval` checks if ALL results are verified
3. **Job queued** → If all verified, inserts into `pdf_generation_queue` with status `pending`
4. **Webhook fires** → `trigger_invoke_pdf_on_queue` calls edge function via `pg_net`
5. **PDF generated** → `generate-pdf-letterhead` creates and uploads PDF

## Setup Steps

### Step 1: Enable pg_net Extension

Run in Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
```

### Step 2: Store Secrets in Vault

Run in Supabase SQL Editor (replace with your actual values):

```sql
-- Store your Supabase project URL
SELECT vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co', 
  'SUPABASE_URL'
);

-- Store your Service Role Key (find in Supabase Dashboard > Settings > API)
SELECT vault.create_secret(
  'YOUR_SERVICE_ROLE_KEY_HERE', 
  'SUPABASE_SERVICE_ROLE_KEY'
);
```

> ⚠️ **IMPORTANT**: Never expose your service role key in client-side code!

### Step 3: Apply the Migration

Run the migration file: `db/migrations/20260119000001_pdf_queue_auto_invoke.sql`

```bash
# Using Supabase CLI
supabase db push

# Or manually copy/paste the SQL into Supabase SQL Editor
```

### Step 4: Verify Setup

Test that the webhook works:

```sql
-- 1. Check vault secrets are stored
SELECT name FROM vault.secrets WHERE name IN ('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');

-- 2. Check trigger exists
SELECT tgname, tgrelid::regclass 
FROM pg_trigger 
WHERE tgname = 'trigger_invoke_pdf_on_queue';

-- 3. Check pg_net is working (test HTTP call)
SELECT net.http_post(
  url := 'https://httpbin.org/post',
  body := '{"test": "hello"}'::jsonb
);
```

## Troubleshooting

### Webhook Not Firing

1. **Check pg_net is enabled:**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_net';
   ```

2. **Check vault secrets exist:**
   ```sql
   SELECT name FROM vault.decrypted_secrets 
   WHERE name IN ('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
   ```

3. **Check trigger function logs:**
   ```sql
   -- Enable notices for debugging
   SET client_min_messages = 'notice';
   
   -- Then approve a result and check logs
   ```

### PDF Generation Fails

1. **Check queue status:**
   ```sql
   SELECT id, order_id, status, error_message, progress_stage 
   FROM pdf_generation_queue 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

2. **Check edge function logs in Supabase Dashboard:**
   - Go to Edge Functions > generate-pdf-letterhead > Logs

3. **Manual retry:**
   ```sql
   SELECT retry_pdf_job('JOB_ID_HERE');
   ```

## Alternative: Dashboard Webhook (No pg_net)

If pg_net is not available, you can use Supabase Dashboard to create a Database Webhook:

1. Go to **Database** > **Webhooks**
2. Click **Create a new hook**
3. Configure:
   - **Name**: `pdf-generation-webhook`
   - **Table**: `pdf_generation_queue`
   - **Events**: `INSERT`
   - **Type**: `Supabase Edge Functions`
   - **Edge Function**: `generate-pdf-letterhead`
   - **HTTP Headers**: 
     ```json
     {
       "Content-Type": "application/json"
     }
     ```

4. The webhook payload will include the inserted row data. You may need to modify the edge function to accept `record.order_id` from webhook payload.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        APPROVAL FLOW                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User clicks "Approve" in ResultsVerification                         │
│     │                                                                    │
│     ▼                                                                    │
│  2. supabase.rpc('verify_result', { action: 'approve' })                │
│     │                                                                    │
│     ▼                                                                    │
│  3. UPDATE results SET verification_status = 'verified'                  │
│     │                                                                    │
│     ▼                                                                    │
│  4. TRIGGER: trigger_queue_pdf_on_approval                              │
│     │                                                                    │
│     ├──► Check: Are ALL results for this order verified?                │
│     │    │                                                               │
│     │    ├── NO  → Do nothing (wait for more test groups)               │
│     │    │                                                               │
│     │    └── YES → INSERT INTO pdf_generation_queue (status='pending')  │
│     │              │                                                     │
│     │              ▼                                                     │
│     │         5. TRIGGER: trigger_invoke_pdf_on_queue                   │
│     │              │                                                     │
│     │              ▼                                                     │
│     │         6. net.http_post() → Edge Function                        │
│     │              │                                                     │
│     │              ▼                                                     │
│     │         7. generate-pdf-letterhead processes                      │
│     │              │                                                     │
│     │              ▼                                                     │
│     │         8. PDF uploaded to Storage                                │
│     │              │                                                     │
│     │              ▼                                                     │
│     │         9. Queue status updated to 'completed'                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Testing the Full Flow

1. Create an order with multiple test groups
2. Enter results for all test groups
3. Approve test groups one by one
4. After the LAST test group is approved:
   - Check `pdf_generation_queue` for new job
   - Check edge function logs
   - Check `orders.report_generation_status`
   - PDF should appear in Storage bucket

```sql
-- Monitor the queue
SELECT 
  pq.order_id,
  pq.status,
  pq.progress_stage,
  pq.progress_percent,
  pq.created_at,
  o.report_generation_status
FROM pdf_generation_queue pq
JOIN orders o ON o.id = pq.order_id
ORDER BY pq.created_at DESC
LIMIT 5;
```
