-- =============================================
-- ANALYTICS VIEWS MIGRATION
-- Created: 2026-01-20
-- Description: Comprehensive analytics views for LIMS dashboard
-- =============================================

-- =============================================
-- VIEW 1: KPI Summary (Real-time metrics)
-- =============================================

CREATE OR REPLACE VIEW public.v_analytics_kpi_summary AS
SELECT 
  o.lab_id,
  DATE(COALESCE(o.sample_collected_at, o.created_at)) AS date,
  
  -- Order metrics
  COUNT(DISTINCT o.id) AS total_orders,
  
  -- Revenue metrics
  COALESCE(SUM(i.total), 0) AS total_revenue,
  CASE 
    WHEN COUNT(DISTINCT o.id) > 0 
    THEN ROUND(COALESCE(SUM(i.total), 0) / COUNT(DISTINCT o.id), 2)
    ELSE 0 
  END AS avg_order_value,
  
  -- Sample metrics
  COUNT(DISTINCT CASE WHEN o.sample_collected_at IS NOT NULL THEN o.id END) AS samples_collected,
  
  -- Report metrics
  COUNT(DISTINCT CASE WHEN rp.id IS NOT NULL AND rp.status = 'final' THEN rp.order_id END) AS reports_generated,
  COUNT(DISTINCT CASE WHEN o.status = 'Pending Approval' THEN o.id END) AS pending_reports,
  
  -- Critical results
  COUNT(DISTINCT CASE WHEN rv.flag = 'C' THEN o.id END) AS critical_results,
  
  -- TAT breaches (orders where any test exceeded TAT)
  COUNT(DISTINCT CASE 
    WHEN tg.tat_hours IS NOT NULL 
      AND COALESCE(o.sample_received_at, o.sample_collected_at) IS NOT NULL
      AND NOW() > (COALESCE(o.sample_received_at, o.sample_collected_at) + (tg.tat_hours || ' hours')::interval)
      AND o.status NOT IN ('Completed', 'Delivered')
    THEN o.id 
  END) AS tat_breaches

FROM orders o
LEFT JOIN invoices i ON i.order_id = o.id
LEFT JOIN reports rp ON rp.order_id = o.id
LEFT JOIN order_tests ot ON ot.order_id = o.id
LEFT JOIN test_groups tg ON tg.id = ot.test_group_id
LEFT JOIN results r ON r.order_id = o.id
LEFT JOIN result_values rv ON rv.result_id = r.id
WHERE o.lab_id IS NOT NULL
GROUP BY o.lab_id, DATE(COALESCE(o.sample_collected_at, o.created_at));

COMMENT ON VIEW v_analytics_kpi_summary IS 'Real-time KPI metrics aggregated by lab and date for analytics dashboard header';


-- =============================================
-- VIEW 2: Daily Revenue Breakdown
-- =============================================

CREATE OR REPLACE VIEW public.v_analytics_revenue_daily AS
SELECT 
  i.lab_id,
  DATE(i.created_at) AS date,
  i.location_id,
  l.name AS location_name,
  
  -- Gross/Net Revenue
  SUM(COALESCE(i.total_before_discount, i.total)) AS gross_revenue,
  SUM(COALESCE(i.total_discount, 0)) AS discounts,
  SUM(COALESCE(i.total_after_discount, i.total)) AS net_revenue,
  
  -- Payment method breakdown
  COALESCE(SUM(CASE WHEN p.payment_method = 'cash' THEN p.amount ELSE 0 END), 0) AS cash_collected,
  COALESCE(SUM(CASE WHEN p.payment_method = 'card' THEN p.amount ELSE 0 END), 0) AS card_collected,
  COALESCE(SUM(CASE WHEN p.payment_method IN ('upi', 'online') THEN p.amount ELSE 0 END), 0) AS upi_collected,
  COALESCE(SUM(CASE WHEN p.payment_method = 'bank_transfer' THEN p.amount ELSE 0 END), 0) AS bank_transfer_collected,
  
  -- Outstanding
  SUM(GREATEST(COALESCE(i.total_after_discount, i.total) - COALESCE(i.amount_paid, 0), 0)) AS credit_outstanding,
  
  -- Refunds (from joined subquery)
  COALESCE(MAX(rr.refunds), 0) AS refunds,
  
  -- Counts
  COUNT(DISTINCT i.id) AS invoice_count,
  COUNT(DISTINCT i.order_id) AS order_count

