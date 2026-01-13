-- Update CSS for all table-based report templates
-- This applies modern, professional styling with blue theme

UPDATE lab_templates
SET 
  gjs_css = ':root {
  --primary-blue:#0b4aa2;
  --light-blue:#eaf2ff;
  --success-green:#12b76a;
  --warning-amber:#f79009;
  --danger-red:#d92d20;
  --text-dark:#1f2937;
  --text-muted:#64748b;
  --border-light:#e5ecf6;
  --row-alt:#f7faff;
  --page-bg:#f4f7fb;
  --card-bg:#ffffff;
}

body {
  margin:0;
  padding:16px;
  font-family: Inter, sans-serif;
  color:var(--text-dark);
  background:var(--page-bg);
}

.report-container {
  max-width:900px;
  margin:0 auto;
  background:var(--card-bg);
  border-radius:14px;
  overflow:hidden;
  border:1px solid var(--border-light);
  box-shadow:0 8px 24px rgba(0,60,120,.08);
}

.report-header {
  background-color:var(--primary-blue) !important;
  color:#fff !important;
  padding:12px 16px;
}

.report-header h1 {
  margin:0;
  font-size:20px;
  font-weight:800;
}

.report-header .report-subtitle {
  margin-top:4px;
  font-size:13px;
  opacity:.92;
}

.report-body {
  padding:14px 16px 16px;
}

.section-header {
  background-color:var(--light-blue) !important;
  color:var(--primary-blue) !important;
  padding:8px 12px;
  border-radius:8px;
  font-weight:800;
  font-size:15px;
  margin:12px 0 8px;
  border:1px solid rgba(11,74,162,.12);
}

.patient-info,
.report-table {
  width:100%;
  border-collapse:separate;
  border-spacing:0;
  background:#fff;
  border:1px solid var(--border-light);
  border-radius:12px;
  overflow:hidden;
  font-size:13px;
}

/* Added: keeps columns tidy without fixed widths */
.patient-info {
  table-layout:fixed;
}

.patient-info td,
.report-table td {
  padding:7px 10px;
  border-bottom:1px solid var(--border-light);
  vertical-align:middle;
}

/* Added: prevents long text from blowing layout */
.patient-info td {
  word-break:break-word;
}

.patient-info td.label {
  color:var(--text-muted);
  font-weight:700;
  background:#fbfdff;
}

.patient-info td.value {
  font-weight:700;
  color:var(--text-dark);
}

.report-table thead th {
  background-color:var(--primary-blue) !important;
  color:#fff !important;
  padding:8px 10px;
  text-align:left;
  font-weight:800;
  font-size:13px;
}

.report-table tbody tr:nth-child(even) {
  background:var(--row-alt);
}

.param-name {
  font-weight:800;
  color:#0f172a;
}

.col-center {
  text-align:center;
}

.value-high {
  color:var(--danger-red);
  font-weight:900;
}

.value-borderline {
  color:var(--warning-amber);
  font-weight:900;
}

.value-optimal {
  color:var(--success-green);
  font-weight:900;
}

.patient-info tr:last-child td,
.report-table tbody tr:last-child td {
  border-bottom:none;
}

.notes{
  margin-top:12px;
  padding:10px 12px;
  font-size:12px;
  color:var(--text-muted);
  background:#fbfdff;
  border:1px solid var(--border-light);
  border-left:4px solid var(--primary-blue);
  border-radius:10px;
}

.report-footer{
  margin-top:14px;
  padding-top:10px;
  border-top:1px solid var(--border-light);
  font-size:12px;
  color:var(--text-muted);
  text-align:center;
}',
  updated_at = NOW()
WHERE 
  -- Update all templates that contain table elements
  gjs_html LIKE '%<table%'
  OR gjs_html LIKE '%report-table%'
  OR gjs_html LIKE '%patient-info%'
  -- Or update ALL templates (uncomment the line below and comment the above)
  -- id IS NOT NULL
;

-- Log the number of templates updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated CSS for % template(s)', updated_count;
END $$;
