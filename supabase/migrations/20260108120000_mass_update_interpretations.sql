-- Mass update script for Clinical Interpretation blocks in lab_templates
-- Logic:
-- 1. Identify templates that have the simple "Clinical Interpretation" block: <div class="interpretation"...>...</div>
-- 2. Identify templates that have a corresponding "NEW" interpretation block defined in a temporary mapping table.
-- 3. Perform a REPLACE on the gjs_html column to:
--    a. Remove the old <div class="interpretation"...>...</div> block.
--    b. Insert the NEW content (Interpretation Table + Note) immediately before <div class="report-footer">.

DO $$
DECLARE
  template_record RECORD;
  new_interpretation_content TEXT;
  target_html TEXT;
  cleaned_html TEXT;
  final_html TEXT;
  updated_count INTEGER := 0;
BEGIN

  -- Define a temporary mapping of Test Name -> New Interpretation HTML Content
  -- This allows us to handle different interpretation tables for different tests if needed, 
  -- or use a generic one if the structure is uniform but content differs.
  -- For now, based on User input, I will apply logic to REPLACE the old block with the new one 
  -- IF we can find the old block.
  
  -- Iterating over templates that have the "interpretation" class
  FOR template_record IN 
    SELECT id, test_name, gjs_html 
    FROM lab_templates 
    WHERE gjs_html LIKE '%class="interpretation"%'
      AND gjs_html LIKE '%report-footer%' -- Ensure we have a footer to anchor to
  LOOP
    
    -- Determine the CONTENT to insert based on the test name
    -- Examples from user request:
    
    IF template_record.test_name ILIKE '%FBS%' OR template_record.test_name ILIKE '%HBA1C%' THEN
        new_interpretation_content := '<div class="section-header">Clinical Interpretation</div>
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
</div>';
        
    ELSIF template_record.test_name ILIKE '%Karyotyping%' OR template_record.test_name ILIKE '%Cancer%' THEN
        new_interpretation_content := '<div class="section-header">Clinical Interpretation</div>
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
</div>';

    ELSE
        -- Skip if we don't have a specific map for this test type
        CONTINUE;
    END IF;

    -- PERFORM THE REPLACEMENT
    target_html := template_record.gjs_html;
    
    -- 1. Remove the old interpretation block (Regex replacement is tricky in pure SQL basic REPLACE, 
    -- so we use regexp_replace).
    -- Matches <div class="interpretation" ... > ... </div> (This is greedy/fragile in SQL regex, assume standard structure)
    -- We assume the div starts with <div class="interpretation" and ends with </div> before footer.
    
    -- Using a safer method: removing the block by its container signature if possible, or just appending PRE-FOOTER?
    -- User said: "replace above short clinicla intepretation part with below block".
    -- Let's use regexp_replace to remove the old block.
    -- Pattern: <div class="interpretation"[^>]*>.*?</div> (non-greedy match for content)
    -- Note: Postgres regex 'g' flag for global if multiple? No, just one. 'n' for newline matching? s for dot-matches-newline.
    
    -- Remove old block
    cleaned_html := regexp_replace(target_html, '<div class="interpretation"[^>]*>[\s\S]*?</div>', '', 'g');
    
    -- 2. Insert NEW content before <div class="report-footer">
    final_html := replace(cleaned_html, '<div class="report-footer">', new_interpretation_content || E'\n     <div class="report-footer">');
    
    -- Update the record
    UPDATE lab_templates 
    SET gjs_html = final_html 
    WHERE id = template_record.id;
    
    updated_count := updated_count + 1;
    RAISE NOTICE 'Updated template: % (ID: %)', template_record.test_name, template_record.id;
    
  END LOOP;

  RAISE NOTICE 'Total templates updated: %', updated_count;
END $$;
