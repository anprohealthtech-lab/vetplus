-- Update group_interpretation fields with compact, CSS-safe HTML
-- Rules applied to avoid PDF rendering overrides:
--   • <div> used instead of <p>  (avoids .limsv2-report p { margin: 0 0 0.5rem } override)
--   • <strong>/<b> used instead of <h3>/<h4>  (avoids .group-interpretation h1-h6 { font-size:13px } override)
--   • font-size:11px set on the outer wrapper <div>  (no CSS rule targets div inside .group-interpretation)
--   • line-height:1.4 and tight div margins keep everything compact


-- ─── Iron Studies ────────────────────────────────────────────────────────────
UPDATE test_groups SET group_interpretation = $html$<div style="font-size:11px;line-height:1.4;color:#222;">
<div style="margin:0 0 4px;">Iron determinations are performed for the diagnosis &amp; monitoring of microcytic hypochromic diseases (iron deficiency anemia, hemochromatosis, chronic renal disease), macrocytic, normocytic, hemolytic anemia, hemoglobinopathies, and bone marrow disorders. <strong>Interpret all parameters together as a whole — not as isolated tests.</strong></div>
<table style="width:100%;border-collapse:collapse;font-size:10.5px;">
  <thead>
    <tr style="background:#eef2f7;">
      <td style="padding:2px 5px;border:0.5px solid #ccc;font-weight:700;">Condition</td>
      <td style="padding:2px 5px;border:0.5px solid #ccc;font-weight:700;text-align:center;">S.Iron</td>
      <td style="padding:2px 5px;border:0.5px solid #ccc;font-weight:700;text-align:center;">TIBC</td>
      <td style="padding:2px 5px;border:0.5px solid #ccc;font-weight:700;text-align:center;">%Sat</td>
      <td style="padding:2px 5px;border:0.5px solid #ccc;font-weight:700;text-align:center;">Ferritin</td>
      <td style="padding:2px 5px;border:0.5px solid #ccc;font-weight:700;text-align:center;">Hb Electro</td>
      <td style="padding:2px 5px;border:0.5px solid #ccc;font-weight:700;text-align:center;">Smear</td>
    </tr>
  </thead>
  <tbody>
    <tr><td style="padding:2px 5px;border:0.5px solid #ccc;font-weight:600;">Iron Deficiency Anemia</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Low</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">High</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Low</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Low</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Normal</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Micro/hypo</td></tr>
    <tr style="background:#fafafa;"><td style="padding:2px 5px;border:0.5px solid #ccc;font-weight:600;">Anemia of Chronic Disease</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Low</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Low</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Low</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Normal/High</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Normal</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Micro/hypo/Normal</td></tr>
    <tr><td style="padding:2px 5px;border:0.5px solid #ccc;font-weight:600;">Thalassemia</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Normal/High</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Normal</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Normal/High</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">High</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Abnormal</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Micro/hypo + target cells</td></tr>
    <tr style="background:#fafafa;"><td style="padding:2px 5px;border:0.5px solid #ccc;font-weight:600;">Sideroblastic Anemia</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Normal/High</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Normal/Low</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Normal/High</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">High</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Normal</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Micro/hypo/variable</td></tr>
    <tr><td style="padding:2px 5px;border:0.5px solid #ccc;font-weight:600;">Iron Overload (Hemochromatosis)</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">High</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Low</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">High</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">High</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Normal</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Variable</td></tr>
    <tr style="background:#fafafa;"><td style="padding:2px 5px;border:0.5px solid #ccc;font-weight:600;">Megaloblastic Anemia</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">High</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Low</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">High</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">High</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Normal</td><td style="padding:2px 5px;border:0.5px solid #ccc;text-align:center;">Macrocytic</td></tr>
  </tbody>
</table>
<div style="margin:3px 0 0;font-style:italic;font-size:10px;color:#666;">Ref: Harrison's Principles of Internal Medicine, Vol.1, 15th ed., p.663</div>
</div>$html$
WHERE id = '1bcaa487-d309-4711-9945-431c49820799';


