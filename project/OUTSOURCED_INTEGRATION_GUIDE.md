# Outsourced Reports System - Integration Guide

## Overview

This document explains how the enhanced outsourced reports system integrates with existing LIMS workflows, including manual override capabilities for outsourcing test selection during order creation.

---

## ✅ Completed Implementation

### 1. Database Migration
**Status**: ✅ **COMPLETED** - Migration run successfully

The following enhancements are now active:
- `lab_outsourcing_settings` table for lab-level preferences
- `results.outsourced_logistics_status` for dispatch tracking (pending_dispatch → awaiting_pickup → in_transit → delivered_to_lab → report_awaited)
- `results.tracking_barcode`, `dispatched_at`, `dispatched_by` for logistics metadata
- `reports.merged_print_pdf_url`, `merged_ecopy_pdf_url` for dual PDF merge
- `outsourced_reports.match_confidence`, `match_suggestions`, `merge_status` for AI matching

### 2. Routes & Navigation
**Status**: ✅ **COMPLETED**

**Routes Added** (`src/App.tsx`):
```tsx
<Route path="/outsourced-reports" element={<OutsourcedReportsConsoleEnhanced />} />
<Route path="/outsourced-queue" element={<OutsourcedTestsQueue />} />
<Route path="/outsourced-reports-legacy" element={<OutsourcedReportsConsole />} />
```

**Sidebar Menu** (`src/components/Layout/Sidebar.tsx`):
- **🏥 Outsourced Labs** section with:
  - 📋 Outsourced Reports (Smart matching console)
  - 📦 Outsourced Queue (Dispatch management)

### 3. Component Structure

| Component | Purpose | Features |
|-----------|---------|----------|
| **OutsourcedReportsConsoleEnhanced** | Manage received reports | AI matching, PDF viewer, filtering, smart suggestions |
| **OutsourcedTestsQueue** | Dispatch tests to external labs | TAT tracking, requisition printing, barcode generation |
| **OutsourcedReportsConsole** (Legacy) | Basic report viewing | Preserved for backward compatibility |

---

## 🔄 System Workflow

### A. Outsourced Test Lifecycle

```
1. ORDER CREATION (Manual Override Available)
   ↓
2. DISPATCH QUEUE (OutsourcedTestsQueue)
   ↓
3. LOGISTICS TRACKING (Barcode generation, status updates)
   ↓
4. EMAIL RECEIPT (Webhook processes external lab report)
   ↓
5. SMART MATCHING (AI suggests orders, manual/auto linking)
   ↓
6. PDF MERGE (Print-to-print, ECopy-to-ecopy)
   ↓
7. REPORT DELIVERY (WhatsApp/Email to patient)
```

---

## 🎯 Manual Override: Outsourced Test Selection

### Current Behavior

**Order Creation Process** (via `database.orders.create()` in `src/utils/supabase.ts`):

1. **Test Assignment**: When creating an order, tests are added to `order_tests` table
2. **Outsourcing Detection**: Tests with `outsourced_lab_id` set create results with:
   ```typescript
   {
     outsourced_to_lab_id: orderTest.outsourced_lab_id,
     outsourced_status: 'pending_send',
     outsourced_logistics_status: 'pending_dispatch'
   }
   ```

### Where Outsourcing is Set

#### Option 1: Test Group Level (Current)
**Location**: `test_groups` table has `outsourced_lab_id` field

When a test group is marked as outsourced:
```sql
UPDATE test_groups 
SET outsourced_lab_id = '[external_lab_uuid]'
WHERE id = '[test_group_id]';
```

**Flow**:
```
Test Group (outsourced_lab_id set)
  ↓
Order Creation
  ↓
order_tests (inherits outsourced_lab_id)
  ↓
Results (auto-set outsourced flags)
```

#### Option 2: Order-Level Override (Manual Selection)
**Location**: `order_tests` table allows manual override via `outsourced_lab_id` field