FROM invoices i
LEFT JOIN locations l ON l.id = i.location_id
LEFT JOIN payments p ON p.invoice_id = i.id
LEFT JOIN (
  SELECT lab_id, DATE(paid_at) AS refund_date, SUM(refund_amount) AS refunds
  FROM refund_requests
  WHERE status = 'paid'
  GROUP BY lab_id, DATE(paid_at)
) rr ON rr.lab_id = i.lab_id AND rr.refund_date = DATE(i.created_at)
WHERE i.lab_id IS NOT NULL
GROUP BY i.lab_id, DATE(i.created_at), i.location_id, l.name
ORDER BY date DESC;

COMMENT ON VIEW v_analytics_revenue_daily IS 'Daily revenue breakdown with payment method splits, discounts, and outstanding amounts';


-- =============================================
-- VIEW 3: Orders by Department
-- =============================================

CREATE OR REPLACE VIEW public.v_analytics_orders_by_department AS
WITH dept_totals AS (
  SELECT 
    o.lab_id,
    DATE(COALESCE(o.sample_collected_at, o.created_at)) AS date,
    tg.department,
    COUNT(DISTINCT o.id) AS order_count,
    COUNT(DISTINCT ot.id) AS test_count,
    COALESCE(SUM(
      CASE 
        WHEN ot.price IS NOT NULL THEN ot.price
        ELSE tg.price 
      END
    ), 0) AS revenue
  FROM orders o
  JOIN order_tests ot ON ot.order_id = o.id
  JOIN test_groups tg ON tg.id = ot.test_group_id
  WHERE o.lab_id IS NOT NULL AND tg.department IS NOT NULL
  GROUP BY o.lab_id, DATE(COALESCE(o.sample_collected_at, o.created_at)), tg.department
),
daily_totals AS (
  SELECT lab_id, date, SUM(order_count) AS total_orders, SUM(revenue) AS total_revenue
  FROM dept_totals
  GROUP BY lab_id, date
)
SELECT 
  dt.lab_id,
  dt.date,
  dt.department,
  dt.order_count,
  dt.test_count,
  dt.revenue,
  ROUND((dt.order_count::numeric / NULLIF(tot.total_orders, 0)) * 100, 1) AS order_percentage,
  ROUND((dt.revenue::numeric / NULLIF(tot.total_revenue, 0)) * 100, 1) AS revenue_percentage
FROM dept_totals dt
JOIN daily_totals tot ON tot.lab_id = dt.lab_id AND tot.date = dt.date
ORDER BY dt.date DESC, dt.revenue DESC;

COMMENT ON VIEW v_analytics_orders_by_department IS 'Order and revenue distribution by department with percentage of daily totals';


-- =============================================
-- VIEW 4: Orders by Status (Funnel)
-- =============================================

CREATE OR REPLACE VIEW public.v_analytics_orders_by_status AS
WITH status_counts AS (
  SELECT 
    lab_id,
    DATE(COALESCE(sample_collected_at, created_at)) AS date,
    status,
    COUNT(*) AS count
  FROM orders
  WHERE lab_id IS NOT NULL
  GROUP BY lab_id, DATE(COALESCE(sample_collected_at, created_at)), status
),
daily_totals AS (
  SELECT lab_id, date, SUM(count) AS total
  FROM status_counts
  GROUP BY lab_id, date
)
SELECT 
  sc.lab_id,
  sc.date,
  sc.status,
  sc.count,
  ROUND((sc.count::numeric / NULLIF(dt.total, 0)) * 100, 1) AS percentage
FROM status_counts sc
JOIN daily_totals dt ON dt.lab_id = sc.lab_id AND dt.date = sc.date
ORDER BY sc.date DESC, sc.count DESC;

COMMENT ON VIEW v_analytics_orders_by_status IS 'Order funnel by status for donut/pie charts with daily percentages';


-- =============================================
-- VIEW 5: Test Popularity (Top Tests)
-- =============================================

