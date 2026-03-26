# TRF Auto-Extract Deployment Guide

## Prerequisites

1. Google Cloud Project with Vision API enabled
2. Google AI Studio account for Gemini API
3. Supabase project with Edge Functions enabled
4. API keys for both services

## Step-by-Step Deployment

### 1. Get API Keys

#### Google API Key (for both Vision and Gemini)
```bash
# Go to: https://console.cloud.google.com
# Enable Vision API
# Create credentials → API Key
# This same key will work for Gemini API
# Copy: AIzaSy... (your key)
```

**Note**: One API key works for both Google Vision and Gemini APIs.

### 2. Set Supabase Secrets

```powershell
# Navigate to project
cd "d:\LIMS version 2\project"

# Set Google API key (works for both Vision and Gemini)
supabase secrets set ALLGOOGLE_KEY="AIzaSy_YOUR_GOOGLE_KEY"

# Verify secrets
supabase secrets list
```

### 3. Deploy Edge Function

```powershell
# Deploy the process-trf function
supabase functions deploy process-trf

# Expected output:
# Deploying process-trf (project ref: your-project)
# Deployed process-trf (version: 1)
```

### 4. Test Edge Function

```powershell
# Test with sample attachment ID (replace with real ID from DB)
$body = @{
  attachmentId = "your-attachment-uuid"
} | ConvertTo-Json

$response = Invoke-WebRequest `
  -Uri "https://your-project.supabase.co/functions/v1/process-trf" `
  -Method Post `
  -Headers @{
    "Authorization" = "Bearer YOUR_SUPABASE_ANON_KEY"
    "Content-Type" = "application/json"
  } `
  -Body $body

$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### 5. Build and Deploy Frontend

```powershell
# Build React app
npm run build

# Deploy to Netlify
npx netlify deploy --prod
```

### 6. Verify Deployment

#### Check Edge Function Logs
```bash
# In Supabase Dashboard:
# Edge Functions → process-trf → Logs
```

#### Test in Browser
1. Go to your LIMS app
2. Click "Create New Order"
3. Upload a test TRF image
4. Verify processing starts automatically
5. Check review modal shows extracted data

## Environment Variables Checklist

### Supabase Secrets (Edge Function)
- [ ] `ALLGOOGLE_KEY` - Set (used for both Vision and Gemini APIs)
- [ ] `SUPABASE_URL` - Auto-set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Auto-set

### Frontend (.env - if needed)
No additional env vars needed for frontend. The function is called through Supabase client.

## Common Deployment Issues

### Issue 1: "Function not found"
```bash
Solution: Redeploy function
supabase functions deploy process-trf
```

### Issue 2: "API key not valid"
```bash
Solution: Check secret is set
supabase secrets list

If missing, set again:
supabase secrets set ALLGOOGLE_KEY="your-key"
```

### Issue 3: "CORS error"
```typescript
Solution: Already handled in function with corsHeaders
If still occurs, check Supabase project settings
```

### Issue 4: "Timeout"
```typescript
Solution: Edge Functions have 60s timeout
- Reduce image size
- Check API quotas
- Verify network connectivity
```

## API Quota Monitoring

### Google Vision API
- Free tier: 1,000 requests/month
- After: $1.50 per 1,000 requests
- Monitor: https://console.cloud.google.com/apis/dashboard

### Gemini API
- Free tier: 15 requests/minute, 1,500/day
- After: Check pricing at https://ai.google.dev/pricing
- Monitor: Google AI Studio dashboard

## Cost Estimation

### Per TRF Processing
- Vision API: ~$0.0015 (1 request)
- Gemini API: ~$0.00 (free tier)
- Supabase Storage: Negligible
- Supabase Edge Function: Negligible
- **Total per TRF: ~$0.0015**

### Monthly (100 TRFs/day)
- 3,000 TRFs/month
- Vision: ~$4.50/month
- Gemini: Free (within limits)
- **Total: ~$5/month**

## Production Recommendations

1. **Enable Request Logging**
   - Log all TRF processing requests
   - Store extracted data for audit

2. **Add Error Alerting**
   - Sentry/Rollbar integration
   - Email alerts for failures

3. **Implement Rate Limiting**
   - Prevent API quota abuse
   - Queue large batch uploads

4. **Add Usage Analytics**
   - Track confidence scores
   - Monitor match rates
   - Identify improvement areas

5. **Set Up Backup Processing**
   - Fallback to PDF.co if Google APIs fail
   - Manual entry as last resort

## Rollback Plan

If issues occur:

```powershell
# 1. Disable TRF auto-processing in frontend
# Temporarily comment out processTRFImage call in OrderForm.tsx

# 2. Revert Edge Function
supabase functions delete process-trf

# 3. Users can still manually enter order data
# TRF files are still saved as attachments
```

## Next Steps After Deployment

1. **User Training**
   - Create tutorial video
   - Document best practices for TRF photos

2. **Monitor Performance**
   - Track processing times
   - Monitor confidence scores
   - Collect user feedback

3. **Iterative Improvement**
   - Update test name mappings
   - Improve patient matching logic
   - Add custom TRF templates

## Support Contacts

- **Supabase Issues**: support@supabase.io
- **Google Cloud Issues**: cloud.google.com/support
- **LIMS Dev Team**: your-team@example.com

---

**Deployment Date**: ___________
**Deployed By**: ___________
**Verified By**: ___________
