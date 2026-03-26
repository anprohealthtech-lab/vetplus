-- Update the specific template for FBS+PPBS+HBA1C
-- Replaces the short interpretation block with a detailed table and note,
-- and ensures this block is placed ABOVE the signatory section.

UPDATE lab_templates
SET 
  gjs_html = $html$
<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8'>
    <title>FBS+PPBS+HBA1C Lab Report</title>
    <link href='https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap' rel='stylesheet'>
</head>
<body>
    <div class='report-container'>
      <div class='report-header'>
         <h1>FBS+PPBS+HBA1C</h1>
         <div class='report-subtitle'>Laboratory Test Report</div>
      </div>
      
      <div class='report-body'>
         <div class='section-header'>Patient Information</div>
         <table class='patient-info'>
           <tbody>
             <tr>
               <td class='label'>Patient Name</td> <td class='value'>{{patientName}}</td>
               <td class='label'>Patient ID</td> <td class='value'>{{patientId}}</td>
             </tr>
             <tr>
               <td class='label'>Age / Gender</td> <td class='value'>{{patientAge}} / {{patientGender}}</td>
               <td class='label'>Sample ID</td> <td class='value'>{{sampleId}}</td>
             </tr>
             <tr>
               <td class='label'>Ref. Doctor</td> <td class='value'>{{referringDoctorName}}</td>
               <td class='label'>Collected On</td> <td class='value'>{{collectionDate}}</td>
             </tr>
           </tbody>
         </table>
         
         <div class='section-header'>Test Results</div>
         <table class='report-table'>
           <thead>
             <tr>
               <th>Test Parameter</th>
               <th class='col-center'>Result</th>
               <th class='col-center'>Unit</th>
               <th>Reference Range</th>
               <th class='col-center'>Flag</th>
             </tr>
           </thead>
           <tbody>
             <tr>
               <td class='param-name'>Fasting Blood Sugar</td> 
               <td class='col-center value-optimal'>{{ANALYTE_FBS_VALUE}}</td> 
               <td class='col-center'>{{ANALYTE_FBS_UNIT}}</td> 
               <td>{{ANALYTE_FBS_REFERENCE}}</td> 
               <td class='col-center'>{{ANALYTE_FBS_FLAG}}</td>
             </tr>
             <tr>
               <td class='param-name'>Postprandial Blood Sugar</td> 
               <td class='col-center value-optimal'>{{ANALYTE_PPBS_VALUE}}</td> 
               <td class='col-center'>{{ANALYTE_PPBS_UNIT}}</td> 
               <td>{{ANALYTE_PPBS_REFERENCE}}</td> 
               <td class='col-center'>{{ANALYTE_PPBS_FLAG}}</td>
             </tr>
             <tr>
               <td class='param-name'>Glycated Hemoglobin (HbA1c)</td> 
               <td class='col-center value-optimal'>{{ANALYTE_HBA1C_VALUE}}</td> 
               <td class='col-center'>{{ANALYTE_HBA1C_UNIT}}</td> 
               <td>{{ANALYTE_HBA1C_REFERENCE}}</td> 
               <td class='col-center'>{{ANALYTE_HBA1C_FLAG}}</td>
             </tr>
           </tbody>
         </table>
         
         <div class="section-header" style="margin-top:20px;">Clinical Interpretation</div>
         <figure class="table">
          <table class="tbl-interpretation" style="width:100%; border:1px solid #e5e7eb; border-collapse: collapse;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:8px; text-align:left; border:1px solid #e5e7eb; font-weight:bold;">Level</th>
                <th style="padding:8px; text-align:left; border:1px solid #e5e7eb; font-weight:bold;">Meaning & Potential Causes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding:8px; border:1px solid #e5e7eb; font-weight:bold;">Diabetes</td>
                <td style="padding:8px; border:1px solid #e5e7eb;">HbA1c ≥6.5%, FBS ≥126 mg/dL, or PPBS ≥200 mg/dL suggests diabetes. Indicates chronic elevated blood glucose levels over past 2-3 months. Requires comprehensive medical evaluation and potential lifestyle/treatment modifications.</td>
              </tr>
              <tr>
                <td style="padding:8px; border:1px solid #e5e7eb; font-weight:bold;">Prediabetes</td>
                <td style="padding:8px; border:1px solid #e5e7eb;">HbA1c 5.7-6.4%, FBS 100-125 mg/dL, or PPBS 140-199 mg/dL indicates increased risk of developing diabetes. Suggests potential insulin resistance and metabolic changes. Lifestyle interventions may help prevent progression.</td>
              </tr>
              <tr>
                <td style="padding:8px; border:1px solid #e5e7eb; font-weight:bold;">Normal</td>
                <td style="padding:8px; border:1px solid #e5e7eb;">HbA1c <5.7%, FBS <100 mg/dL, and PPBS <140 mg/dL suggest good glycemic control. Indicates effective glucose metabolism and low diabetes risk. Continue maintaining healthy lifestyle practices.</td>
              </tr>
            </tbody>
          </table>
         </figure>

         <div class="note" style="margin-top:15px; font-size:12px; color:#64748b;">
          <strong>Note on Reference Ranges:</strong> Diabetes screening thresholds may vary slightly between laboratories and populations. Always interpret using the specific reference range provided.
          <br><br>
          <strong>Additional Note:</strong> Factors like recent illness, stress, medication, pregnancy, and certain medical conditions can affect glucose and HbA1c results. Serial testing and clinical correlation are recommended for accurate assessment.
         </div>
         
         <div class='report-footer'>
           <div class='signatures'>
              <p style='font-weight:bold; margin-bottom:4px;'>{{signatoryName}}</p>
              <p style='font-size:11px; color:#64748b;'>{{signatoryDesignation}}</p>
           </div>
         </div>
      </div>
    </div>
</body>
</html>
$html$,
  updated_at = NOW()
WHERE 
  test_name = 'FBS+PPBS+HBA1C' 
  OR test_name LIKE '%FBS+PPBS+HBA1C%';