CREATE OR REPLACE VIEW public.v_analytics_test_popularity AS
SELECT 
  o.lab_id,
  tg.id AS test_group_id,
  tg.name AS test_name,
  tg.department,
  COUNT(DISTINCT ot.id) AS order_count,
  COALESCE(SUM(COALESCE(ot.price, tg.price)), 0) AS revenue,
  ROUND(AVG(COALESCE(ot.price, tg.price)), 2) AS avg_price,
  ROW_NUMBER() OVER (
    PARTITION BY o.lab_id 
    ORDER BY COUNT(DISTINCT ot.id) DESC
  ) AS rank_by_volume,
  ROW_NUMBER() OVER (
    PARTITION BY o.lab_id 
    ORDER BY COALESCE(SUM(COALESCE(ot.price, tg.price)), 0) DESC
  ) AS rank_by_revenue
FROM orders o
JOIN order_tests ot ON ot.order_id = o.id
JOIN test_groups tg ON tg.id = ot.test_group_id
WHERE o.lab_id IS NOT NULL
GROUP BY o.lab_id, tg.id, tg.name, tg.department
ORDER BY order_count DESC;

COMMENT ON VIEW v_analytics_test_popularity IS 'Test popularity rankings by volume and revenue for identifying top performers';


-- =============================================
-- VIEW 6: TAT Summary by Department
-- =============================================

CREATE OR REPLACE VIEW public.v_analytics_tat_summary AS
SELECT 
  o.lab_id,
  DATE(COALESCE(o.sample_collected_at, o.created_at)) AS date,
  tg.department,
  tg.name AS test_name,
  tg.tat_hours AS target_tat,
  
  -- TAT metrics (in hours)
  ROUND(AVG(
    EXTRACT(EPOCH FROM (
      COALESCE(rp.created_at, NOW()) - COALESCE(o.sample_received_at, o.sample_collected_at, o.created_at)
    )) / 3600
  )::numeric, 1) AS avg_tat_hours,
  
  ROUND(MIN(
    EXTRACT(EPOCH FROM (
      COALESCE(rp.created_at, NOW()) - COALESCE(o.sample_received_at, o.sample_collected_at, o.created_at)
    )) / 3600
  )::numeric, 1) AS min_tat_hours,
  
  ROUND(MAX(
    EXTRACT(EPOCH FROM (
      COALESCE(rp.created_at, NOW()) - COALESCE(o.sample_received_at, o.sample_collected_at, o.created_at)
    )) / 3600
  )::numeric, 1) AS max_tat_hours,
  
  -- TAT compliance
  COUNT(CASE 
    WHEN tg.tat_hours IS NOT NULL 
      AND EXTRACT(EPOCH FROM (
        COALESCE(rp.created_at, NOW()) - COALESCE(o.sample_received_at, o.sample_collected_at, o.created_at)
      )) / 3600 <= tg.tat_hours
    THEN 1 
  END) AS within_target,
  
  COUNT(CASE 
    WHEN tg.tat_hours IS NOT NULL 
      AND EXTRACT(EPOCH FROM (
        COALESCE(rp.created_at, NOW()) - COALESCE(o.sample_received_at, o.sample_collected_at, o.created_at)
      )) / 3600 > tg.tat_hours
    THEN 1 
  END) AS breached,
  
  COUNT(*) AS total_tests,
  
  ROUND(
    COUNT(CASE 
      WHEN tg.tat_hours IS NOT NULL 
        AND EXTRACT(EPOCH FROM (
          COALESCE(rp.created_at, NOW()) - COALESCE(o.sample_received_at, o.sample_collected_at, o.created_at)
        )) / 3600 > tg.tat_hours
      THEN 1 
    END)::numeric / NULLIF(COUNT(*), 0) * 100
  , 1) AS breach_percentage

FROM orders o
JOIN order_tests ot ON ot.order_id = o.id
JOIN test_groups tg ON tg.id = ot.test_group_id
LEFT JOIN reports rp ON rp.order_id = o.id AND rp.status = 'final'
WHERE o.lab_id IS NOT NULL 
  AND COALESCE(o.sample_received_at, o.sample_collected_at) IS NOT NULL
GROUP BY o.lab_id, DATE(COALESCE(o.sample_collected_at, o.created_at)), tg.department, tg.name, tg.tat_hours
ORDER BY date DESC, breach_percentage DESC NULLS LAST;

COMMENT ON VIEW v_analytics_tat_summary IS 'Turnaround time metrics by department and test with breach analysis';


-- =============================================
-- VIEW 7: Location Performance
-- =============================================