---

## 🛠️ Implementation: Manual Override UI

### Where to Add Override Capability

**Target Component**: Order creation forms (wherever tests are selected)

**Key Files**:
- `src/components/Orders/OrderForm.tsx` (if exists)
- `src/pages/Orders.tsx` (order creation modal)
- `src/pages/Patients.tsx` (order creation during patient registration)

### Implementation Pattern

#### 1. **Order Form Enhancement**

Add outsourcing toggle for each test in the order form:

```tsx
interface OrderTest {
  test_group_id: string;
  test_name: string;
  price: number;
  outsourced_lab_id: string | null; // ← Add this
  outsource_override?: boolean;      // ← UI flag
}

// In order form component
const [tests, setTests] = useState<OrderTest[]>([]);
const [outsourcedLabs, setOutsourcedLabs] = useState<OutsourcedLab[]>([]);

// Load outsourced labs on mount
useEffect(() => {
  const loadOutsourcedLabs = async () => {
    const { data } = await supabase
      .from('outsourced_labs')
      .select('id, name, test_specialties')
      .eq('is_active', true)
      .order('name');
    setOutsourcedLabs(data || []);
  };
  loadOutsourcedLabs();
}, []);

// Toggle outsourcing for a test
const handleOutsourceToggle = (testIndex: number, labId: string | null) => {
  setTests(prev => prev.map((t, i) => 
    i === testIndex 
      ? { ...t, outsourced_lab_id: labId, outsource_override: true }
      : t
  ));
};
```

#### 2. **UI Component for Each Test Row**

```tsx
<div className="border rounded-lg p-4 space-y-3">
  <div className="flex items-center justify-between">
    <div>
      <h4 className="font-medium">{test.test_name}</h4>
      <p className="text-sm text-gray-500">₹{test.price}</p>
    </div>
    <button onClick={() => removeTest(index)} className="text-red-500">
      <X className="h-4 w-4" />
    </button>
  </div>

  {/* Outsource Toggle */}
  <div className="flex items-center gap-3">
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={!!test.outsourced_lab_id}
        onChange={(e) => {
          if (!e.target.checked) {
            handleOutsourceToggle(index, null);
          }
        }}
      />
      <Building2 className="h-4 w-4 text-blue-500" />
      Send to External Lab
    </label>

    {test.outsourced_lab_id && (
      <select
        value={test.outsourced_lab_id}
        onChange={(e) => handleOutsourceToggle(index, e.target.value)}
        className="flex-1 px-3 py-1.5 border rounded-md text-sm"
      >
        <option value="">Select Lab</option>
        {outsourcedLabs.map(lab => (
          <option key={lab.id} value={lab.id}>
            {lab.name}
          </option>
        ))}
      </select>
    )}
  </div>
</div>
```

#### 3. **Order Submission**

When submitting order, ensure `order_tests` includes `outsourced_lab_id`:

```tsx
const handleSubmitOrder = async () => {
  const orderData = {
    patient_id: selectedPatient.id,
    lab_id: currentLabId,
    total_amount: calculateTotal(),
    tests: tests.map(t => ({
      test_group_id: t.test_group_id,
      test_name: t.test_name,
      outsourced_lab_id: t.outsourced_lab_id || null, // ← Include override
      test_type: 'primary'
    }))
  };

  const { data, error } = await database.orders.create(orderData);
  
  if (error) {
    console.error('Order creation failed:', error);
    return;
  }

  // Success - outsourced tests will appear in queue
  console.log('Order created:', data.id);
};
```

---

## 📊 Database Flow After Manual Override

### When Order is Created with Outsourced Tests

1. **Order Created**:
   ```sql
   INSERT INTO orders (patient_id, lab_id, status, ...) 
   VALUES (...);
   ```

