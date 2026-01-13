---
description: Implementation Plan for Lab Front/Back Page Branding
---

# Lab Branding - Front & Back Page Implementation

## Objective
Enable labs to upload and configure a default "Front Page" and "Last Page" (Back Page) for their reports. These pages will be automatically fetched and appended to the final PDF report during generation.

## 1. Database Schema Updates
- [x] **Update `lab_branding_assets` check constraint**
    - Modify the `asset_type` check constraint to include `'front_page'` and `'last_page'`.
    - Migration file: `supabase/migrations/20260107_update_branding_asset_types.sql` created.

## 2. Frontend Implementation (React)
- [x] **Update `BrandingAsset` Interface**
    - Added `front_page` and `last_page` to the `asset_type` union in `src/pages/BrandingSettings.tsx`.
- [x] **Update `BrandingAssetCard`**
    - Updated `BrandingAssetSummary` interface in `src/components/Branding/BrandingAssetCard.tsx`.
- [x] **Update `BrandingAssetUploader`**
    - Updated props interface in `src/components/Branding/BrandingAssetUploader.tsx`.
- [x] **Update Branding Settings UI**
    - Added buttons for "Front Page" and "Last Page" in the asset uploader section.
    - Updated icon mapping to use `FileText` icon for these new types.
    - Updated state definitions to support new types.

## 3. Backend Implementation (Edge Function: `generate-pdf-auto`)
### Current Logic
The `generate-pdf-auto` function currently fetches lab details and sets up Puppeteer to render the report.

### Required Changes
1.  **Fetch Branding Assets**:
    - Query `lab_branding_assets` for the specific lab.
    - Filter for `asset_type` IN ('front_page', 'last_page') AND `is_active` = true AND `is_default` = true.
2.  **PDF Composition**:
    - **Front Page**:
        - If a Front Page exists (image URL), generate a full-page HTML container with the image covering the page.
        - Insert this page *before* the main report content.
    - **Last Page**:
        - If a Last Page exists (image URL), generate a full-page HTML container.
        - Insert this page *after* the main report content.
3.  **Handling Page Breaks**:
    - Ensure standard report headers/footers are **suppressed** on these cover pages (using CSS `@page :first` or specific classes).

### Example PDF Generation Flow
```typescript
// 1. Fetch Data
const { frontPage, lastPage } = await getLabBranding(labId);

// 2. Prepare HTML
let finalHtml = '';

if (frontPage) {
  finalHtml += `<div class="front-page" style="page-break-after: always; width: 100vw; height: 100vh; background-image: url('${frontPage.url}'); background-size: cover;"></div>`;
}

finalHtml += mainReportHtml;

if (lastPage) {
  finalHtml += `<div class="last-page" style="page-break-before: always; width: 100vw; height: 100vh; background-image: url('${lastPage.url}'); background-size: cover;"></div>`;
}

// 3. Render PDF
await page.setContent(finalHtml);
```

## 4. Verification
1.  Upload a "Front Page" image in Branding Settings.
2.  Upload a "Last Page" image in Branding Settings.
3.  Generate a test report.
4.  Verify the PDF contains the images as the first and last pages respectively.
5.  Verify standard headers/footers do not overlap (requires CSS adjustment if they do).