-- ─── Vitamin B12 ─────────────────────────────────────────────────────────────
UPDATE test_groups SET group_interpretation = $html$<div style="font-size:11px;line-height:1.4;color:#222;">
<div style="margin:0 0 3px;">Vitamin B12 (corrin family) is a cofactor for myelin formation and, with folate, for DNA synthesis. Levels above 300–400 pg/mL are rarely associated with B12-deficiency hematological or neurological disease.</div>
<div style="margin:0 0 3px;">Deficiency causes <strong>Megaloblastic anemia (MA)</strong>, nerve damage, and spinal cord degeneration. Even mild deficiency damages the myelin sheath and may cause permanent nerve damage. The B12–MA relationship is not always direct — some MA patients have normal B12 and many B12-deficient individuals do not develop MA.</div>
<div style="margin:0 0 3px;"><strong>Causes:</strong> Nutritional, malabsorption syndromes, and gastrointestinal causes.</div>
<div style="margin:0 0 2px;"><strong>Decreased in:</strong> Iron deficiency, near-term pregnancy, vegetarianism, partial gastrectomy/ileal damage, celiac disease, oral contraceptives, parasitic competition, pancreatic deficiency, treated epilepsy, advancing age.</div>
<div style="margin:0;"><strong>Increased in:</strong> Renal failure, liver disease, myeloproliferative diseases. Increases with age. Transiently increased after certain drugs. Falsely high in deteriorated samples.</div>
</div>$html$
WHERE id = 'b2d0b0e3-00fb-49c9-bd37-0b1c9a439127';


-- ─── Thyroid Function Test (TFT) ─────────────────────────────────────────────
UPDATE test_groups SET group_interpretation = $html$<div style="font-size:11px;line-height:1.4;color:#222;">
<div style="margin:0 0 3px;">TSH is synthesized by the anterior pituitary via negative feedback from FT3 and FT4, with TRH from the hypothalamus as a direct stimulator. TSH drives thyroid T3 and T4 synthesis. TSH quantification differentiates <strong>primary hypothyroidism</strong> (elevated TSH) from <strong>secondary/tertiary hypothyroidism</strong> (low TSH).</div>
<div style="margin:0 0 4px;"><strong>Cautions:</strong> Sick or hospitalized patients may have falsely low or transiently elevated TSH. Patients exposed to animal antigens (environmental or via imaging/treatment) may have circulating anti-animal antibodies that interfere with assay reagents.</div>
<div style="margin:0 0 2px;"><strong>TSH Reference Ranges During Pregnancy:</strong></div>
<table style="border-collapse:collapse;font-size:10.5px;margin:0;">
  <tr><td style="padding:1px 10px 1px 0;font-weight:600;">1st Trimester:</td><td style="padding:1px 6px;">0.056 – 4.58 µIU/mL</td></tr>
  <tr><td style="padding:1px 10px 1px 0;font-weight:600;">2nd Trimester:</td><td style="padding:1px 6px;">0.28 – 4.20 µIU/mL</td></tr>
  <tr><td style="padding:1px 10px 1px 0;font-weight:600;">3rd Trimester:</td><td style="padding:1px 6px;">0.34 – 4.50 µIU/mL</td></tr>
</table>
</div>$html$
WHERE id = 'bc735255-077f-4926-9098-45987d199a9c';


-- ─── Blood Group [ABO + Rh] ───────────────────────────────────────────────────
UPDATE test_groups SET group_interpretation = $html$<div style="font-size:11px;line-height:1.4;color:#222;">
<div style="margin:0 0 3px;">This is a screening test performed on the received sample using monoclonal antisera Anti-A, Anti-B, and Anti-D at titres of 1:256, 1:256, and 1:512 respectively.</div>
<div style="margin:0;"><strong>Note:</strong> This report cannot be used for blood or blood product transfusion purposes. Confirmation must be performed at the time of transfusion, as certain conditions or diseases may cause loss or acquisition of a blood group antigen.</div>
</div>$html$
WHERE id = '74f1a421-3cce-46b9-894f-8310dcb7032f';


