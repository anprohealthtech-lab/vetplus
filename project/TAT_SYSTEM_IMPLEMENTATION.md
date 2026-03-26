# TAT (Turn Around Time) System Implementation

## Overview

Complete TAT tracking system for test orders with the following features:

1. **TAT Hours Configuration** - Set TAT hours per test group
2. **Per-Panel TAT Display** - Show TAT status for each test panel in order cards
3. **TAT Initialization on Order Creation** - Trigger populates TAT fields when orders are created
4. **TAT Floater Widget** - Real-time alerts for approaching/breached TAT

---

## 1. TAT Hours Configuration (TestGroupForm)

### Location
[src/components/Tests/TestGroupForm.tsx](src/components/Tests/TestGroupForm.tsx)

### Changes
- Added `tat_hours` field to form interface
- Added numeric input field (0.5 - 720 hours range, step 0.5)
- Default value: 3 hours
- Updates database via `testGroups.create()` and `testGroups.update()`

### Usage
Navigate to Tests → Test Groups → Create/Edit Test Group → Set "TAT Hours"

---

## 2. Per-Panel TAT Display (Order Cards)

### Location
[src/pages/Orders.tsx](src/pages/Orders.tsx)

### Changes
- Extended `Panel` type with TAT fields:
  - `hours_until_tat_breach` - Hours remaining
  - `is_tat_breached` - Boolean breach status
  - `tat_hours` - Configured TAT duration
  
- Panel chips now show TAT indicator:
  - **Gray badge** (`3h`): Normal, on track
  - **Yellow badge**: Warning (< 2 hours remaining)
  - **Red pulsing badge** (`⏰!`): TAT breached

### Visual Example
```
┌──────────────────────────┐
│ CBC            3h        │  ← TAT badge
│ 5/8 analytes   Partial   │
└──────────────────────────┘
```

---

## 3. TAT Initialization Trigger

### Migration
[supabase/migrations/20260120000003_fix_tat_trigger_on_creation.sql](supabase/migrations/20260120000003_fix_tat_trigger_on_creation.sql)

### What It Does
1. **Enhanced `calculate_tat_metrics()` function** - Now handles both:
   - `UPDATE` on orders (sample receipt/collection)
   - `INSERT` on order_test_groups (new order creation)

2. **New trigger**: `tr_calculate_tat_order_test_groups`
   - Fires BEFORE INSERT on order_test_groups
   - Initializes TAT fields immediately when order is created

3. **Backfill function**: `backfill_tat_metrics()`
   - One-time migration to populate TAT for existing orders
   - Runs automatically during migration

### TAT Fields Populated
| Field | Description |
|-------|-------------|
| `tat_minutes` | TAT duration in minutes |
| `tat_start_time` | When TAT clock started (sample receipt/collection) |
| `expected_report_time` | Deadline (start + TAT duration) |
| `tat_status` | 'pending', 'in_progress', 'within_tat', 'breached' |
| `is_tat_breached` | Boolean flag |

---

## 4. TAT Floater Widget

### Location
[src/components/Orders/TATFloater.tsx](src/components/Orders/TATFloater.tsx)

### Features
- **Floating widget** in bottom-right corner
- Shows orders with:
  - TAT already breached
  - Less than 2 hours until breach
- **Auto-refresh** every 2 minutes
- **Color coded**:
  - Red header = Has breached orders
  - Orange header = Warning only
- **Click to navigate** directly to order results
- **Dismissible** (X button to hide)
- **Collapsible** (click header to toggle)

### Queries
Uses `v_order_test_progress_enhanced` view with filters:
- `lab_id` = current user's lab
- `status` NOT IN ('Completed', 'Delivered', 'Cancelled')
- `is_tat_breached = true` OR `hours_until_tat_breach < 2`

### Integration
Added to [src/components/Layout/Layout.tsx](src/components/Layout/Layout.tsx) - visible on all pages.

---

## TAT Calculation Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Test Groups    │────▶│  Order Created   │────▶│ order_test_groups│
│  tat_hours: 3   │     │                  │     │ tat_minutes: 180│
└─────────────────┘     └──────────────────┘     │ tat_status: pending│
                                                 └─────────────────┘
                                                         │
                               ┌─────────────────────────┘
                               ▼
                   ┌───────────────────────┐
                   │  Sample Received      │
                   │  sample_received_at   │
                   └───────────────────────┘
                               │
                               ▼
                   ┌───────────────────────┐
                   │  Trigger Fires        │
                   │  calculate_tat_metrics│
                   └───────────────────────┘
                               │
                               ▼
           ┌───────────────────────────────────┐
           │  order_test_groups UPDATED        │
           │  tat_start_time = sample_received │
           │  expected_report_time = start+TAT │
           │  tat_status = 'in_progress'       │
           └───────────────────────────────────┘
                               │
                               ▼
                 ┌─────────────────────────┐
                 │  VIEW: v_order_test_    │
                 │  progress_enhanced      │
                 │  Calculates LIVE:       │
                 │  - hours_until_tat_breach│
                 │  - is_tat_breached      │
                 └─────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
    ┌──────────┐        ┌──────────┐        ┌──────────┐
    │ Orders   │        │ Per-Panel│        │ TAT      │
    │ Page     │        │ Chips    │        │ Floater  │
    │ (aggregate)│       │          │        │ Widget   │
    └──────────┘        └──────────┘        └──────────┘
```

---

## Database Schema Summary

### test_groups
```sql
tat_hours NUMERIC DEFAULT 3  -- TAT duration in hours
```

### order_test_groups
```sql
tat_minutes INTEGER,          -- Snapshot of TAT in minutes
tat_start_time TIMESTAMPTZ,   -- When TAT clock started
expected_report_time TIMESTAMPTZ, -- Deadline
actual_report_time TIMESTAMPTZ,   -- When completed (future)
is_tat_breached BOOLEAN DEFAULT false,
tat_status TEXT CHECK (IN 'pending','in_progress','within_tat','breached')
```

### v_order_test_progress_enhanced (VIEW)
```sql
hours_until_tat_breach NUMERIC,  -- Live calculation
is_tat_breached BOOLEAN,         -- Live calculation
tat_hours NUMERIC                -- From test_groups
```

---

## Deployment Steps

1. **Run Migration**
   ```bash
   supabase db push
   # or apply: 20260120000003_fix_tat_trigger_on_creation.sql
   ```

2. **Deploy Frontend**
   - TATFloater component auto-loads via Layout
   - No additional configuration needed

3. **Verify**
   - Create new order → Check order_test_groups has TAT fields populated
   - Receive sample → Check expected_report_time updates
   - Wait for TAT → Floater should show alert

---

## Future Enhancements

1. **Notification System** - Push notifications for TAT breaches
2. **TAT Analytics** - Dashboard showing TAT compliance rates
3. **Custom TAT per Location** - Override TAT hours per collection location
4. **SLA Reporting** - Monthly TAT breach reports