2. **Tests Added**:
   ```sql
   INSERT INTO order_tests (order_id, test_group_id, test_name, outsourced_lab_id)
   VALUES 
     ('[order_id]', '[test_1_id]', 'CBC', NULL),           -- In-house test
     ('[order_id]', '[test_2_id]', 'Genetic Panel', '[external_lab_uuid]'); -- Outsourced
   ```

3. **Results Auto-Created** (via trigger or API):
   ```sql
   -- In-house result
   INSERT INTO results (order_id, test_group_id, outsourced_to_lab_id, outsourced_status)
   VALUES ('[order_id]', '[test_1_id]', NULL, 'not_outsourced');

   -- Outsourced result
   INSERT INTO results (
     order_id, 
     test_group_id, 
     outsourced_to_lab_id, 
     outsourced_status,
     outsourced_logistics_status
   )
   VALUES (
     '[order_id]', 
     '[test_2_id]', 
     '[external_lab_uuid]',
     'pending_send',
     'pending_dispatch'
   );
   ```

4. **Appears in Outsourced Queue**:
   - `OutsourcedTestsQueue` queries `results` WHERE `outsourced_logistics_status = 'pending_dispatch'`
   - Lab staff can print requisition, mark as dispatched

---

## 🔍 Testing the Manual Override

### Step-by-Step Test Plan

1. **Setup**:
   - Ensure migration is run: `db/migrations/20251208_outsourced_reports_enhancement.sql`
   - Add at least one outsourced lab in Settings → Outsourced Labs

2. **Create Order with Override**:
   - Go to Orders or Patients page
   - Add new order
   - Select multiple tests
   - Toggle "Send to External Lab" for specific test
   - Select external lab from dropdown
   - Submit order

3. **Verify Queue**:
   - Navigate to **Outsourced Queue** (`/outsourced-queue`)
   - Check "Pending Dispatch" tab
   - Find your test with correct lab assignment
   - Click "Print Requisition" to generate barcode
   - Mark as "Dispatched"

4. **Verify Logistics Tracking**:
   - Check result record has:
     - `outsourced_logistics_status = 'in_transit'`
     - `tracking_barcode = 'OUT-[timestamp]-[result_id]'`
     - `dispatched_at = now()`
     - `dispatched_by = current_user_id`

5. **Test Email Receipt** (when report arrives):
   - Forward external lab report to your lab's email
   - Check **Outsourced Reports** (`/outsourced-reports`)
   - Use "Smart Match" to link to your order
   - Verify confidence score and match reasons

---

## 🎨 UI Recommendations

### Visual Indicators

**In Order Form**:
- 🏥 Icon badge for outsourced tests
- Different background color (e.g., light blue) for outsourced test rows
- "External Lab" label with lab name

**In Order List**:
- Show outsourced status badge:
  - 🚀 **Pending Dispatch** (orange)
  - 📦 **In Transit** (blue)
  - ⏳ **Awaiting Report** (purple)
  - ✅ **Received** (green)

**In Results Entry**:
- Grey out outsourced tests (cannot enter manually)
- Show "Outsourced to [Lab Name]" message
- Link to tracking status

---

## 🔗 API Reference

### Check if Test is Outsourced

```typescript
const { data: orderTests } = await database.orders.getById(orderId);
const outsourcedTests = orderTests?.order_tests?.filter(
  (ot: any) => ot.outsourced_lab_id !== null
);
```

### Query Outsourced Queue

```typescript
const { data: queue } = await database.outsourcedReports.getPendingTests({
  status: 'pending_dispatch',
  outsourcedLabId: '[specific_lab_id]' // optional filter
});
```

### Update Logistics Status

```typescript
await database.outsourcedReports.updateLogisticsStatus(
  resultId,
  'in_transit',
  'Shipped via FedEx - Tracking: 123456789'
);
```

### Generate Tracking Barcode

```typescript
const { data: barcode } = await database.outsourcedReports.generateTrackingBarcode(resultId);
console.log(barcode); // "OUT-1733684400000-abc12345"
```

