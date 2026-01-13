-- Mass update script for Clinical Interpretation blocks in lab_templates
-- Approach:
-- 1. Define a temporary table with the Test Name Pattern and the specific HTML content to inject.
-- 2. Iterate through all lab_templates.
-- 3. If a template matches a pattern, remove the old 'interpretation' div and inject the new content before the footer.

DO $$
DECLARE
  rec RECORD;
  template_rec RECORD;
  current_html TEXT;
  cleaned_html TEXT;
  final_html TEXT;
  new_content TEXT;
  affected_row_count INT := 0;
BEGIN

  -- 1. Create a temporary table to hold our mappings
  CREATE TEMP TABLE temp_interpretation_map (
    test_pattern TEXT,
    html_content TEXT
  );

  -- 2. Insert the specific mappings provided by the user
  
  -- MAPPING 1: Cancer Karyotyping
  INSERT INTO temp_interpretation_map (test_pattern, html_content) VALUES (
    '%Cancer Karyotyping%',
    '<div class="section-header">Clinical Interpretation</div>
<figure class="table">
  <table class="tbl-interpretation">
    <thead>
      <tr>
        <th>Level</th>
        <th>Meaning & Potential Causes</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Normal</td>
        <td>Normal diploid karyotype (46,XX or 46,XY) indicates no observable chromosomal abnormalities. Suggests absence of significant structural or numerical chromosome changes associated with cancer development. Correlate with clinical findings.</td>
      </tr>
      <tr>
        <td>Abnormal</td>
        <td>Chromosomal variations may indicate potential cancer-related genetic changes. These can include numerical abnormalities (aneuploidy), structural changes (translocations, deletions, insertions), which may be associated with specific cancer types and potential prognostic implications. Requires detailed clinical correlation.</td>
      </tr>
    </tbody>
  </table>
</figure>

<div class="note">
  <strong>Note on Reference Ranges:</strong> Karyotyping is a descriptive genetic analysis, not a quantitative test. Results are interpreted based on chromosomal structure and number, not traditional reference ranges.
  <br><br>
  <strong>Additional Note:</strong> Chromosomal analysis provides insights into genetic alterations that may contribute to cancer development. Interpretation should always be performed by a qualified cytogeneticist or oncologist in the context of the patient''s complete clinical picture.
</div>'
  );

  -- MAPPING 2: FBS+PPBS+HBA1C
  INSERT INTO temp_interpretation_map (test_pattern, html_content) VALUES (
    '%FBS+PPBS+HBA1C%',
    '<div class="section-header">Clinical Interpretation</div>
<figure class="table">
  <table class="tbl-interpretation">
    <thead>
      <tr>
        <th>Level</th>
        <th>Meaning & Potential Causes</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Diabetes</td>
        <td>HbA1c ≥6.5%, FBS ≥126 mg/dL, or PPBS ≥200 mg/dL suggests diabetes. Indicates chronic elevated blood glucose levels over past 2-3 months. Requires comprehensive medical evaluation and potential lifestyle/treatment modifications.</td>
      </tr>
      <tr>
        <td>Prediabetes</td>
        <td>HbA1c 5.7-6.4%, FBS 100-125 mg/dL, or PPBS 140-199 mg/dL indicates increased risk of developing diabetes. Suggests potential insulin resistance and metabolic changes. Lifestyle interventions may help prevent progression.</td>
      </tr>
      <tr>
        <td>Normal</td>
        <td>HbA1c <5.7%, FBS <100 mg/dL, and PPBS <140 mg/dL suggest good glycemic control. Indicates effective glucose metabolism and low diabetes risk. Continue maintaining healthy lifestyle practices.</td>
      </tr>
    </tbody>
  </table>
</figure>

<div class="note">
  <strong>Note on Reference Ranges:</strong> Diabetes screening thresholds may vary slightly between laboratories and populations. Always interpret using the specific reference range provided.
  <br><br>
  <strong>Additional Note:</strong> Factors like recent illness, stress, medication, pregnancy, and certain medical conditions can affect glucose and HbA1c results. Serial testing and clinical correlation are recommended for accurate assessment.
</div>'
  );

  -- MAPPING 3: Torrent Routine Package
  INSERT INTO temp_interpretation_map (test_pattern, html_content) VALUES (
    '%Torrent Routine%',
    '<div class="section-header">Clinical Interpretation</div>
<figure class="table">
  <table class="tbl-interpretation">
    <thead>
      <tr>
        <th>Level</th>
        <th>Meaning & Potential Causes</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Normal</td>
        <td>Results within expected reference ranges suggest good overall health status. Individual parameters within normal limits indicate typical physiological function. Routine monitoring recommended.</td>
      </tr>
      <tr>
        <td>Borderline</td>
        <td>Some parameters near upper or lower limits of reference range. May suggest potential health trends or mild metabolic variations. Recommend lifestyle assessment and follow-up testing.</td>
      </tr>
      <tr>
        <td>High</td>
        <td>Elevated results in certain parameters may indicate potential metabolic, inflammatory, or systemic variations. Requires clinical correlation and potential further diagnostic investigation.</td>
      </tr>
      <tr>
        <td>Low</td>
        <td>Decreased results in specific parameters might suggest nutritional deficiencies, metabolic imbalances, or systemic conditions. Comprehensive clinical evaluation recommended.</td>
      </tr>
    </tbody>
  </table>
</figure>

<div class="note">
  <strong>Note on Reference Ranges:</strong> Reference ranges are specific to the laboratory performing the test and may vary depending on population, methodology, and instrumentation. Results should be interpreted by a qualified physician in the context of the patient''s clinical history and other diagnostic findings.
  <br><br>
  <strong>Additional Note:</strong> Factors such as age, sex, diet, physical activity, medication, stress, and recent illness can influence test results. Individual variations are common, and serial testing may help establish baseline trends.
</div>'
  );


  -- 3. Loop through the mapping table and apply updates
  FOR rec IN SELECT * FROM temp_interpretation_map LOOP
    
    FOR template_rec IN 
      SELECT id, gjs_html, test_name 
      FROM lab_templates 
      WHERE test_name ILIKE rec.test_pattern
    LOOP
      
      current_html := template_rec.gjs_html;
      
      -- A. Remove the old "simple" interpretation block
      -- Regex aims to match: <div class="interpretation" ... > content </div>
      -- We use [^>]* to matching attributes like style or id.
      -- [\s\S]*? is non-greedy match for any character including newlines.
      cleaned_html := regexp_replace(current_html, '<div class="interpretation"[^>]*>[\s\S]*?</div>', '', 'g');
      
      -- B. Inject the new content BEFORE the footer
      -- We assume standard <div class="report-footer"> structure.
      IF position('<div class="report-footer">' in cleaned_html) > 0 THEN
         final_html := replace(cleaned_html, '<div class="report-footer">', rec.html_content || E'\n     <div class="report-footer">');
         
         -- C. Update the record
         UPDATE lab_templates
         SET gjs_html = final_html
         WHERE id = template_rec.id;
         
         affected_row_count := affected_row_count + 1;
         RAISE NOTICE 'Updated template "%" (ID: %)', template_rec.test_name, template_rec.id;
      ELSE
         RAISE NOTICE 'Skipping "%" (ID: %): Could not find .report-footer anchor.', template_rec.test_name, template_rec.id;
      END IF;
      
    END LOOP;

  END LOOP;

  -- 4. Clean up
  DROP TABLE temp_interpretation_map;
  
  RAISE NOTICE 'Migration Complete. Total templates updated: %', affected_row_count;

END $$;
