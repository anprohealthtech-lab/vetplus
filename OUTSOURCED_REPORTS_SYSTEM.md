# Outsourced Reports Management System - Implementation Complete

**Date**: December 8, 2025  
**Status**: ✅ Core Implementation Complete

## Overview

Implemented a comprehensive lab-integrated outsourced reports management system with separate status flows for in-house vs. outsourced tests, intelligent order matching, logistics tracking, and dual PDF merging capabilities.

## What Was Implemented

### 1. Database Schema Enhancements ✅

**File**: `db/migrations/20251208_outsourced_reports_enhancement.sql`

#### New Tables:
- **`lab_outsourcing_settings`**: Lab-level preferences for outsourcing workflows
  - Auto-match configuration (enabled/disabled, confidence threshold, date range)
  - Logistics tracking settings (providers, default TAT, tracking enabled)
  - PDF merge preferences (print/ecopy/both, auto-merge, preserve branding)

#### Enhanced Tables:
- **`results`** table additions:
  - `outsourced_logistics_status`: Separate tracking for logistics (pending_dispatch, awaiting_pickup, in_transit, delivered_to_lab, report_awaited)
  - `tracking_barcode`: Unique barcode for shipment tracking
  - `logistics_notes`: Notes for logistics team
  - `dispatched_at`, `dispatched_by`: Dispatch metadata

- **`reports`** table additions:
  - `merged_print_pdf_url`: URL for merged print version PDF
  - `merged_ecopy_pdf_url`: URL for merged e-copy version PDF
  - `merged_at`: Timestamp of merge operation

- **`outsourced_reports`** table additions:
  - `match_confidence`: Confidence score of order match (0-1)
  - `match_suggestions`: JSON array of suggested order matches
  - `matched_at`, `matched_by`: Match metadata
  - `merge_status`: Track PDF merge progress (pending, in_progress, completed, failed)

#### Indexes:
- Performance indexes on logistics status, tracking barcode, match confidence, merge status

#### Security:
- Row Level Security (RLS) policies for lab-scoped access
- Lab managers can update settings, all users can view

---

### 2. TypeScript Interfaces ✅

**File**: `src/types/index.ts`

Added comprehensive type definitions:

```typescript
interface OutsourcedReport {
  // Core fields + new matching/merge fields
  match_confidence?: number;
  match_suggestions?: OrderMatchSuggestion[];
  merge_status: 'pending' | 'in_progress' | 'completed' | 'failed';
  // ... full interface in file
}

interface OrderMatchSuggestion {
  order_id: string;
  patient_name: string;
  confidence: number;
  match_reasons: string[];
  // ... suggestion details
}

interface LabOutsourcingSettings {
  auto_match: boolean;
  match_confidence_threshold: number;
  merge_mode: 'print_only' | 'ecopy_only' | 'both';
  // ... lab preferences
}

interface OutsourcedTestQueueItem {
  // Queue item for pending dispatch tracking
  outsourced_logistics_status?: string;
  tracking_barcode?: string;
  // ... queue details
}
```

---

### 3. Centralized API Functions ✅

**File**: `src/utils/supabase.ts`

Added `database.outsourcedReports` namespace with full CRUD operations:

#### Key Functions:

**`getAll(filters)`** - Query reports with filters:
```typescript
const { data } = await database.outsourcedReports.getAll({
  status: 'processed',
  matched: 'unmatched',
  dateRange: { start: '2025-12-01', end: '2025-12-31' }
});
```

**`suggestMatches(reportId, maxResults)`** - AI-powered matching:
- Fuzzy patient name matching (exact/partial)
- Test name overlap detection
- Date proximity scoring (±7 days configurable)
- Returns top N matches with confidence scores and reasons

**`linkToOrder(reportId, orderId, patientId, confidence)`** - Link report to order:
- Updates outsourced_reports with order/patient IDs
- Automatically updates results.outsourced_status to 'received'
- Records match metadata (who, when, confidence)

**`updateLogisticsStatus(resultId, status, notes)`** - Track logistics:
- Updates outsourced_logistics_status
- Auto-records dispatch timestamp and user on 'in_transit'

**`getPendingTests(filters)`** - Queue management:
- Returns tests with `outsourced_to_lab_id` set
- Filters by lab, status, includes order/patient data
- Flat structure for easy rendering