CREATE OR REPLACE VIEW public.v_analytics_location_performance AS
SELECT 
  o.lab_id,
  o.location_id,
  l.name AS location_name,
  DATE(COALESCE(o.sample_collected_at, o.created_at)) AS date,
  
  -- Volume metrics
  COUNT(DISTINCT o.id) AS order_count,
  COUNT(DISTINCT o.patient_id) AS patient_count,
  COUNT(DISTINCT ot.id) AS test_count,
  
  -- Revenue
  COALESCE(SUM(i.total), 0) AS revenue,
  COALESCE(SUM(i.amount_paid), 0) AS collected,
  
  -- Collection efficiency
  ROUND(
    COALESCE(SUM(i.amount_paid), 0)::numeric / NULLIF(COALESCE(SUM(i.total), 0), 0) * 100
  , 1) AS collection_efficiency,
  
  -- Sample collection rate
  ROUND(
    COUNT(DISTINCT CASE WHEN o.sample_collected_at IS NOT NULL THEN o.id END)::numeric / 
    NULLIF(COUNT(DISTINCT o.id), 0) * 100
  , 1) AS sample_collection_rate,
  
  -- Average TAT
  ROUND(AVG(
    EXTRACT(EPOCH FROM (NOW() - COALESCE(o.sample_collected_at, o.created_at))) / 3600
  )::numeric, 1) AS avg_processing_hours

FROM orders o
LEFT JOIN locations l ON l.id = o.location_id
LEFT JOIN order_tests ot ON ot.order_id = o.id
LEFT JOIN invoices i ON i.order_id = o.id
WHERE o.lab_id IS NOT NULL
GROUP BY o.lab_id, o.location_id, l.name, DATE(COALESCE(o.sample_collected_at, o.created_at))
ORDER BY date DESC, revenue DESC;

COMMENT ON VIEW v_analytics_location_performance IS 'Location-wise performance metrics including revenue, efficiency, and processing time';


-- =============================================
-- VIEW 8: Account (B2B) Performance
-- =============================================

CREATE OR REPLACE VIEW public.v_analytics_account_performance AS
SELECT 
  o.lab_id,
  o.account_id,
  a.name AS account_name,
  a.type AS account_type,
  DATE(COALESCE(o.sample_collected_at, o.created_at)) AS date,
  
  -- Volume
  COUNT(DISTINCT o.id) AS order_count,
  COUNT(DISTINCT o.patient_id) AS patient_count,
  
  -- Revenue
  COALESCE(SUM(i.total), 0) AS revenue,
  COALESCE(SUM(i.amount_paid), 0) AS collected,
  COALESCE(SUM(i.total - COALESCE(i.amount_paid, 0)), 0) AS outstanding_amount,
  
  -- Averages
  ROUND(COALESCE(SUM(i.total), 0)::numeric / NULLIF(COUNT(DISTINCT o.id), 0), 2) AS avg_order_value,
  
  -- Credit period compliance
  ROUND(AVG(
    EXTRACT(EPOCH FROM (COALESCE(p.created_at, NOW()) - i.created_at)) / 86400
  )::numeric, 0) AS avg_payment_days

FROM orders o
JOIN accounts a ON a.id = o.account_id
LEFT JOIN invoices i ON i.order_id = o.id
LEFT JOIN payments p ON p.invoice_id = i.id
WHERE o.lab_id IS NOT NULL AND o.account_id IS NOT NULL
GROUP BY o.lab_id, o.account_id, a.name, a.type, DATE(COALESCE(o.sample_collected_at, o.created_at))
ORDER BY date DESC, revenue DESC;

COMMENT ON VIEW v_analytics_account_performance IS 'B2B account performance with revenue, outstanding, and payment behavior metrics';


-- =============================================
-- VIEW 9: Outsourced Lab Summary
-- =============================================