-- ─── WIDAL Tube Test ──────────────────────────────────────────────────────────
UPDATE test_groups SET group_interpretation = $html$<div style="font-size:11px;line-height:1.4;color:#222;">
<div style="margin:0 0 3px;"><em>Salmonella typhosa</em> possesses somatic 'O' antigen (cell wall) and flagellar 'H' antigen. <em>S. paratyphi</em> A &amp; B possess 'AH' and 'BH' antigens respectively. Specific antibodies are typically detectable in blood after 6 days of infection.</div>
<div style="margin:0 0 1px;">• Titre &gt;1:120 is significant. A rising titre indicates resistance to antibiotics currently in use.</div>
<div style="margin:0 0 1px;">• H titre is variable and may show non-specific response to other infections.</div>
<div style="margin:0 0 1px;">• Rise in O &amp; H titre above 1:240 is typical of enteric fever.</div>
<div style="margin:0 0 1px;">• Positive Widal may occur due to typhoid vaccination, previous infection, non-specific febrile illness, or autoimmune disease.</div>
<div style="margin:0;">• O titres may vary between different commercial antigen manufacturers.</div>
</div>$html$
WHERE id = '8d6ed1a1-3b63-4c8f-9d35-1b6c4d2a9001';


-- ─── Troponin I, Quantitative ─────────────────────────────────────────────────
UPDATE test_groups SET group_interpretation = $html$<div style="font-size:11px;line-height:1.4;color:#222;">
<div style="margin:0 0 3px;">The Dx Instacheck Tn-I Plus assay aids in the diagnosis of <strong>Myocardial Infarction (MI)</strong> and risk stratification of <strong>Acute Coronary Syndrome (ACS)</strong>. Serial testing is required for MI diagnosis.</div>
<div style="margin:0;"><strong>Note:</strong> Final diagnosis must be made in conjunction with ECG findings and the full clinical context of the patient.</div>
</div>$html$
WHERE id = '8a8a86e1-ee87-4a7c-8aa7-eb9a770e91ce';


-- ─── Hemoglobin A1c ───────────────────────────────────────────────────────────
UPDATE test_groups SET group_interpretation = $html$<div style="font-size:11px;line-height:1.4;color:#222;">
<div style="margin:0 0 3px;">HbA1c reflects the average plasma glucose concentration over the preceding 2–3 months via non-enzymatic glycation of hemoglobin. Once glycosylated, hemoglobin remains so for its 120-day lifespan, making HbA1c a reliable long-term glycemic index.</div>
<div style="margin:0 0 3px;"><strong>Diagnostic thresholds:</strong> IDF/ACE recommend &lt;6.5%; ADA recommends &lt;7.0% for most patients. An A1C ≥6.5% is diagnostic for diabetes (IDF/EASD/ADA Expert Committee). Gestational diabetes diagnosis still requires fasting and glucose tolerance tests — not HbA1c.</div>
<div style="margin:0 0 3px;"><strong>eAG formula:</strong> eAG (mg/dL) = 28.7 × A1C − 46.7</div>
<div style="margin:0 0 2px;"><strong>Lower than expected:</strong> Blood loss, transfusions, anemia, high erythrocyte turnover, chronic renal/liver disease, high-dose vitamin C, erythropoietin treatment, G6PD deficiency, sickle-cell disease, or any cause of premature RBC death.</div>
<div style="margin:0;"><strong>Higher than expected:</strong> Vitamin B12 or folate deficiency (prolonged RBC lifespan).</div>
</div>$html$
WHERE id = '806c34ce-a752-42a6-968f-44ed612a6cc3';


-- ─── G6PD, Quantitative ───────────────────────────────────────────────────────
UPDATE test_groups SET group_interpretation = $html$<div style="font-size:11px;line-height:1.4;color:#222;">
<div style="margin:0 0 3px;">G6PD activity decreases markedly as red cells age. In samples with a young RBC population (e.g., high reticulocytosis), activity may appear normal even in genetically deficient individuals.</div>
<div style="margin:0 0 3px;">During mild-to-moderate hemolytic episodes, older (more deficient) cells are preferentially destroyed. The replacement reticulocytes carry higher enzyme levels — testing immediately after a hemolytic episode may therefore yield <strong>falsely elevated</strong> results.</div>
<div style="margin:0 0 3px;">Acquired G6PD deficiency can occur in reticulocytopenia associated with pure red cell aplasia.</div>
<div style="margin:0;font-style:italic;font-size:10px;color:#666;">Ref: Practical Haematology, Dacie &amp; Lewis, 8th ed.</div>
</div>$html$
WHERE id = 'da57ddc6-9bbc-4823-b810-0519013bfd91';