**`getLabSettings(labId)`** / **`updateLabSettings(settings)`** - Lab preferences

**`generateTrackingBarcode(resultId)`** - Generate unique barcode:
- Format: `OUT-{timestamp}-{resultId}`

---

### 4. Enhanced UI Components ✅

#### A. **OutsourcedReportsConsoleEnhanced** 
**File**: `src/pages/OutsourcedReportsConsoleEnhanced.tsx`

**Features**:
- **Tab Filters**: All / Pending Processing / Processed / Verified
- **Match Filter**: All / Matched / Unmatched
- **Search**: By email, subject, patient name, file name
- **Date Range**: Filter by received date
- **Smart Stats Cards**: Total, pending, unmatched, verified counts
- **Smart Match Button**: Opens AI-powered match suggestions
- **Match Modal**:
  - Shows top 5 order suggestions with confidence scores
  - Display match reasons (exact name, test overlap, date proximity)
  - One-click linking to orders
- **Report Viewer**: Embedded PDF preview with AI extracted data
- **Confidence Badges**: Color-coded (green ≥80%, yellow ≥50%, red <50%)

#### B. **OutsourcedTestsQueue**
**File**: `src/pages/OutsourcedTestsQueue.tsx`

**Features**:
- **Tabs**: Pending Dispatch / In Transit / Awaiting Report / Overdue
- **Lab Filter**: Filter by outsourced lab
- **Stats Cards**: Total outsourced, pending, in-transit, overdue counts
- **Actions**:
  - **Print Requisition**: Generate PDF requisition with patient info, test details, barcode
  - **Mark as Dispatched**: Generate tracking barcode, update logistics status
- **TAT Tracking**: Visual indicator for days remaining/overdue
- **Overdue Highlighting**: Red background for overdue tests
- **Barcode Display**: Shows tracking number in table

---

## Workflow Tracking Status Separation

### In-House Tests Status Flow:
```
Order Created → Sample Collection → In Progress → Pending Approval → Completed → Delivered
```

### Outsourced Tests Status Flow:
**Main Status** (`results.outsourced_status`):
```
not_outsourced → pending_send → sent → awaiting_report → received → merged
```

**Logistics Tracking** (`results.outsourced_logistics_status`):
```
pending_dispatch → awaiting_pickup → in_transit → delivered_to_lab → report_awaited
```

**Key Differences**:
- In-house: Sample tracking, direct result entry
- Outsourced: Logistics tracking, report receipt, PDF merge
- Both can coexist in same order (hybrid orders)

---

## Smart Matching Algorithm

**Confidence Scoring** (0.0 - 1.0):

| Factor | Points | Condition |
|--------|--------|-----------|
| Exact name match | +0.5 | `patient_name` === `order.patient_name` (case-insensitive) |
| Partial name match | +0.3 | One name contains the other |
| Test name overlap | +0.3 | Outsourced test matches any order test |
| Same day order | +0.2 | Order date within ±1 day |
| Recent order | +0.1 | Order date within ±3 days |

**Default Settings**:
- `auto_match`: `false` (manual approval required)
- `match_confidence_threshold`: `0.8` (80%)
- `match_date_range_days`: `7` (±7 days)

**Auto-Match**: When enabled and confidence ≥ threshold, automatically links report to top suggestion.

---

## PDF Merge Architecture (Ready for Implementation)

### Planned Function Signature:
```typescript
async function mergePDFReports(
  outsourcedPdfUrl: string,
  orderId: string,
  mergeMode: 'print_only' | 'ecopy_only' | 'both'
): Promise<MergedPDFResult>
```

### Merge Strategy:
1. **Generate In-House Report**: 
   - Print version: Full branding, header/footer from `labs.default_report_header_html`
   - E-copy version: Simplified, optimized for digital viewing
2. **Call PDF.co Merge API**: `/pdf/merge` endpoint
   - Outsourced PDF pages (preserves their branding)
   - In-house wrapper pages (cover page, summary)
3. **Store Results**:
   - `reports.merged_print_pdf_url`
   - `reports.merged_ecopy_pdf_url`
   - `reports.merged_at`

### PDF.co API Example:
```javascript
{
  "async": false,
  "name": "merged_report.pdf",
  "url1": "https://outsourced-lab-report.pdf",
  "url2": "https://inhouse-wrapper.pdf",
  "pages": "all,1-5" // Combine all outsourced pages + in-house pages 1-5
}
```

