# Letterhead Background Implementation - generate-pdf-auto-1

## Summary

Successfully implemented a simplified letterhead background approach in `generate-pdf-auto-1` Edge Function, eliminating the need for separate header/footer HTML files.

---

## Changes Made

### 1. **headerFooterHelper.ts** - Simplified

**New Function:**
```typescript
fetchLetterheadBackground(supabase, labId): Promise<string | null>
```

- Fetches letterhead image URL from `lab_branding_assets` table
- Uses `asset_type = 'header'` for letterhead images
- Prefers `imagekit_url` over `file_url` for better performance
- Returns ImageKit URL to be used as full-page background

**Deprecated Functions:**
- `fetchHeaderFooter()` - Now returns `null` (kept for backward compatibility)
- `getDefaultHeaderHTML()` - Returns empty string
- `getDefaultFooterHTML()` - Returns empty string

---

### 2. **index.ts** - Updated Import & Usage

**Import Changed:**
```typescript
// Old
import { fetchHeaderFooter, fetchFrontBackPages } from './headerFooterHelper.ts'

// New
import { fetchLetterheadBackground, fetchFrontBackPages } from './headerFooterHelper.ts'
```

**Fetching Logic Changed:**
```typescript
// Old (lines 2305-2314)
const customHeader = await fetchHeaderFooter(supabaseClient, orderId, 'header')
const customFooter = await fetchHeaderFooter(supabaseClient, orderId, 'footer')
const headerHtml = customHeader || labSettings?.default_report_header_html || ''
const footerHtml = customFooter || labSettings?.default_report_footer_html || ''

// New (lines 2305-2314)
const letterheadBackgroundUrl = await fetchLetterheadBackground(supabaseClient, job.lab_id)
if (letterheadBackgroundUrl) {
  console.log('  ✅ Using letterhead background:', letterheadBackgroundUrl)
} else {
  console.log('  ⚠️ No letterhead background found, using plain layout')
}
```

---

### 3. **buildPdfBodyDocument()** - Enhanced

**Function Signature Updated:**
```typescript
// Old
function buildPdfBodyDocument(bodyHtml: string, customCss: string): string

// New  
function buildPdfBodyDocument(
  bodyHtml: string, 
  customCss: string, 
  letterheadBackgroundUrl?: string | null
): string
```

**New Features:**

#### A. Letterhead Background Styles
```css
@page { margin: 0; }

#page-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 210mm;
  height: 297mm;
  z-index: -100;
  background-image: url('IMAGEKIT_URL');
  background-size: 100% 100%;
  background-repeat: no-repeat;
}
```

#### B. Table Layout for Content Spacing
```html
<table class="report-layout">
  <!-- Header Spacer - Repeats on every page -->
  <thead>
    <tr><td><div class="header-spacer">&nbsp;</div></td></tr>
  </thead>
  
  <!-- Footer Spacer - Repeats on every page -->
  <tfoot>
    <tr><td><div class="footer-spacer">&nbsp;</div></td></tr>
  </tfoot>

  <!-- Main Content -->
  <tbody>
    <tr>
      <td class="content-cell">
        <!-- Report content here -->
      </td>
    </tr>
  </tbody>
</table>
```

**Spacing Configuration:**
```css
.header-spacer { height: 150px; }  /* Adjust based on letterhead design */
.footer-spacer { height: 100px; }  /* Adjust based on letterhead design */
.content-cell { padding: 0 40px; } /* Side margins */
```

---

### 4. **Updated Function Calls**

All three calls to `buildPdfBodyDocument` now pass `letterheadBackgroundUrl`:

```typescript
// Line 3001 - Single template
bodyHtml = buildPdfBodyDocument(
  renderedHtml, 
  (template.gjs_css || '') + '\n' + dynamicCss,
  letterheadBackgroundUrl  // ← Added
)

// Line 3110 - Multi-group
bodyHtml = buildPdfBodyDocument(
  renderedSections.join('\n'), 
  (template.gjs_css || '') + '\n' + dynamicCss,
  letterheadBackgroundUrl  // ← Added
)

// Line 3209 - Print version
printHtml = buildPdfBodyDocument(
  printRenderedHtml, 
  '',
  letterheadBackgroundUrl  // ← Added
)
```

---

## How It Works

