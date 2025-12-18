# AI Embeddings Setup Guide

## Overview

This guide walks you through setting up AI-powered placeholder suggestions for report templates using vector embeddings and semantic search.

## Prerequisites

- ✅ pgvector extension enabled in Supabase
- ✅ `test_catalog_embeddings` table created
- ✅ Google AI API key (for Gemini embeddings - FREE tier available!)
- ✅ Supabase CLI installed

---

## Step 1: Apply Database Migration

Run the vector search function migration:

```bash
# Navigate to project root
cd "d:\LIMS version 2\project"

# Apply migration via Supabase Dashboard
# Go to SQL Editor → New Query → Paste contents of:
# supabase/migrations/20251218_vector_search_function.sql
# → Click Run
```

Or use Supabase CLI:

```bash
supabase db push
```

---

## Step 2: Deploy Edge Functions

### 2.1 Install Supabase CLI (if not already)

```bash
npm install -g supabase
```

### 2.2 Login and Link Project

```bash
supabase login
supabase link --project-ref scqhzbkkradflywariem
```

### 2.3 Deploy Functions

```bash
# Deploy embedding generation function
supabase functions deploy generate-catalog-embeddings

# Deploy AI search function
supabase functions deploy ai-placeholder-search
```

### 2.4 Set Google AI API Key

```bash
supabase secrets set ALLGOOGLE_KEY=your-google-ai-api-key-here
```

**Get your API key from:** https://aistudio.google.com/app/apikey

---

## Step 3: Generate Initial Embeddings

### Option A: Via Admin UI (Recommended)

1. Navigate to: `Settings → AI Embeddings Setup`
2. Click **"Generate Embeddings for All Labs"**
3. Wait for completion (approx 1-2 minutes per 10 labs)
4. Check log for success/error messages

### Option B: Via API Call

```bash
# Get your auth token from browser DevTools (Network tab)
# Or use service role key for testing

curl -X POST \
  'https://scqhzbkkradflywariem.supabase.co/functions/v1/generate-catalog-embeddings' \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "labId": "2f8d0329-d584-4423-91f6-9ab326b700ae"
  }'
```

---

## Step 4: Test AI Placeholder Search

### Test via CURL

```bash
curl -X POST \
  'https://scqhzbkkradflywariem.supabase.co/functions/v1/ai-placeholder-search' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: 'application/json' \
  -d '{
    "userQuery": "add hemoglobin result",
    "labId": "2f8d0329-d584-4423-91f6-9ab326b700ae"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "query": "add hemoglobin result",
  "suggestions": [
    {
      "placeholder": "{{ANALYTE_HB_VALUE}}",
      "displayName": "Hemoglobin (Value)",
      "confidence": 0.92,
      "context": "Part of Complete Blood Count test",
      "category": "hematology",
      "unit": "g/dL",
      "referenceRange": "12.0 - 16.0",
      "insertHtml": "<p>Hemoglobin: {{ANALYTE_HB_VALUE}} g/dL</p>"
    }
  ],
  "count": 1
}
```

---

## Step 5: Bot Integration (DigitalOcean)

### 5.1 Bot Code Example

```typescript
// bot.ts on DigitalOcean
const SUPABASE_URL = 'https://scqhzbkkradflywariem.supabase.co'
const SUPABASE_ANON_KEY = 'your-anon-key' // Safe to use in bot

export async function searchPlaceholders(userQuery: string, labId: string) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/ai-placeholder-search`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userQuery,
        labId,
        matchThreshold: 0.7,
        matchCount: 5,
      }),
    }
  )

  const result = await response.json()
  return result.suggestions
}

// Usage in bot
const suggestions = await searchPlaceholders(
  'show glucose level', 
  'lab-uuid-here'
)

console.log(suggestions)
// Bot can now present these suggestions to user
```

### 5.2 Deploy Bot

```bash
# Example deployment on DigitalOcean
cd your-bot-project
doctl apps create --spec bot.yaml

# Or use GitHub Actions to deploy
```

---

## Verification

### Check Embeddings Table

```sql
-- Count embeddings per lab
SELECT 
  lab_id,
  COUNT(*) as embedding_count,
  COUNT(DISTINCT analyte_id) as unique_analytes,
  COUNT(DISTINCT placeholder_type) as placeholder_types
FROM test_catalog_embeddings
GROUP BY lab_id;

-- Sample embeddings for a lab
SELECT 
  placeholder_name,
  display_name,
  category,
  test_group_name
FROM test_catalog_embeddings
WHERE lab_id = '2f8d0329-d584-4423-91f6-9ab326b700ae'
LIMIT 10;
```

---

## Troubleshooting

### Issue: "ALLGOOGLE_KEY not configured"

**Solution:**
```bash
supabase secrets set ALLGOOGLE_KEY=your-google-ai-api-key
```

Get your key from: https://aistudio.google.com/app/apikey

### Issue: "Function not found"

**Solution:**
```bash
# Redeploy functions
supabase functions deploy generate-catalog-embeddings
supabase functions deploy ai-placeholder-search
```

### Issue: "No analytes found for this lab"

**Solution:**
- Check that lab has analytes in `lab_analytes` table
- Verify lab_id is correct
- Check that analytes are properly linked to test groups

### Issue: "Rate limit exceeded" (Google AI)

**Solution:**
- Free tier: 1,500 requests/day
- Already optimized with 50ms delays between requests
- For production: Upgrade to paid tier ($7/1M requests)
- Embeddings are cached, so this is a one-time setup cost

---

## Cost Analysis

### One-time Setup Cost

- **Embedding Generation**: $0.0001 per 1K tokens (OpenAI ada-002)
- **Average per analyte**: 50 tokens × 6 placeholder types = 300 tokens
- **Cost per lab** (50 analytes): 50 × 300 = 15K tokens = **$0.0015/lab**

**For 100 labs**: ~$0.15 (one-time)

### Ongoing Costs

- **New analyte added**: $0.0001 (automatic via trigger)
- **Search queries**: FREE (local vector search in Supabase)
- **API calls from bot**: FREE (uses Supabase edge functions)

### Monthly Estimate

- **100 labs, 10 new analytes/month**: ~$0.001/month
- **Extremely affordable** for the AI capability

---

## Auto-Population (Future)

To enable automatic embedding generation when labs add new analytes:

```sql
-- Create trigger function
CREATE OR REPLACE FUNCTION trigger_embedding_generation()
RETURNS TRIGGER AS $$
BEGIN
  -- Call edge function async (requires pg_net extension)
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/generate-catalog-embeddings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'labId', NEW.lab_id,
      'analyteId', NEW.analyte_id
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger
CREATE TRIGGER auto_generate_embeddings_on_analyte_add
  AFTER INSERT ON lab_analytes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_embedding_generation();
```

---

## Next Steps

1. ✅ Run migration (vector search function)
2. ✅ Deploy edge functions
3. ✅ Set Google AI API key (`ALLGOOGLE_KEY`)
4. ✅ Generate initial embeddings via Admin UI
5. ✅ Test search endpoint
6. ✅ Integrate with bot on DigitalOcean
7. 🔄 Build CKEditor plugin for autocomplete (Phase 2)
8. 🔄 Add AI chat panel in Template Studio (Phase 3)

---

## Support

For issues or questions:
- Check Supabase edge function logs
- Review Google AI Studio usage: https://aistudio.google.com/
- Verify vector dimensions match (768 for Gemini)
- Test endpoints via CURL first
- Verify lab_id and auth tokens

**Status**: ✅ Ready for implementation