---

## Configuration & Settings

### Lab-Level Settings:

Navigate to: **Settings → Outsourcing Configuration** (to be added to Settings page)

**Matching Settings**:
- ☑️ Enable Auto-Match: Automatically link reports when confidence is high
- 🎯 Confidence Threshold: 0.8 (80%)
- 📅 Date Range: ±7 days

**Logistics Settings**:
- 🚚 Logistics Providers: Add provider names (e.g., "FedEx", "Blue Dart")
- ⏱️ Default TAT: 3 days
- ☑️ Enable Logistics Tracking

**PDF Merge Settings**:
- 📄 Merge Mode: Both print and e-copy
- ☑️ Auto-Merge on Match: Generate merged PDF automatically after linking
- ☑️ Preserve Outsourced Branding: Keep external lab's header/footer

---

## Integration Points

### 1. Order Creation / Test Selection
**Location**: `src/pages/Orders.tsx`, `OrderForm.tsx`

**Action Needed**: When user selects a test with `test_groups.is_outsourced = true`:
```typescript
// In result creation logic:
if (orderTest.outsourced_lab_id) {
  resultData.outsourced_to_lab_id = orderTest.outsourced_lab_id;
  resultData.outsourced_status = 'pending_send';
  resultData.outsourced_logistics_status = 'pending_dispatch';
}
```

### 2. Email Webhook (Already Updated)
**Location**: `netlify/functions/receive-report.ts`

✅ Already extracts `ToFull[0].Email` (correct forwarding email)
✅ Matches to lab via `users.email` or `labs.email`
✅ Stores with `status: 'processed'` after AI extraction

### 3. Sidebar Navigation
**Action Needed**: Add menu items:
```typescript
{
  label: 'Outsourced Reports',
  path: '/outsourced-reports',
  icon: FileText,
  category: 'outsourced'
},
{
  label: 'Outsourced Queue',
  path: '/outsourced-queue',
  icon: TestTube,
  category: 'outsourced'
}
```

### 4. Routes
**Action Needed**: Add to `App.tsx`:
```tsx
<Route path="/outsourced-reports" element={<OutsourcedReportsConsoleEnhanced />} />
<Route path="/outsourced-queue" element={<OutsourcedTestsQueue />} />
```

---

## Testing Checklist

### Database Migration:
- [ ] Run migration: `db/migrations/20251208_outsourced_reports_enhancement.sql`
- [ ] Verify tables created: `lab_outsourcing_settings`
- [ ] Verify columns added to `results`, `reports`, `outsourced_reports`
- [ ] Test RLS policies with different user roles

### API Functions:
- [ ] Test `database.outsourcedReports.getAll()` with filters
- [ ] Test `suggestMatches()` with sample report
- [ ] Test `linkToOrder()` and verify result status update
- [ ] Test `getPendingTests()` with different statuses
- [ ] Test `generateTrackingBarcode()` format

### UI Components:
- [ ] Test OutsourcedReportsConsoleEnhanced filters
- [ ] Test smart match suggestions modal
- [ ] Test order linking workflow
- [ ] Test OutsourcedTestsQueue tabs
- [ ] Test print requisition generation
- [ ] Test mark as dispatched action

### End-to-End Workflow:
1. [ ] Create order with outsourced test
2. [ ] Verify appears in OutsourcedTestsQueue
3. [ ] Mark as dispatched, verify barcode generated
4. [ ] Send test email to webhook
5. [ ] Verify appears in OutsourcedReportsConsoleEnhanced
6. [ ] Test smart match suggestions
7. [ ] Link to order
8. [ ] Verify result status updated to 'received'

---

## Next Steps (Not Yet Implemented)

### Priority 1: PDF Merge Service
- [ ] Implement `mergePDFReports()` function in `src/utils/pdfService.ts`
- [ ] Test PDF.co `/pdf/merge` endpoint
- [ ] Handle print vs. e-copy variants
- [ ] Store merged URLs in reports table

### Priority 2: Settings Page Integration
- [ ] Create `LabOutsourcingSettings` component
- [ ] Add to Settings page under new "Outsourcing" tab
- [ ] Form for all settings (matching, logistics, PDF merge)

### Priority 3: Result Creation Integration
- [ ] Update order processing to set outsourced flags on results
- [ ] Auto-populate TAT estimate based on lab settings