CREATE OR REPLACE VIEW public.v_analytics_outsourced_summary AS
SELECT 
  ot.lab_id,
  ot.outsourced_lab_id,
  ol.name AS outsourced_lab_name,
  DATE(o.created_at) AS date,
  
  -- Volume
  COUNT(DISTINCT ot.id) AS test_count,
  COUNT(DISTINCT o.id) AS order_count,
  
  -- Cost & Revenue
  COALESCE(SUM(olp.cost), 0) AS cost,
  COALESCE(SUM(COALESCE(ot.price, tg.price)), 0) AS revenue,
  COALESCE(SUM(COALESCE(ot.price, tg.price)), 0) - COALESCE(SUM(olp.cost), 0) AS margin,
  
  -- Margin percentage
  ROUND(
    (COALESCE(SUM(COALESCE(ot.price, tg.price)), 0) - COALESCE(SUM(olp.cost), 0))::numeric /
    NULLIF(COALESCE(SUM(COALESCE(ot.price, tg.price)), 0), 0) * 100
  , 1) AS margin_percentage,
  
  -- Pending results count
  COUNT(CASE WHEN r.id IS NULL OR r.status NOT IN ('Approved', 'Reported') THEN 1 END) AS pending_results,
  
  -- Average TAT
  ROUND(AVG(
    CASE WHEN r.entered_date IS NOT NULL THEN
      EXTRACT(EPOCH FROM (r.entered_date - o.created_at)) / 3600
    END
  )::numeric, 1) AS avg_tat_hours

FROM order_tests ot
JOIN orders o ON o.id = ot.order_id
JOIN outsourced_labs ol ON ol.id = ot.outsourced_lab_id
LEFT JOIN test_groups tg ON tg.id = ot.test_group_id
LEFT JOIN outsourced_lab_prices olp ON olp.outsourced_lab_id = ot.outsourced_lab_id 
  AND olp.test_group_id = ot.test_group_id
LEFT JOIN results r ON r.order_test_id = ot.id
WHERE ot.outsourced_lab_id IS NOT NULL AND ot.lab_id IS NOT NULL
GROUP BY ot.lab_id, ot.outsourced_lab_id, ol.name, DATE(o.created_at)
ORDER BY date DESC, revenue DESC;

COMMENT ON VIEW v_analytics_outsourced_summary IS 'Outsourced lab metrics including cost, revenue, margin, and TAT analysis';


-- =============================================
-- VIEW 10: Critical Alerts
-- =============================================

CREATE OR REPLACE VIEW public.v_analytics_critical_alerts AS
SELECT 
  o.lab_id,
  o.id AS order_id,
  o.patient_id,
  p.name AS patient_name,
  p.phone AS patient_phone,
  tg.name AS test_name,
  a.name AS analyte_name,
  rv.value,
  rv.unit,
  COALESCE(la.reference_range, a.reference_range) AS reference_range,
  rv.flag,
  r.entered_date AS result_date,
  
  -- Doctor info
  d.name AS doctor_name,
  d.phone AS doctor_phone,
  
  -- Time since result
  ROUND(
    EXTRACT(EPOCH FROM (NOW() - r.entered_date)) / 3600
  , 1) AS hours_since_result,
  
  -- Notification status (if you have notification tracking)
  FALSE AS is_notified -- Placeholder - connect to actual notification system

FROM orders o
JOIN patients p ON p.id = o.patient_id
JOIN results r ON r.order_id = o.id
JOIN result_values rv ON rv.result_id = r.id
JOIN analytes a ON a.id = rv.analyte_id
JOIN order_tests ot ON ot.id = r.order_test_id
JOIN test_groups tg ON tg.id = ot.test_group_id
LEFT JOIN lab_analytes la ON la.analyte_id = a.id AND la.lab_id = o.lab_id
LEFT JOIN doctors d ON d.id = o.doctor::uuid
WHERE rv.flag IN ('C', 'H', 'L')
  AND o.lab_id IS NOT NULL
ORDER BY 
  CASE rv.flag WHEN 'C' THEN 1 WHEN 'H' THEN 2 WHEN 'L' THEN 3 END,
  r.entered_date DESC;

COMMENT ON VIEW v_analytics_critical_alerts IS 'Critical and abnormal results requiring attention with patient and doctor contact info';


-- =============================================
-- VIEW 11: Patient Demographics
-- =============================================

