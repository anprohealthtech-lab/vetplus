# TRF Auto-Extract - Quick Setup

## Single Command Deployment

```powershell
# 1. Set the Google API key (works for both Vision and Gemini)
supabase secrets set ALLGOOGLE_KEY="AIzaSy_YOUR_GOOGLE_API_KEY"

# 2. Deploy the Edge Function
supabase functions deploy process-trf

# 3. Test it
curl -X POST https://your-project.supabase.co/functions/v1/process-trf \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"attachmentId": "test-uuid"}'
```

## Get Your Google API Key

1. Go to: https://console.cloud.google.com
2. Enable **Cloud Vision API**
3. Enable **Generative Language API** (for Gemini)
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy the key: `AIzaSy...`
6. Use this ONE key for both services ✓

## Verify Deployment

```powershell
# Check if secret is set
supabase secrets list
# Should show: ALLGOOGLE_KEY

# Check function is deployed
supabase functions list
# Should show: process-trf
```

## Test in Browser

1. Open LIMS app
2. Click "Create New Order"
3. Upload TRF image (JPG/PNG/PDF)
4. Watch auto-processing (6-12 seconds)
5. Review extracted data in modal
6. Verify form auto-filled correctly

## Troubleshooting

### "ALLGOOGLE_KEY not configured"
```bash
supabase secrets set ALLGOOGLE_KEY="your-key"
supabase functions deploy process-trf
```

### "Vision API failed: 403 Forbidden"
- Enable Cloud Vision API in Google Cloud Console
- Check API key is valid
- Verify billing is enabled

### "Gemini API failed"
- Enable Generative Language API
- Same key works for both APIs
- Check quota limits

## API Quotas

- **Vision API**: 1,000 free requests/month
- **Gemini API**: 15 requests/minute, 1,500/day (free)
- **Cost per TRF**: ~$0.0015 after free tier

## Next Steps

1. ✅ Deploy Edge Function
2. ✅ Set ALLGOOGLE_KEY
3. ✅ Test with sample TRF
4. ✅ Train users on TRF upload
5. ✅ Monitor usage in Google Cloud Console

---

**Last Updated**: November 9, 2025