---

## 📋 Current vs Enhanced Pages

### Old Page: OutsourcedReportsConsole (Legacy)
**Route**: `/outsourced-reports-legacy`
- Basic list of received reports
- Manual linking only
- No filtering or search
- Preserved for backward compatibility

### New Page: OutsourcedReportsConsoleEnhanced
**Route**: `/outsourced-reports` (default)
- Smart AI matching with confidence scores
- Advanced filtering (status, match, date range)
- PDF viewer with extracted data
- One-click linking
- Stats dashboard

### New Page: OutsourcedTestsQueue
**Route**: `/outsourced-queue`
- Pre-dispatch management
- Requisition printing with barcodes
- TAT tracking with overdue alerts
- Logistics status updates
- Multi-lab filtering

---

## 🚀 Next Steps

### Immediate Tasks

1. ✅ **Routes Added** - Navigation working
2. ✅ **Sidebar Updated** - Menu items visible
3. ⏳ **Manual Override UI** - Need to add to order forms
4. ⏳ **Result Creation Hook** - Auto-set outsourced flags
5. ⏳ **PDF Merge Function** - Implement dual merge logic

### Order Form Integration

**Priority**: HIGH - Enable manual outsourcing selection

**Where to Add**:
- `src/pages/Orders.tsx` - Order creation modal
- `src/pages/Patients.tsx` - Patient registration with order
- Any custom order form components

**What to Add**:
1. Checkbox: "Send to External Lab"
2. Dropdown: Select from active outsourced labs
3. Visual indicator: Show outsourced badge
4. Pass `outsourced_lab_id` in order submission

**Code Template**: See "Implementation: Manual Override UI" section above

### Result Creation Hook

**File**: Where results are created (likely in order processing or result entry)

**Logic**:
```typescript
// When creating result from order_test
if (orderTest.outsourced_lab_id) {
  resultData.outsourced_to_lab_id = orderTest.outsourced_lab_id;
  resultData.outsourced_status = 'pending_send';
  resultData.outsourced_logistics_status = 'pending_dispatch';
}
```

### PDF Merge Implementation

**File**: `src/utils/pdfService.ts`

**Function Signature**:
```typescript
export async function mergePDFReports(
  internalPdfUrl: string,
  externalPdfUrl: string,
  mergeType: 'print' | 'ecopy'
): Promise<MergedPDFResult>
```

**API**: Use PDF.co `/pdf/merge` endpoint (already integrated for other features)

---

## 📖 Related Documentation

- **System Overview**: `OUTSOURCED_REPORTS_SYSTEM.md`
- **Database Schema**: `db/migrations/20251208_outsourced_reports_enhancement.sql`
- **API Reference**: `src/utils/supabase.ts` (lines 6562-6892)
- **Type Definitions**: `src/types/index.ts` (lines 667-773)

---

## ❓ FAQ

### Q: Can I override outsourcing for a test that's normally in-house?
**A**: Yes! Use the manual override UI to select any test and assign it to an external lab.

### Q: What happens if I don't select an external lab?
**A**: The test remains in-house and follows normal result entry workflow.

### Q: Can I change outsourcing after order is created?
**A**: Not currently implemented. Order must be modified or tests re-added with correct outsourcing.

### Q: How do I know if a test is already marked as outsourced?
**A**: Check the test group settings or look for the outsourcing badge in test selection UI.

### Q: What's the difference between outsourced_status and outsourced_logistics_status?
**A**: 
- `outsourced_status`: Main workflow (pending_send → sent → awaiting_report → received → merged)
- `outsourced_logistics_status`: Pre-send tracking (pending_dispatch → awaiting_pickup → in_transit → delivered_to_lab → report_awaited)

---

**Last Updated**: December 8, 2025  
**Version**: 1.0  
**Status**: Migration ✅ | Routes ✅ | Manual Override ⏳