-- ─── Lipid Profile ────────────────────────────────────────────────────────────
UPDATE test_groups SET group_interpretation = $html$<div style="font-size:11px;line-height:1.4;color:#222;">
<div style="margin:0 0 3px;"><strong>NCEP ATP III — Major CHD Risk Factors:</strong></div>
<div style="margin:0 0 1px;">• Cigarette smoking</div>
<div style="margin:0 0 1px;">• Hypertension (BP ≥140/90 mmHg or on antihypertensive medication)</div>
<div style="margin:0 0 1px;">• Family history of premature CHD (1st-degree male &lt;55 yr or female &lt;65 yr)</div>
<div style="margin:0 0 1px;">• Age: male ≥45 yr, female ≥55 yr</div>
<div style="margin:0 0 1px;">• Diabetes mellitus (CHD risk equivalent)</div>
<div style="margin:0 0 5px;">• HDL ≥60 mg/dL counts as a <em>negative</em> risk factor</div>
<table style="border-collapse:collapse;font-size:10.5px;">
  <thead>
    <tr style="background:#eef2f7;">
      <td style="padding:2px 8px;border:0.5px solid #ccc;font-weight:700;">Risk Category</td>
      <td style="padding:2px 8px;border:0.5px solid #ccc;font-weight:700;text-align:center;">LDL-C Goal</td>
      <td style="padding:2px 8px;border:0.5px solid #ccc;font-weight:700;text-align:center;">Non-HDL-C Goal</td>
    </tr>
  </thead>
  <tbody>
    <tr><td style="padding:2px 8px;border:0.5px solid #ccc;">CHD or risk equivalent</td><td style="padding:2px 8px;border:0.5px solid #ccc;text-align:center;">&lt;100 mg/dL</td><td style="padding:2px 8px;border:0.5px solid #ccc;text-align:center;">&lt;130 mg/dL</td></tr>
    <tr style="background:#fafafa;"><td style="padding:2px 8px;border:0.5px solid #ccc;">2+ risk factors</td><td style="padding:2px 8px;border:0.5px solid #ccc;text-align:center;">&lt;130 mg/dL</td><td style="padding:2px 8px;border:0.5px solid #ccc;text-align:center;">&lt;160 mg/dL</td></tr>
    <tr><td style="padding:2px 8px;border:0.5px solid #ccc;">0–1 risk factors</td><td style="padding:2px 8px;border:0.5px solid #ccc;text-align:center;">&lt;160 mg/dL</td><td style="padding:2px 8px;border:0.5px solid #ccc;text-align:center;">&lt;190 mg/dL</td></tr>
  </tbody>
</table>
</div>$html$
WHERE id = '326a7ada-02bb-4bc0-83d6-26752045b08c';


-- ─── Vitamin D (25-OH) ────────────────────────────────────────────────────────
UPDATE test_groups SET group_interpretation = $html$<div style="font-size:11px;line-height:1.4;color:#222;">
<div style="margin:0 0 3px;">25-OH-Vitamin D maintains calcium homeostasis by promoting intestinal calcium absorption and, with PTH, regulating skeletal calcium deposition. Suboptimal levels are common — prevalence may exceed 50% in institutionalised elderly.</div>
<div style="margin:0 0 3px;"><strong>Causes of deficiency:</strong> Inadequate sun exposure (especially at northern latitudes in winter), poor dietary intake, malabsorption (e.g., celiac disease), advanced liver disease (reduced hepatic 25-hydroxylase activity), enzyme-inducing drugs — phenytoin, phenobarbital, carbamazepine.</div>
<div style="margin:0;"><strong>Hypervitaminosis D</strong> is rare; occurs only after prolonged very high-dose supplementation. Can cause severe hypercalcemia and hyperphosphatemia.</div>
</div>$html$
WHERE id = 'bcbcb6b6-a312-439b-aab9-1f161321cbb8';
