# Outsourcing Selection Bug Fix

## Issue Description
When creating orders with tests set to "Outsourced" via the manual override dropdown (e.g., "→ UniPath"), the created order displayed all tests as "🏠 In-house" instead of showing the selected outsourced lab.

## Root Cause
The bug was **NOT** in the state management or payload construction. The issue was in the data flow between components:

1. ✅ **OrderForm.tsx** - State management working correctly
   - `testOutsourcingConfig` state properly updated by dropdown onChange
   - Payload correctly built with `outsourced_lab_id`

2. ✅ **database.orders.create()** - Database insertion working correctly
   - `outsourced_lab_id` properly saved to `order_tests` table
   - Database query in Orders.tsx fetching the data correctly

3. ❌ **Orders.tsx → OrderDetailsModal.tsx** - Data not passed through
   - `fetchOrders()` query **was** fetching `order_tests` with `outsourced_lab_id`
   - But when building `CardOrder` objects, only test names were extracted
   - Full `order_tests` array was **not** included in the order object
   - `OrderDetailsModal` couldn't access outsourcing data

## The Fix

### 1. Updated CardOrder Type Definition
**File:** `src/pages/Orders.tsx` (line ~102)

```typescript
type CardOrder = {
  // ... existing properties
  tests: string[];
  order_tests?: any[]; // ✅ Added: Full order_tests array with outsourcing details
  // ... rest of properties
};
```

### 2. Passed order_tests Array When Building Cards
**File:** `src/pages/Orders.tsx` (line ~431)

```typescript
patient: o.patients,
tests: (o.order_tests || []).map((t) => t.test_name),
order_tests: o.order_tests || [], // ✅ Added: Include full order_tests with outsourcing data
```

## How It Works Now

### Data Flow
```
OrderForm (dropdown) 
  → testOutsourcingConfig state 
  → testsPayload with outsourced_lab_id
  → database.orders.create()
  → order_tests table (outsourced_lab_id saved)
  → fetchOrders() query with join
  → CardOrder with order_tests array ✅ NEW
  → OrderDetailsModal receives order_tests
  → Display logic shows correct badge
```

### Display Logic (Already Working)
**File:** `src/components/Orders/OrderDetailsModal.tsx` (line ~2810)

```typescript
const orderTest = (order as any).order_tests?.find((ot: any) => ot.test_name === test);
const isOutsourced = orderTest?.outsourced_lab_id;
const outsourcedLabName = orderTest?.outsourced_labs?.name;

{isOutsourced ? (
  <span className="... bg-orange-100 text-orange-700 ...">
    🏥 {outsourcedLabName || 'Outsourced'}
  </span>
) : (
  <span className="... bg-green-100 text-green-700 ...">
    🏠 In-house
  </span>
)}
```

## Testing
1. Create a new order
2. Select tests (e.g., ALT SGPT, AST SGOT)
3. Use dropdown to set them as "Outsourced → UniPath"
4. Submit the order
5. ✅ Order details should now show "🏥 UniPath" badge instead of "🏠 In-house"

## Related Files
- `src/components/Orders/OrderForm.tsx` - Manual override UI & state
- `src/pages/Orders.tsx` - Order fetching & CardOrder type
- `src/components/Orders/OrderDetailsModal.tsx` - Order display
- `src/utils/supabase.ts` - database.orders.create() API

## Migration
No database migration needed - schema was already correct with `order_tests.outsourced_lab_id` column.

## Status
✅ **FIXED** - Outsourcing selection now properly displays in created orders.