CREATE OR REPLACE VIEW public.v_analytics_patient_demographics AS
SELECT 
  o.lab_id,
  DATE(COALESCE(o.sample_collected_at, o.created_at)) AS date,
  
  -- Gender breakdown
  COALESCE(p.gender::text, 'Unknown') AS gender,
  
  -- Age groups
  CASE 
    WHEN p.age IS NULL THEN 'Unknown'
    WHEN p.age::text ~ '^\d+$' THEN
      CASE 
        WHEN p.age::int < 1 THEN 'Infant (<1)'
        WHEN p.age::int BETWEEN 1 AND 12 THEN 'Child (1-12)'
        WHEN p.age::int BETWEEN 13 AND 19 THEN 'Teen (13-19)'
        WHEN p.age::int BETWEEN 20 AND 39 THEN 'Adult (20-39)'
        WHEN p.age::int BETWEEN 40 AND 59 THEN 'Middle Age (40-59)'
        ELSE 'Senior (60+)'
      END
    ELSE 'Unknown'
  END AS age_group,
  
  -- Counts
  COUNT(DISTINCT p.id) AS patient_count,
  COUNT(DISTINCT o.id) AS order_count,
  COALESCE(SUM(i.total), 0) AS revenue

FROM orders o
JOIN patients p ON p.id = o.patient_id
LEFT JOIN invoices i ON i.order_id = o.id
WHERE o.lab_id IS NOT NULL
GROUP BY o.lab_id, DATE(COALESCE(o.sample_collected_at, o.created_at)), 
  COALESCE(p.gender::text, 'Unknown'),
  CASE 
    WHEN p.age IS NULL THEN 'Unknown'
    WHEN p.age::text ~ '^\d+$' THEN
      CASE 
        WHEN p.age::int < 1 THEN 'Infant (<1)'
        WHEN p.age::int BETWEEN 1 AND 12 THEN 'Child (1-12)'
        WHEN p.age::int BETWEEN 13 AND 19 THEN 'Teen (13-19)'
        WHEN p.age::int BETWEEN 20 AND 39 THEN 'Adult (20-39)'
        WHEN p.age::int BETWEEN 40 AND 59 THEN 'Middle Age (40-59)'
        ELSE 'Senior (60+)'
      END
    ELSE 'Unknown'
  END
ORDER BY date DESC, patient_count DESC;

COMMENT ON VIEW v_analytics_patient_demographics IS 'Patient demographic distribution by gender and age group for population analysis';


-- =============================================
-- VIEW 12: Hourly Order Distribution
-- =============================================

CREATE OR REPLACE VIEW public.v_analytics_hourly_distribution AS
SELECT 
  lab_id,
  DATE(created_at) AS date,
  EXTRACT(HOUR FROM created_at)::int AS hour,
  COUNT(*) AS order_count,
  ROUND(AVG(total_amount), 2) AS avg_order_value
FROM orders
WHERE lab_id IS NOT NULL
GROUP BY lab_id, DATE(created_at), EXTRACT(HOUR FROM created_at)
ORDER BY date DESC, hour;

COMMENT ON VIEW v_analytics_hourly_distribution IS 'Order volume distribution by hour for identifying peak times';


-- =============================================
-- VIEW 13: Payment Method Distribution
-- =============================================

CREATE OR REPLACE VIEW public.v_analytics_payment_methods AS
SELECT 
  p.lab_id,
  DATE(p.created_at) AS date,
  p.payment_method,
  COUNT(*) AS transaction_count,
  SUM(p.amount) AS total_amount,
  ROUND(AVG(p.amount), 2) AS avg_amount,
  ROUND(
    SUM(p.amount)::numeric / NULLIF(SUM(SUM(p.amount)) OVER (PARTITION BY p.lab_id, DATE(p.created_at)), 0) * 100
  , 1) AS percentage
FROM payments p
WHERE p.lab_id IS NOT NULL
GROUP BY p.lab_id, DATE(p.created_at), p.payment_method
ORDER BY date DESC, total_amount DESC;

COMMENT ON VIEW v_analytics_payment_methods IS 'Payment method distribution with transaction counts and percentages';


-- =============================================
-- VIEW 14: Revenue Trend (Weekly/Monthly)
-- =============================================

CREATE OR REPLACE VIEW public.v_analytics_revenue_trend AS
SELECT 
  lab_id,
  DATE_TRUNC('week', created_at)::date AS week_start,
  DATE_TRUNC('month', created_at)::date AS month_start,
  COUNT(DISTINCT order_id) AS order_count,
  SUM(COALESCE(total_before_discount, total)) AS gross_revenue,
  SUM(COALESCE(total_after_discount, total)) AS net_revenue,
  SUM(amount_paid) AS collected,
  SUM(COALESCE(total_after_discount, total) - COALESCE(amount_paid, 0)) AS outstanding
