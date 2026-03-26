# PDF E-Copy & Print Report Generation Logic

## Overview

This document outlines the complete flow of how E-Copy (electronic) and Print PDF reports are generated in the LIMS v2 system, including all fields fetched, headers/footers, and the differences between the two versions.

---

## 1. PDF Generation Pipeline

### Entry Point
The main function is `generateAndSavePDFReportWithProgress()` in `src/utils/pdfService.ts`.

### Generation Flow
```
1. Check Authentication
2. Check/Create Report Record
3. Build Report Template Context (via Netlify Function)
4. Prepare HTML (prepareReportHtml)
5. Try Puppeteer (5s timeout) → Fallback to PDF.co
6. Generate E-Copy PDF
7. Generate Print PDF (parallel)
8. Upload to Supabase Storage
9. Update Database with URLs
```

---

## 2. Data Fetching - Template Context

### Source: Netlify Function `get-template-context.js`
Calls Supabase RPC function: `get_report_template_context(p_order_id)`

### Fields Fetched (ReportTemplateContext)

#### Patient Information (`context.patient`)
| Field | Source Table | Description |
|-------|-------------|-------------|
| `name` | `patients.name` | Patient full name |
| `displayId` | `patients.display_id` | Patient ID (e.g., PTX100256) |
| `age` | Calculated from `patients.date_of_birth` | Age in years |
| `gender` | `patients.gender` | Male/Female/Other |
| `phone` | `patients.phone` | Contact number |
| `dateOfBirth` | `patients.date_of_birth` | DOB |
| `registrationDate` | `patients.created_at` | Registration date |

#### Order Information (`context.order`)
| Field | Source Table | Description |
|-------|-------------|-------------|
| `sampleCollectedAt` | `orders.sample_collected_at` | Sample collection timestamp |
| `sampleCollectedBy` | `orders.sample_collected_by` | Phlebotomist name |
| `sampleId` | `orders.sample_id` | Auto-generated sample ID |
| `locationId` | `orders.location_id` | Collection location UUID |
| `locationName` | `locations.name` (via join) | Location display name |
| `referringDoctorId` | `orders.doctor` | Doctor UUID |
| `referringDoctorName` | `doctors.name` (via join) | Doctor display name |
| `approvedAt` | `orders.approved_at` | Result approval timestamp |

#### Order Metadata (`context.meta`)
| Field | Source Table | Description |
|-------|-------------|-------------|
| `orderNumber` | `orders.id` | Order UUID |
| `orderDate` | `orders.created_at` | Order creation date |
| `status` | `orders.status` | Current order status |
| `totalAmount` | `orders.total_amount` | Order total |
| `createdAt` | `orders.created_at` | Creation timestamp |
| `allAnalytesApproved` | Calculated | All results approved? |

#### Test Results (`context.analytes`)
Array of analyte rows from `result_values` joined with `analytes`:
| Field | Source | Description |
|-------|--------|-------------|
| `result_id` | `results.id` | Result record ID |
| `analyte_id` | `analytes.id` | Analyte UUID |
| `parameter` | `analytes.name` | Analyte name (e.g., Hemoglobin) |
| `value` | `result_values.value` | Test result value |
| `unit` | `analytes.unit` | Unit (e.g., g/dL) |
| `reference_range` | `analytes.reference_range` | Normal range |
| `flag` | `result_values.flag` | H/L/C/N flag |
| `verify_status` | `result_values.verify_status` | approved/pending |
| `test_name` | `test_groups.name` | Test group name |
| `test_group_id` | `test_groups.id` | Test group UUID |

#### Lab Branding (`context.labBranding`)
| Field | Source Table | Description |
|-------|-------------|-------------|
| `defaultHeaderHtml` | `labs.default_report_header_html` | HTML header template |
| `defaultFooterHtml` | `labs.default_report_footer_html` | HTML footer template |

#### Additional Context Fields
| Field | Description |
|-------|-------------|
| `orderId` | Current order UUID |
| `patientId` | Patient UUID |
| `labId` | Lab UUID |
| `testGroupIds` | Array of test group UUIDs in this order |
| `analyteParameters` | Array of analyte names |
| `placeholderValues` | Custom placeholder overrides |

---

## 3. Header & Footer Fetching

### Source: `labs` Table
```sql
SELECT default_report_header_html, default_report_footer_html
FROM labs
WHERE id = {lab_id}
```

