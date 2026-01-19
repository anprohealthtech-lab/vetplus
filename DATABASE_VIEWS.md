# Database Views Documentation

This document provides comprehensive documentation for all database views in the LIMS system. Views are organized by functional domain and include schema definitions, usage patterns, and integration guidelines.

> **Last Updated**: January 2026  
> **Total Views**: 25+ active views across 8 functional domains

---

## Table of Contents

1. [Core Operations Views](#1-core-operations-views)
2. [Financial & Billing Views](#2-financial--billing-views)
3. [Analytics Views](#3-analytics-views)
4. [Sample Management Views](#4-sample-management-views)
5. [Patient Management Views](#5-patient-management-views)
6. [Pricing Views](#6-pricing-views)
7. [Report & Template Views](#7-report--template-views)
8. [Reserved/Future Views](#8-reservedfuture-views)
9. [Usage Guide for Developers](#usage-guide-for-developers)

---

## 1. Core Operations Views

### `v_order_test_progress_enhanced`

**Defined In**: `supabase/migrations/20260109_fix_is_verified_logic.sql`

**Description**: Primary view for tracking test panel status within orders. This is the most critical view for daily laboratory operations.

**Columns**:
| Column | Type | Description |
|--------|------|-------------|
| `order_id` | uuid | Order identifier |
| `patient_id` | uuid | Patient identifier |
| `patient_name` | text | Patient's full name |
| `sample_id` | text | Unique sample identifier |
| `color_code` | text | Hex color for tube identification |
| `color_name` | text | Human-readable tube color |
| `order_status` | enum | Current order status |
| `priority` | enum | Normal/Urgent/STAT |
| `order_date` | date | Order creation date |
| `work_date` | timestamp | Sample collection or creation time |
| `lab_id` | uuid | Lab scope |
| `location_id` | uuid | Collection location |
| `test_group_id` | uuid | Test panel identifier |
| `test_group_name` | text | Test panel name |
| `department` | text | Department (Hematology, Biochemistry, etc.) |
| `tat_hours` | numeric | Expected turnaround time |
| `total_analytes` | int | Expected analyte count |
| `entered_analytes` | int | Completed analyte count |
| `panel_status` | text | not_started/in_progress/completed |
| `is_verified` | boolean | All results approved |
| `completion_percentage` | numeric | Progress percentage |
| `workflow_eligible` | boolean | Has AI workflow mapping |
| `critical_count` | int | Critical flag count |
| `abnormal_count` | int | Abnormal flag count |
| `hours_until_tat_breach` | numeric | Hours remaining |
| `is_tat_breached` | boolean | TAT exceeded |

**Usage Locations**:
- `src/pages/Dashboard.tsx` - Order cards and KPI calculation
- `src/pages/Results.tsx` - Results entry queue
- `src/components/Results/EntryMode/DepartmentView.tsx` - Department-wise work queue
- `src/pages/Orders.tsx` - Order listing with status

**Query Example**:
```typescript
const { data } = await database.orders.getWithProgress({
  lab_id: labId,
  work_date: new Date(),
  department: 'Hematology'
});
```

---

### `view_patient_history`

**Defined In**: `supabase/migrations/20251231_fix_view_patient_history_analyte_name.sql`

**Description**: Consolidated patient result history merging internal and external results for trend analysis.

**Columns**:
| Column | Type | Description |
|--------|------|-------------|
| `patient_id` | uuid | Patient identifier |
| `analyte_id` | uuid | Analyte identifier |
| `analyte_name` | text | Analyte display name |
| `value` | text | Result value |
| `unit` | text | Unit of measurement |
| `reference_range` | text | Normal range |
| `flag` | text | H/L/C flag |
| `result_date` | timestamp | Date of result |
| `source` | text | 'internal' or 'external' |

**Usage Locations**:
- `src/hooks/useTrendGraphs.ts` - Patient trend line charts
- `src/utils/trendChartGenerator.ts` - AI trend analysis
- `src/pages/OrderVerificationView.tsx` - Historical comparison

---

### `v_result_panel_status`

**Defined In**: `supabase/migrations/20260108_fix_panel_ready_include_pending_tests.sql`

**Description**: Simplified view for checking if order panels are ready for reporting.

**Columns**: `order_id`, `test_group_id`, `is_panel_ready`, `pending_count`, `completed_count`

---

### `view_report_final_context`

**Defined In**: `supabase/migrations/20260108100000_create_view_report_final_context.sql`

**Description**: Consolidated view for PDF report generation with all required context (patient, doctor, results, interpretations).

---

## 2. Financial & Billing Views

### `v_daily_cash_summary`

**Defined In**: `supabase/migrations/20251127_refund_management_system.sql`

**Description**: Daily cash register summary with collections, refunds, and net cash by location.

**Columns**:
| Column | Type | Description |
|--------|------|-------------|
| `lab_id` | uuid | Lab scope |
| `location_id` | uuid | Collection center |
| `location_name` | text | Location display name |
| `summary_date` | date | Business date |
| `cash_collections` | numeric | Total cash received |
| `non_cash_collections` | numeric | Card/UPI/Bank transfers |
| `total_collections` | numeric | Sum of all collections |
| `cash_refunds` | numeric | Cash refunds issued |
| `net_cash` | numeric | Cash collections - refunds |
| `payment_count` | int | Number of transactions |
| `invoice_count` | int | Unique invoices |

**Usage Locations**:
- `src/pages/CashReconciliation.tsx` - Daily cash closing
- `src/pages/FinancialReports.tsx` - Financial dashboards

---

### `v_pending_refund_approvals`

**Defined In**: `supabase/migrations/20251127_refund_management_system.sql`

**Description**: Queue of refund requests pending approval with patient and invoice details.

**Columns**: `id`, `lab_id`, `location_id`, `invoice_id`, `patient_id`, `refund_amount`, `refund_method`, `reason_category`, `reason_details`, `status`, `invoice_total`, `amount_paid`, `max_refundable`, `patient_name`, `requested_by_name`, `hours_pending`

---

## 3. Analytics Views

> **Migration File**: `supabase/migrations/20260120000001_analytics_views.sql`

These views power the Analytics Dashboard with pre-aggregated metrics for performance.

### `v_analytics_kpi_summary`

**Description**: Real-time KPI metrics for the analytics dashboard header.

**Columns**:
| Column | Type | Description |
|--------|------|-------------|
| `lab_id` | uuid | Lab scope |
| `date` | date | Metrics date |
| `total_orders` | int | Orders created |
| `total_revenue` | numeric | Gross revenue |
| `avg_order_value` | numeric | Revenue / Orders |
| `samples_collected` | int | Samples collected |
| `reports_generated` | int | Reports finalized |
| `pending_reports` | int | Awaiting approval |
| `critical_results` | int | Critical flags today |
| `tat_breaches` | int | TAT violations |

---

### `v_analytics_revenue_daily`

**Description**: Daily revenue breakdown with payment method splits and discount tracking.

**Columns**:
| Column | Type | Description |
|--------|------|-------------|
| `lab_id` | uuid | Lab scope |
| `date` | date | Business date |
| `location_id` | uuid | Optional location filter |
| `location_name` | text | Location name |
| `gross_revenue` | numeric | Invoice totals |
| `discounts` | numeric | Total discounts |
| `net_revenue` | numeric | Gross - Discounts |
| `cash_collected` | numeric | Cash payments |
| `card_collected` | numeric | Card payments |
| `upi_collected` | numeric | UPI payments |
| `credit_outstanding` | numeric | Unpaid invoices |
| `refunds` | numeric | Refunds issued |
| `order_count` | int | Number of orders |

---

### `v_analytics_orders_by_department`

**Description**: Order and revenue distribution by department.

**Columns**: `lab_id`, `date`, `department`, `order_count`, `test_count`, `revenue`, `percentage_of_total`

---

### `v_analytics_orders_by_status`

**Description**: Order funnel by status for donut/pie charts.

**Columns**: `lab_id`, `date`, `status`, `count`, `percentage`

---

### `v_analytics_test_popularity`

**Description**: Top performing tests by volume and revenue.

**Columns**: `lab_id`, `date_from`, `date_to`, `test_group_id`, `test_name`, `department`, `order_count`, `revenue`, `avg_price`, `rank`

---

### `v_analytics_tat_summary`

**Description**: Turnaround time metrics by department and test.

**Columns**:
| Column | Type | Description |
|--------|------|-------------|
| `lab_id` | uuid | Lab scope |
| `date` | date | Business date |
| `department` | text | Department name |
| `avg_tat_hours` | numeric | Average TAT |
| `min_tat_hours` | numeric | Fastest completion |
| `max_tat_hours` | numeric | Slowest completion |
| `within_target` | int | Within TAT target |
| `breached` | int | TAT exceeded |
| `breach_percentage` | numeric | Breach rate |

---

### `v_analytics_location_performance`

**Description**: Location-wise performance metrics for multi-center labs.

**Columns**: `lab_id`, `location_id`, `location_name`, `date`, `order_count`, `revenue`, `collection_efficiency`, `avg_tat`, `patient_count`

---

### `v_analytics_account_performance`

**Description**: B2B account performance metrics.

**Columns**: `lab_id`, `account_id`, `account_name`, `account_type`, `date`, `order_count`, `revenue`, `outstanding_amount`, `avg_order_value`

---

### `v_analytics_outsourced_summary`

**Description**: Outsourced test volume and cost tracking.

**Columns**: `lab_id`, `outsourced_lab_id`, `lab_name`, `date`, `test_count`, `cost`, `revenue`, `margin`, `pending_results`, `avg_tat`

---

### `v_analytics_critical_alerts`

**Description**: Critical and abnormal results requiring attention.

**Columns**: `lab_id`, `order_id`, `patient_id`, `patient_name`, `test_name`, `analyte_name`, `value`, `reference_range`, `flag`, `result_date`, `is_notified`, `hours_since_result`

---

### `v_analytics_patient_demographics`

**Description**: Patient demographic distribution for analysis.

**Columns**: `lab_id`, `date`, `gender`, `age_group`, `patient_count`, `order_count`, `revenue`

---

### `v_analytics_sample_rejection`

**Description**: Sample rejection tracking and reasons.

**Columns**: `lab_id`, `date`, `location_id`, `rejection_reason`, `count`, `percentage`

---

## 4. Sample Management Views

### `v_sample_summary`

**Defined In**: `supabase/migrations/20260101_add_sample_management.sql`

**Description**: Sample collection and processing summary.

**Columns**: `sample_id`, `order_id`, `patient_name`, `collection_status`, `collected_at`, `collected_by`, `tube_color`, `tests`

---

### `daily_sample_roster`

**Defined In**: `supabase/migrations/20250808130000_move_sample_tracking_to_orders.sql`

**Description**: Daily roster of all samples with collection status for laboratory workflow management.

**Columns**: `sample_date`, `sample_id`, `color_code`, `color_name`, `order_id`, `patient_name`, `tests`, `sample_collected_at`, `sample_collected_by`

---

### `patient_visit_summary`

**Defined In**: `supabase/migrations/20250808130000_move_sample_tracking_to_orders.sql`

**Description**: Patient visit aggregation with test counts and billing status.

**Columns**: `patient_id`, `patient_name`, `order_id`, `order_status`, `tests`, `result_count`, `approved_results`, `visit_status`

---

## 5. Patient Management Views

### `v_patients_with_duplicates`

**Defined In**: `supabase/migrations/20251220145000_fix_patient_view.sql`

**Description**: Identifies potential duplicate patients based on name/phone matching.

**Columns**: `id`, `name`, `phone`, `duplicate_count`, `potential_duplicates`

---

### `view_approved_results`

**Defined In**: `supabase/migrations/20251216_fix_view_approved_results_duplicates.sql`

**Description**: All approved results with patient and order context for reporting.

---

## 6. Pricing Views

### `v_location_test_prices_effective`

**Defined In**: `supabase/migrations/20260119000001_pricing_tables.sql`

**Description**: Effective prices by location with fallback to base price.

**Columns**: `lab_id`, `location_id`, `test_group_id`, `effective_price`, `mrp`, `discount_percent`, `price_source`

---

### `v_outsourced_lab_prices_effective`

**Defined In**: `supabase/migrations/20260119000001_pricing_tables.sql`

**Description**: Outsourced lab pricing with margin calculation.

**Columns**: `lab_id`, `outsourced_lab_id`, `test_group_id`, `cost_price`, `selling_price`, `margin`

---

### `v_account_prices_effective`

**Defined In**: `supabase/migrations/20260119000001_pricing_tables.sql`

**Description**: B2B account-specific pricing tiers.

**Columns**: `lab_id`, `account_id`, `test_group_id`, `negotiated_price`, `discount_percent`, `valid_from`, `valid_to`

---

## 7. Report & Template Views

### `v_calculated_analytes`

**Defined In**: `supabase/migrations/20251215_packages_sections_calculations.sql`

**Description**: Calculated/derived analytes with formula definitions.

---

### `v_template_sections`

**Defined In**: `supabase/migrations/20251215_packages_sections_calculations.sql`

**Description**: Report template sections with ordering and visibility.

---

## 8. Reserved/Future Views

### `active_patient_sessions`

**Defined In**: `supabase/migrations/20250802120000_patient_centric_workflow.sql`

**Status**: Reserved for future Patient Session module.

**Columns**: `patient_name`, `total_tests`, `completed_tests`, `current_total`, `last_sample_time`

---

### `session_summary`

**Defined In**: `supabase/migrations/20250802120000_patient_centric_workflow.sql`

**Status**: Reserved for future Patient Session module.

**Columns**: `payment_received`, `balance_due`, `final_total`, `pending_tests`

---

### `test_request_details`

**Defined In**: `supabase/migrations/20250802120000_patient_centric_workflow.sql`

**Status**: Reserved for future Patient Session module.

**Columns**: `requested_by_name`, `collected_by_name`, `estimated_cost`, `actual_cost`

---

## Usage Guide for Developers

### General Rules

1. **Always use `database.` namespace** - Never query views directly with `supabase.from()`.
2. **Always filter by `lab_id`** - Multi-tenancy is enforced at the application layer.
3. **Use date ranges for performance** - Analytics views can be slow without date filters.

### When to Use Each View Category

#### Core Operations (`v_order_test_progress_enhanced`)
```typescript
// For dashboard order cards
const { data } = await database.orders.getWithProgress({
  lab_id: labId,
  work_date: today,
});

// For department work queue
const { data } = await database.orders.getByDepartment(labId, 'Hematology');
```

#### Financial (`v_daily_cash_summary`)
```typescript
// For cash reconciliation
const { data } = await database.analytics.getDailyCashSummary({
  lab_id: labId,
  date: today,
  location_id: locationId // optional
});
```

#### Analytics Views
```typescript
// For analytics dashboard
const { data } = await database.analytics.getKpiSummary({
  lab_id: labId,
  from_date: startDate,
  to_date: endDate
});

// For revenue chart
const { data } = await database.analytics.getRevenueDaily({
  lab_id: labId,
  from_date: startDate,
  to_date: endDate,
  group_by: 'day' // or 'week', 'month'
});
```

### Performance Tips

1. **Date filtering is critical** - Analytics views should always have date bounds
2. **Use location filtering** - For multi-center labs, always filter by location when possible
3. **Prefer views over joins** - Views are optimized with proper indexes
4. **Cache where appropriate** - KPI summaries can be cached for 5-minute intervals

### Adding New Views

1. Create migration in `supabase/migrations/YYYYMMDD_description.sql`
2. Use `CREATE OR REPLACE VIEW` for idempotency
3. Add `lab_id` column for RLS compatibility
4. Grant SELECT to `authenticated` and `anon` roles
5. Add COMMENT explaining the view's purpose
6. Update this document with the new view details
7. Add database layer methods in `src/utils/supabase.ts`