FROM invoices
WHERE lab_id IS NOT NULL
GROUP BY lab_id, DATE_TRUNC('week', created_at), DATE_TRUNC('month', created_at)
ORDER BY week_start DESC;

COMMENT ON VIEW v_analytics_revenue_trend IS 'Weekly and monthly revenue aggregation for trend analysis';


-- =============================================
-- VIEW 15: Sample Type Distribution
-- =============================================

CREATE OR REPLACE VIEW public.v_analytics_sample_types AS
SELECT 
  o.lab_id,
  DATE(COALESCE(o.sample_collected_at, o.created_at)) AS date,
  tg.sample_type,
  tg.sample_color,
  COUNT(DISTINCT o.id) AS order_count,
  COUNT(DISTINCT ot.id) AS test_count
FROM orders o
JOIN order_tests ot ON ot.order_id = o.id
JOIN test_groups tg ON tg.id = ot.test_group_id
WHERE o.lab_id IS NOT NULL AND tg.sample_type IS NOT NULL
GROUP BY o.lab_id, DATE(COALESCE(o.sample_collected_at, o.created_at)), tg.sample_type, tg.sample_color
ORDER BY date DESC, test_count DESC;

COMMENT ON VIEW v_analytics_sample_types IS 'Sample type distribution for inventory and resource planning';


-- =============================================
-- GRANT PERMISSIONS
-- =============================================

GRANT SELECT ON v_analytics_kpi_summary TO authenticated;
GRANT SELECT ON v_analytics_kpi_summary TO anon;

GRANT SELECT ON v_analytics_revenue_daily TO authenticated;
GRANT SELECT ON v_analytics_revenue_daily TO anon;

GRANT SELECT ON v_analytics_orders_by_department TO authenticated;
GRANT SELECT ON v_analytics_orders_by_department TO anon;

GRANT SELECT ON v_analytics_orders_by_status TO authenticated;
GRANT SELECT ON v_analytics_orders_by_status TO anon;

GRANT SELECT ON v_analytics_test_popularity TO authenticated;
GRANT SELECT ON v_analytics_test_popularity TO anon;

GRANT SELECT ON v_analytics_tat_summary TO authenticated;
GRANT SELECT ON v_analytics_tat_summary TO anon;

GRANT SELECT ON v_analytics_location_performance TO authenticated;
GRANT SELECT ON v_analytics_location_performance TO anon;

GRANT SELECT ON v_analytics_account_performance TO authenticated;
GRANT SELECT ON v_analytics_account_performance TO anon;

GRANT SELECT ON v_analytics_outsourced_summary TO authenticated;
GRANT SELECT ON v_analytics_outsourced_summary TO anon;

GRANT SELECT ON v_analytics_critical_alerts TO authenticated;
GRANT SELECT ON v_analytics_critical_alerts TO anon;

GRANT SELECT ON v_analytics_patient_demographics TO authenticated;
GRANT SELECT ON v_analytics_patient_demographics TO anon;

GRANT SELECT ON v_analytics_hourly_distribution TO authenticated;
GRANT SELECT ON v_analytics_hourly_distribution TO anon;

GRANT SELECT ON v_analytics_payment_methods TO authenticated;
GRANT SELECT ON v_analytics_payment_methods TO anon;

GRANT SELECT ON v_analytics_revenue_trend TO authenticated;
GRANT SELECT ON v_analytics_revenue_trend TO anon;

GRANT SELECT ON v_analytics_sample_types TO authenticated;
GRANT SELECT ON v_analytics_sample_types TO anon;


-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Create indexes on base tables if they don't exist (for analytics queries)
CREATE INDEX IF NOT EXISTS idx_orders_lab_sample_collected ON orders(lab_id, sample_collected_at);
CREATE INDEX IF NOT EXISTS idx_orders_lab_created ON orders(lab_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_lab_location ON orders(lab_id, location_id);
CREATE INDEX IF NOT EXISTS idx_orders_lab_account ON orders(lab_id, account_id);
CREATE INDEX IF NOT EXISTS idx_invoices_lab_created ON invoices(lab_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payments_lab_created ON payments(lab_id, created_at);
CREATE INDEX IF NOT EXISTS idx_result_values_flag ON result_values(flag) WHERE flag IN ('C', 'H', 'L');
