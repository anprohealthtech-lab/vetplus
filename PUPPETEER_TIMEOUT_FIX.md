# Puppeteer 5-Second Timeout Fix

## Problem
Puppeteer service was taking too long (60+ seconds) or timing out completely, causing PDF generation to fail. Errors included:
- `Error: Navigating frame was detached` (after 6 seconds)
- `ProtocolError: Target.createTarget timed out` (after 60 seconds)
- Browser becoming unresponsive with multiple concurrent requests

## Solution
Added a **5-second timeout** wrapper around all Puppeteer PDF generation calls using `Promise.race()`. If Puppeteer doesn't respond within 5 seconds, the system immediately falls back to PDF.co.

## Changes Made

### File: `src/utils/pdfService.ts` (lines 2150-2226)

**Before:**
```typescript
const puppeteerUrl = await generatePDFWithPuppeteer({
  orderId,
  html: preparedHtml.html,
  variant: reportType,
  cacheKey: `${orderId}_${reportType}`
});
```

**After:**
```typescript
// ⏱️ 5-second timeout wrapper for Puppeteer
const puppeteerUrl = await Promise.race([
  generatePDFWithPuppeteer({
    orderId,
    html: preparedHtml.html,
    variant: reportType,
    cacheKey: `${orderId}_${reportType}`
  }),
  new Promise<string>((_, reject) => 
    setTimeout(() => reject(new Error('Puppeteer timeout: 5s exceeded')), 5000)
  )
]);
```

**Applied to:**
1. Main PDF generation (final/draft)
2. Print-ready PDF generation

## Expected Behavior

### Scenario 1: Puppeteer Success (< 5 seconds)
```
📊 Active requests: 1
📄 Generating PDF (13705 bytes)
✅ PDF generated in 1819ms
```
✅ Uses Puppeteer (fast, preferred)

### Scenario 2: Puppeteer Timeout (≥ 5 seconds)
```
📊 Active requests: 1
📄 Generating PDF (13705 bytes)
⚠️ Puppeteer generation failed (5001ms), falling back to PDF.co: Error: Puppeteer timeout: 5s exceeded
📊 Retrying with PDF.co...
✅ PDF.co generation successful
```
✅ Automatically falls back to PDF.co

### Scenario 3: Puppeteer Error (< 5 seconds)
```
📊 Active requests: 1
📄 Generating PDF (13705 bytes)
❌ PDF generation failed: Error: Navigating frame was detached (1819ms)
⚠️ Falling back to PDF.co...
✅ PDF.co generation successful
```
✅ Immediately falls back to PDF.co

## Benefits

1. **Fast Failover**: 5-second maximum wait before fallback (vs 60+ seconds before)
2. **Immediate PDF.co Availability**: Users get PDFs even when Puppeteer has issues
3. **No User Impact**: Transparent fallback with progress updates
4. **Error Prevention**: Catches both timeout and crash scenarios

## Configuration

Fallback behavior controlled by `pdfProviderConfig.ts`:
- **Mode**: `'auto'` (try Puppeteer, fallback to PDF.co)
- **Timeout**: `5000ms` (5 seconds)
- **Fallback**: Enabled by default

## Monitoring

Console logs show which path was taken:
```typescript
// Success path
console.log('✅ Puppeteer generation successful:', puppeteerUrl);

// Timeout path
console.warn('⚠️ Puppeteer generation failed (5001ms), falling back to PDF.co:', error);

// Fallback success
console.log('✅ PDF.co generation successful');
```

## Deployment

- **Date**: November 10, 2025
- **Build**: 11.7s
- **Deploy**: 30.9s
- **Status**: ✅ Live
- **URL**: https://eclectic-sunshine-3d25be.netlify.app
- **Unique Deploy**: https://69118b3dda8929fe6d89d77e--eclectic-sunshine-3d25be.netlify.app

## Testing Recommendations

1. **Normal PDF Generation**: Generate a standard report (should use Puppeteer if healthy)
2. **High Load**: Generate multiple PDFs simultaneously (should fallback gracefully)
3. **Puppeteer Down**: Test when Puppeteer service is offline (should use PDF.co)
4. **Print PDF**: Test print-ready PDF generation (has separate 5s timeout)

## Related Files

- `src/utils/pdfService.ts` - Main PDF generation orchestrator
- `src/utils/pdfServicePuppeteer.ts` - Puppeteer PDF generation
- `src/utils/pdfProviderConfig.ts` - Provider configuration
- `src/hooks/usePDFGeneration.ts` - React hook for PDF generation

## Notes

- Timeout applies to **each** PDF generation attempt (main + print)
- Print PDF timeout is non-critical (main PDF still succeeds)
- Fallback requires PDF.co API key in environment variables
- Logs include timing breakdowns for performance analysis