### Header/Footer Processing
1. **Fetch raw HTML** from `labs` table
2. **Convert images to Base64** via `convertHtmlImagestoBase64()`
3. **Pass to PDF.co/Puppeteer** as header/footer parameters

### E-Copy PDF Header/Footer
```javascript
// In generatePDFWithAPI():
{
  displayHeaderFooter: true,
  headerHtml: headerHtml,      // From labs.default_report_header_html
  footerHtml: footerHtml,      // From labs.default_report_footer_html
  headerHeight: '90px',
  footerHeight: '80px',
  mediaType: 'screen',
  printBackground: true,
}
```

### Print PDF Header/Footer
```javascript
// In generatePrintPDFWithAPI():
{
  headerHtml: '',              // EMPTY - Uses physical letterhead
  footerHtml: '',              // EMPTY - Uses physical letterhead
  mediaType: 'print',
  printBackground: false,      // No backgrounds
  displayHeaderFooter: false,  // No Chrome header/footer
  margins: '40px 20px 40px 20px',
}
```

---

## 4. Report Extras (Trend Graphs & Clinical Summary)

### Source: `getReportExtrasForOrder()` in `reportExtrasService.ts`

### Data Sources Checked:
1. **`orders.trend_graph_data`** - Trend graphs from TrendGraphPanel
2. **`reports.ai_doctor_summary`** - AI-generated clinical summary
3. **`results.report_extras`** - Legacy per-result extras

### Trend Graph Data Structure (`orders.trend_graph_data`)
```typescript
{
  analytes: [
    {
      analyte_id: string,
      analyte_name: string,        // e.g., "Hemoglobin"
      unit: string,                // e.g., "g/dL"
      reference_range: { min: number, max: number },
      dataPoints: [
        { date: string, value: number, flag?: string }
      ],
      trend: string,               // "improving" | "stable" | "declining"
      image_url?: string,          // Pre-generated PNG URL
      image_generated_at?: string
    }
  ],
  include_in_report: boolean,      // User checkbox
  include_summary_in_report?: boolean,
  images_generated_at?: string
}
```

### Clinical Summary Data Structure
```typescript
{
  text: string,                    // Summary text
  recommendation?: string,         // Doctor recommendation
  generated_at: string,            // ISO timestamp
  generated_by: 'ai' | 'manual'
}
```

---

## 5. E-Copy vs Print PDF Differences

| Feature | E-Copy PDF | Print PDF |
|---------|-----------|-----------|
| **Header/Footer** | Lab branding HTML | EMPTY (physical letterhead) |
| **Header Height** | 90px | N/A |
| **Footer Height** | 80px | N/A |
| **Media Type** | `screen` | `print` |
| **Print Background** | `true` (colors) | `false` (no backgrounds) |
| **Display Header/Footer** | `true` | `false` |
| **Margins** | Default | `40px 20px 40px 20px` |
| **Trend Graphs** | Colored SVG/PNG | Grayscale or Table |
| **Clinical Summary** | Colored styling | Black & white |
| **Filename Suffix** | None | `_PRINT` |

### Print-Specific Styling (`forPrint=true`)
```typescript
// In prepareReportHtml():
const printPreparedHtml = await prepareReportHtml(reportData, isDraft, allTemplates, true);

// Passes forPrint=true to:
// - generateReportExtrasHtml(extras, true)
// - generateTrendSectionHtml(trends, true)
// - generateClinicalSummaryHtmlPrint()
```

---

## 6. HTML Preparation Flow

### Function: `prepareReportHtml(reportData, isDraft, allTemplates, forPrint)`

```
1. Build filename base (Patient_OrderID_DRAFT.pdf)
2. Resolve branding defaults
3. Check for multi-template mode
   - If multiple test groups: renderMultipleTestGroupTemplates()
   - If single: renderLabTemplateHtmlBundle()
   - Fallback: generateUniversalHTMLTemplate()
4. Inject watermark if enabled (injectWatermarkIfEnabled)
5. Inject report extras (trend graphs, clinical summary)
6. Return PreparedReportHtml object
```

### PreparedReportHtml Structure
```typescript
interface PreparedReportHtml {
  html: string;           // Complete HTML document
  bundle: object | null;  // GrapesJS bundle data
  filenameBase: string;   // e.g., "John_Doe_abc123"
  brandingDefaults: LabBrandingHtmlDefaults;
}
```

