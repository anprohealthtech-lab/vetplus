# Smart Report: Gamma AI + PDF.co Header Overlay Plan

## Current State

### Existing Buttons
| Button | Function | Issues |
|--------|----------|--------|
| **View** | jsPDF client-side preview | Different from final report, no letterhead |
| **Design** | `generate-pdf-letterhead` with HTML editor | ✅ Good - uses server-side generation |
| **Download Final** | `generate-pdf-letterhead` | ✅ Good - full pipeline |
| **Smart** | Gamma AI direct generation | ❌ No lab branding/letterhead |

### Problem with Smart Report
- Gamma AI generates beautiful presentations but **no letterhead**
- Lab branding (header/footer images) are NOT applied
- Output is a Gamma-branded PDF, not lab-branded

---

## Proposed Solution: Hybrid Gamma + PDF.co Pipeline

### Flow
```
1. Generate HTML content (existing)
   ↓
2. Call Gamma AI → Get beautiful base PDF
   ↓
3. Call PDF.co /pdf/edit/add → Overlay letterhead background
   ↓
4. Upload final PDF to Storage
   ↓
5. Return branded Smart Report
```

### PDF.co Endpoints for Editing

#### Option A: Add Background Image
```
POST https://api.pdf.co/v1/pdf/edit/add
{
  "url": "gamma_output.pdf",
  "images": [{
    "url": "letterhead_background.png",
    "x": 0,
    "y": 0,
    "width": 595,  // A4 width in points
    "height": 842, // A4 height in points
    "pages": "0-"  // All pages
  }],
  "name": "branded_report.pdf"
}
```

#### Option B: Merge with Template PDF
```
POST https://api.pdf.co/v1/pdf/merge2
{
  "url": "letterhead_template.pdf",  // Single page with header/footer
  "url2": "gamma_output.pdf",
  "name": "merged_report.pdf"
}
```

#### Option C: Add Header/Footer Text (simpler)
```
POST https://api.pdf.co/v1/pdf/edit/add
{
  "url": "gamma_output.pdf",
  "images": [
    {
      "url": "header_image.png",
      "x": 0, "y": 0,
      "width": 595, "height": 100,
      "pages": "0-"
    },
    {
      "url": "footer_image.png", 
      "x": 0, "y": 742,
      "width": 595, "height": 100,
      "pages": "0-"
    }
  ]
}
```

---

## Implementation Plan

### Step 1: Create New Edge Function `generate-smart-report-branded`

```typescript
// supabase/functions/generate-smart-report-branded/index.ts

async function handler(req) {
  const { orderId } = await req.json();
  
  // 1. Get HTML content
  const htmlResponse = await fetch(SUPABASE_URL + '/functions/v1/create-html-preview', {
    body: JSON.stringify({ orderId })
  });
  const { html } = await htmlResponse.json();
  
  // 2. Generate via Gamma
  const gammaResult = await generateWithGamma(html);
  const gammaPdfUrl = gammaResult.exportUrl;
  
  // 3. Get lab branding
  const { data: order } = await supabase.from('orders').select('lab_id').eq('id', orderId).single();
  const { data: assets } = await supabase
    .from('lab_branding_assets')
    .select('*')
    .eq('lab_id', order.lab_id)
    .eq('is_default', true);
  
  const headerAsset = assets.find(a => a.asset_type === 'header');
  const footerAsset = assets.find(a => a.asset_type === 'footer');
  
  // 4. Overlay branding via PDF.co
  const brandedPdf = await overlayBranding(gammaPdfUrl, headerAsset?.file_url, footerAsset?.file_url);
  
  // 5. Upload to Storage
  const { publicUrl } = await uploadToStorage(brandedPdf, orderId);
  
  return { success: true, pdfUrl: publicUrl };
}

async function overlayBranding(pdfUrl, headerUrl, footerUrl) {
  const images = [];
  
  if (headerUrl) {
    images.push({
      url: headerUrl,
      x: 0, y: 0,
      width: 595, height: 90,
      pages: "0-"
    });
  }
  
  if (footerUrl) {
    images.push({
      url: footerUrl,
      x: 0, y: 752,
      width: 595, height: 90,
      pages: "0-"
    });
  }
  
  const response = await fetch('https://api.pdf.co/v1/pdf/edit/add', {
    method: 'POST',
    headers: {
      'x-api-key': PDFCO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: pdfUrl,
      images,
      name: `smart_report_branded.pdf`
    })
  });
  
  const result = await response.json();
  return result.url;
}
```

### Step 2: Update UI Button

```tsx
// In Reports.tsx, update handleSmartReport

const handleSmartReport = async (orderId: string) => {
  try {
    setSmartReportLoadingId(orderId);

    // Use new branded endpoint
    const { data, error } = await supabase.functions.invoke('generate-smart-report-branded', {
      body: { orderId }
    });

    if (error) throw error;

    if (data?.pdfUrl) {
      window.open(data.pdfUrl, '_blank');
    }
  } catch (error) {
    console.error('Smart report failed:', error);
    alert('Failed: ' + error.message);
  } finally {
    setSmartReportLoadingId(null);
  }
};
```

---

## Alternative: Simpler Approach

Instead of Gamma, enhance the existing `generate-pdf-letterhead` with AI-powered styling:

### Option: AI-Enhanced HTML Generation

1. Use **Gemini/Claude** to enhance the HTML template with better styling
2. Keep using PDF.co for conversion (already has letterhead support)
3. Add "Smart" styling via AI prompt:

```typescript
const enhanceWithAI = async (html: string) => {
  const prompt = `
    Enhance this medical report HTML with:
    - Modern, clean styling
    - Better typography
    - Visual hierarchy
    - Subtle colors for sections
    - Professional medical report aesthetics
    
    Keep all data intact. Return only the enhanced HTML.
  `;
  
  const enhanced = await gemini.generateContent(prompt + html);
  return enhanced;
};
```

---

## Comparison

| Approach | Pros | Cons |
|----------|------|------|
| **Gamma + PDF.co Overlay** | Beautiful AI designs, unique layouts | Extra API call, potential alignment issues |
| **AI-Enhanced HTML + PDF.co** | Single pipeline, consistent letterhead | Less creative than Gamma |
| **Current Gamma** | Quick, beautiful | No lab branding |

---

## Recommendation

**Phase 1 (Quick Win):** Fix the Smart button to use `generate-smart-report-branded` with PDF.co overlay

**Phase 2 (Better):** Create AI-enhanced template option in `generate-pdf-letterhead` using Gemini to improve HTML styling before PDF conversion

---

## View Button Fix

The View button should show the same output as Download. Options:

1. **Call `generate-pdf-letterhead` with `isDraft: true`** - generates actual PDF but marked as draft
2. **Keep jsPDF for speed** but accept it's a "preview" not final

Recommendation: Add a "Quick Preview" label and keep jsPDF for speed, but clarify it's not the final format.