### Priority 4: Billing Integration
- [ ] Add `outsourced_cost` field to `invoice_items`
- [ ] Track external lab costs
- [ ] Calculate margin (patient price - outsourced cost)

### Priority 5: Advanced Features
- [ ] WhatsApp status notifications for logistics
- [ ] Email notifications for overdue tests
- [ ] Analytics dashboard (turnaround time, success rate by lab)
- [ ] Bulk dispatch operations

---

## File Summary

### Created/Modified Files:

1. **Database**:
   - ✅ `db/migrations/20251208_outsourced_reports_enhancement.sql` (NEW)

2. **Types**:
   - ✅ `src/types/index.ts` (MODIFIED - added interfaces)

3. **API**:
   - ✅ `src/utils/supabase.ts` (MODIFIED - added outsourcedReports namespace)

4. **UI Components**:
   - ✅ `src/pages/OutsourcedReportsConsoleEnhanced.tsx` (NEW)
   - ✅ `src/pages/OutsourcedTestsQueue.tsx` (NEW)

5. **Webhook**:
   - ✅ `netlify/functions/receive-report.ts` (MODIFIED - fixed email matching)

6. **Documentation**:
   - ✅ `OUTSOURCED_REPORTS_SYSTEM.md` (THIS FILE)

---

## API Quick Reference

```typescript
// Fetch reports with filters
const { data } = await database.outsourcedReports.getAll({
  status: 'processed',
  matched: 'unmatched',
  dateRange: { start: '2025-12-01', end: '2025-12-31' }
});

// Get smart match suggestions
const { data: suggestions } = await database.outsourcedReports.suggestMatches(reportId, 5);

// Link report to order
await database.outsourcedReports.linkToOrder(reportId, orderId, patientId, 0.85);

// Get pending tests queue
const { data: queue } = await database.outsourcedReports.getPendingTests({
  outsourcedLabId: 'lab-uuid',
  status: 'pending_send'
});

// Update logistics status
await database.outsourcedReports.updateLogisticsStatus(resultId, 'in_transit', 'Shipped via FedEx');

// Generate tracking barcode
const { data } = await database.outsourcedReports.generateTrackingBarcode(resultId);
// Returns: { barcode: 'OUT-1733654400000-abc12345', ...result }

// Get lab settings
const { data: settings } = await database.outsourcedReports.getLabSettings();

// Update lab settings
await database.outsourcedReports.updateLabSettings({
  auto_match: true,
  match_confidence_threshold: 0.85,
  merge_mode: 'both'
});
```

---

## Database Schema Quick Reference

### lab_outsourcing_settings
```sql
id, lab_id, auto_match, match_confidence_threshold, match_date_range_days,
logistics_providers (jsonb), default_tat_days, enable_logistics_tracking,
merge_mode, auto_merge_on_match, preserve_outsourced_branding
```

### results (new columns)
```sql
outsourced_logistics_status, tracking_barcode, logistics_notes,
dispatched_at, dispatched_by
```

### reports (new columns)
```sql
merged_print_pdf_url, merged_ecopy_pdf_url, merged_at
```

### outsourced_reports (new columns)
```sql
match_confidence, match_suggestions (jsonb), matched_at, matched_by,
merge_status
```

---

## Known Limitations & Future Enhancements

### Current Limitations:
1. Manual PDF merge (not automated yet)
2. No bulk operations for dispatch
3. No email/WhatsApp notifications
4. No analytics dashboard
5. No billing integration

### Future Enhancements:
1. **Barcode Scanning**: Mobile app integration for scan on receipt
2. **Real-Time Tracking**: Integration with courier APIs (FedEx, DHL)
3. **Multi-Language Support**: For outsourced lab communications
4. **Custom Requisition Templates**: Lab-specific requisition formats
5. **SLA Monitoring**: Track and alert on TAT violations
6. **Cost Analytics**: Track profitability of outsourced tests
7. **Automated Reconciliation**: Match invoices from outsourced labs

---

## Support & Maintenance

**Version**: 1.0.0  
**Last Updated**: December 8, 2025  
**Status**: Core features implemented, ready for testing and deployment

For questions or issues, refer to:
- Database schema: `db/migrations/20251208_outsourced_reports_enhancement.sql`
- API implementation: `src/utils/supabase.ts` (line ~6562)
- UI components: `src/pages/OutsourcedReports*.tsx`