---

## 7. PDF.co API Request

### Request Payload
```javascript
{
  name: filename,              // "Patient_OrderID.pdf"
  html: htmlContent,           // Full HTML document
  async: true,                 // Async job processing
  margins: '40px 20px 40px 20px',
  paperSize: 'A4',
  orientation: 'portrait',
  printBackground: true/false,
  scale: 1.0,
  mediaType: 'print' | 'screen',
  displayHeaderFooter: true/false,
  header: headerHtml,          // Base64 images converted
  footer: footerHtml,          // Base64 images converted
  headerHeight: '90px',        // Only for E-Copy
  footerHeight: '80px',        // Only for E-Copy
}
```

---

## 8. Template Rendering

### Nunjucks Placeholders Available
```
{{ patientName }}           {{ patientId }}
{{ patientDisplayId }}      {{ age }}
{{ sex }}                   {{ gender }}
{{ dateOfBirth }}           {{ patientPhone }}
{{ sampleId }}              {{ sampleCollectedAt }}
{{ sampleCollectedBy }}     {{ locationName }}
{{ referringDoctorName }}   {{ doctorName }}
{{ orderNumber }}           {{ orderDate }}
{{ orderStatus }}           {{ reportDate }}
{{ approvedAt }}            {{ totalAmount }}
{{ labId }}                 {{ orderId }}
{{ allAnalytesApproved }}
```

### Test Results Loop
```html
{% for result in testResults %}
  {{ result.parameter }}
  {{ result.result }}
  {{ result.unit }}
  {{ result.referenceRange }}
  {{ result.flag }}
{% endfor %}
```

---

## 9. Storage & Database Updates

### PDF Storage Location
- **Bucket**: `reports` (Supabase Storage)
- **Filename Pattern**: `{orderId}_{timestamp}.pdf` or `{orderId}_{timestamp}_print.pdf`

### Database Updates
```sql
-- E-Copy PDF (reports table)
UPDATE reports SET
  pdf_url = '{publicUrl}',
  pdf_generated_at = NOW(),
  status = 'completed',
  report_type = 'final',
  report_status = 'completed'
WHERE order_id = '{orderId}';

-- Print PDF (reports table)
UPDATE reports SET
  print_pdf_url = '{publicUrl}',
  print_pdf_generated_at = NOW()
WHERE order_id = '{orderId}';
```

---

## 10. Error Handling & Fallbacks

### Generation Strategy
```
1. Try Puppeteer (5s timeout)
   ↓ (on failure)
2. Fallback to PDF.co API
   ↓ (on failure)
3. Browser print fallback (last resort)
```

### Puppeteer Warmup
```javascript
// In App.tsx on mount:
useEffect(() => {
  setTimeout(() => warmupPuppeteer().catch(console.warn), 2000);
}, []);
```

---

## 11. Key Files Reference

| File | Purpose |
|------|---------|
| `src/utils/pdfService.ts` | Main PDF generation orchestration |
| `src/utils/reportExtrasService.ts` | Trend graphs & clinical summary |
| `src/utils/trendChartGenerator.ts` | SVG trend chart generation |
| `src/utils/pdfServicePuppeteer.ts` | Puppeteer-based PDF generation |
| `src/utils/supabase.ts` | Database API & context fetching |
| `netlify/functions/get-template-context.js` | Server-side context builder |

---

## 12. Debug Logging

### Console Logs to Watch
```
📊 Injecting report extras for order {orderId}
📊 Raw trend_graph_data from database: {...}
📄 PDF.co generation request:
  Filename: ...
  Media type: ...
  Display header/footer: ...
🔘 QuickStatusButtons - currentStatus: ...
✅ Puppeteer generation successful: ...
⚡ Generating main and print PDFs in parallel...
```

---

## 13. Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| No header/footer in PDF | `labs.default_report_header_html` is null | Set header HTML in lab settings |
| Trend graphs showing as tables | `image_url` is null | Generate trend images in TrendGraphPanel |
| Print PDF has colors | `forPrint=false` passed | Ensure `prepareReportHtml(..., true)` for print |
| E-Copy missing extras | `include_trends_in_report=false` | Check user checkbox in UI |
| Header images broken | Images not converted to Base64 | Check `convertHtmlImagestoBase64()` |
