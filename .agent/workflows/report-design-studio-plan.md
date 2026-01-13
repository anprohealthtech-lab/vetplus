---
description: Implementation Plan for Live Report Design Studio & Workflow Optimization
---

# Report Design Studio & Workflow Optimization Plan

This plan outlines the roadmap for implementing a **Live Print Preview & Customization Studio** for lab reports, enabling users to tweak report designs (headers, footers, branding) in real-time before PDF generation. It also covers the transition to a Dashboard-centric workflow by hiding legacy order creation buttons.

## 1. Feature Overview

### Current State
- Reports are auto-generated via background Edge Functions when an order is completed.
- Users have little control over the final look without changing global templates.
- Order creation is split between "Orders Page" and "Dashboard".

### Target State
- **Hybrid Workflow:** Users can choose between **"Auto-Generate"** (existing fast flow) and **"Design Studio"** (manual customization).
- **Design Studio:** A visual React-based interface to swap headers, footers, add badges (NABL, ISO), and edit text on a live A4 canvas.
- **Unified Action:** Order creation and test management are consolidated in the Dashboard. Legacy buttons on the Orders page will be hidden.

---

## 2. Database Schema Updates

To support the hybrid workflow, we need a flag to toggle auto-generation preference.

### Table: `labs` (or `lab_settings`)
- Add column: `report_auto_generate` (boolean, default: `true`).
  - `true`: System generates PDF automatically upon result verification/completion.
  - `false`: System waits for user to manually click "Generate" or opens the Studio first.

---

## 3. Component Architecture

### A. `<ReportDesignStudio />` (New Modal Component)
The core workspace for report customization.
- **Props:** `orderId`, `initialConfig`
- **Layout:**
  - **Left Sidebar (Controls):** 
    - `HeaderSelector`: Dropdown for "Main Header", "B2B Header".
    - `FooterSelector`: Dropdown for footers.
    - `AssetManager`: Toggles for "NABL Logo", "ISO Badge", "Signature".
    - `ThemeColor`: Picker for table header colors.
  - **Main Area (Live Preview):**
    - Renders the report specifically sized for A4 (210mm x 297mm).
    - Uses CSS Print media queries simulation.

### B. `<LiveReportPreview />`
A unified presentation component used by both the Studio (screen) and the PDF Generator (server/puppeteer).
- This ensures "What You See Is What You Get".
- Uses pure CSS Grid/Flexbox for A4 layout.

---

## 4. Integration Workflow

### Step 1: Triggering Generation
Modify the "Generate Report" action in `Dashboard.tsx`/`DashboardOrderModal.tsx`.

```typescript
const handleGenerateReport = async () => {
   const { auto_generate } = await getLabSettings();
   
   if (auto_generate) {
      // 1. Existing flow: Trigger background job
      await api.reports.generate(orderId);
   } else {
      // 2. New flow: Open Studio
      setShowDesignStudio(true);
   }
}
```

### Step 2: The Studio Design Flow
1. User opens Studio.
2. React fetches Order Data + Branding Assets.
3. User tweaks the design (e.g., changes header). State updates `previewConfig`.
4. User clicks **"Save & Generate"**.

### Step 3: Backend Processing
The `ReportDesignStudio` generates the final **HTML String** of the report (using `ReactDOMServer.renderToStaticMarkup` or similar) to capture the exact visual state.
- It sends this HTML payload to the `generate-pdf` Edge Function.
- The Edge Function skips database template lookup and uses the provided HTML.
- PDF is generated via PDF.co and stored in Supabase Storage.

---

## 5. UI Cleanup (Hiding Legacy Buttons)

To consolidate workflows, we will hide (not delete) buttons in `src/pages/EnhancedOrdersPage.tsx`.

### Target Elements:
1.  **"New Order" Button** (Header)
    - *Action:* Wrap in `false && (...)`.
2.  **"Add Test" Icon** (Patient Card)
    - *Action:* Wrap in `false && (...)`.
3.  **"Add Test" Button** (Order List)
    - *Action:* Wrap in `false && (...)`.

This forces users to utilize the powerful Dashboard interface for these actions, ensuring a consistent experience.