### 1. **Database Setup**
Upload letterhead image to `lab_branding_assets`:
```sql
INSERT INTO lab_branding_assets (
  lab_id,
  asset_type,
  asset_name,
  file_url,
  imagekit_url,  -- Preferred
  is_active,
  is_default
) VALUES (
  'lab-uuid',
  'header',  -- Using 'header' type for letterhead
  'Lab Letterhead',
  'https://storage.url/letterhead.jpg',
  'https://ik.imagekit.io/xxx/letterhead.jpg',  -- Better performance
  true,
  true
);
```

### 2. **PDF Generation Flow**
```
1. Fetch letterhead URL from lab_branding_assets
   ↓
2. Build HTML with letterhead as fixed background
   ↓
3. Wrap content in table layout (thead/tfoot for spacing)
   ↓
4. Send to PDF.co with margins: '0mm 0mm 0mm 0mm'
   ↓
5. Background repeats on every page automatically
```

### 3. **Multi-Page Behavior**
- **Fixed background** (`position: fixed`) appears on every page
- **Table thead/tfoot** creates consistent spacing on all pages
- **Content flows** naturally between pages
- **No manual page break management** needed

---

## Benefits

### ✅ Simpler Architecture
- **1 image** instead of 2 HTML files (header + footer)
- **No HTML complexity** - just upload an image
- **Easier to maintain** - update one file instead of two

### ✅ Better Performance
- **ImageKit CDN** for fast loading
- **Single HTTP request** instead of multiple
- **Cached efficiently** by browsers and PDF.co
- **No base64 conversion** - PDF.co fetches images directly from URLs
- **Faster Edge Function execution** - eliminated unnecessary encoding step

### ✅ Design Flexibility
- **Full-page design** control
- **Pixel-perfect** letterhead placement
- **No alignment issues** between header/footer

### ✅ Consistent Rendering
- **Same background** on all pages automatically
- **No page break artifacts**
- **Professional appearance**

---

## Performance Optimizations

### Removed Base64 Conversion
Previously, the function converted all images to base64 before sending to PDF.co. This has been **removed** because:

1. **PDF.co can fetch images directly** from URLs
2. **ImageKit URLs are fast** and reliable
3. **Reduces Edge Function execution time** significantly
4. **Smaller payload** sent to PDF.co API
5. **Better caching** - images cached by PDF.co

**Before:**
```typescript
// Old approach - slow
const processedBody = await convertHtmlImagesToBase64(bodyHtml)  // ❌ Unnecessary
```

**After:**
```typescript
// New approach - fast
const processedBody = bodyHtml  // ✅ Direct URLs
```

---

## Configuration

### Adjusting Spacing

Edit in `buildPdfBodyDocument()`:

```css
/* Increase/decrease based on your letterhead design */
.header-spacer { height: 150px; }  /* Top margin */
.footer-spacer { height: 100px; }  /* Bottom margin */
.content-cell { padding: 0 40px; } /* Side margins */
```

### Testing

1. Upload letterhead image to `lab_branding_assets`
2. Set `asset_type = 'header'` and `is_default = true`
3. Generate a report
4. Check spacing - adjust `.header-spacer` and `.footer-spacer` as needed

---

## Comparison with Old Approach

| Feature | Old (Header/Footer HTML) | New (Letterhead Background) |
|---------|-------------------------|----------------------------|
| **Files Needed** | 2 (header.html + footer.html) | 1 (letterhead image) |
| **Complexity** | High (HTML/CSS for both) | Low (just upload image) |
| **Alignment** | Can have issues | Perfect (single image) |
| **Performance** | 2+ HTTP requests | 1 HTTP request |
| **CDN Support** | Limited | ✅ ImageKit optimized |
| **Multi-page** | Complex positioning | ✅ Automatic |
| **Maintenance** | Update 2 files | Update 1 file |

---

## Next Steps

1. **Test with real letterhead** - Upload actual lab letterhead
2. **Adjust spacing** - Fine-tune header/footer spacers
3. **Deploy** - `npx supabase functions deploy generate-pdf-auto-1`
4. **Monitor** - Check PDF output quality
5. **Optimize** - Adjust ImageKit transformations if needed

---

## Files Modified

1. `supabase/functions/generate-pdf-auto-1/headerFooterHelper.ts` - Simplified
2. `supabase/functions/generate-pdf-auto-1/index.ts` - Updated imports and calls

## Inspiration

Based on `test-pdfco-direct.js` approach:
- Fixed background with `position: fixed`
- Table layout with `thead`/`tfoot` for repeating spacers
- Zero margins (`@page { margin: 0; }`)
- Full-bleed background image

---

**Status:** ✅ Ready for testing and deployment
