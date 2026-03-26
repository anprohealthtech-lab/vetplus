# Template Enhancement - New Smart Approach

## Summary

Created a **2-step process** that:
1. **Bulk updates CSS** (simple replace, no AI)
2. **Generates interpretation content ONLY** (AI with knowledge base)

This ensures:
- ✅ Structure is NOT changed
- ✅ AI only adds content, not modifies HTML
- ✅ Knowledge base is used for accurate medical info
- ✅ Global CSS is consistently applied

---

## Files Created

### 1. System Prompt for Agent
**File:** `.docs/agent-system-prompt-interpretation.md`

**What to do:**
- Copy this prompt into your DigitalOcean Agent's **system prompt settings**
- This tells the agent to:
  - Use its knowledge base
  - Generate ONLY the HTML interpretation block
  - Not modify existing structure
  - Use medically accurate, neutral language

### 2. Smart Enhancement Script
**File:** `scripts/enhance_templates_smart.ts`

**What it does:**
```
STEP 1: Bulk Update CSS
  ├─ Fetches all report_body templates
  ├─ Updates css_content to global CSS
  └─ No AI needed

STEP 2: Generate Interpretations
  ├─ For each template:
  │  ├─ Extracts test name (from template.name)
  │  ├─ Asks agent: "Generate interpretation for: [test name]"
  │  ├─ Agent uses knowledge base to get accurate info
  │  ├─ Returns ONLY interpretation HTML block
  │  ├─ Script inserts it after results table
  │  └─ Updates database
  └─ Processes 5 templates at a time
```

---

## How to Use

### Prerequisites
1. **Add system prompt to Agent:**
   - Go to DigitalOcean AI Agent dashboard
   - Add the content from `.docs/agent-system-prompt-interpretation.md` as system prompt
   - Save

2. **Run the script:**
   ```bash
   npx tsx scripts/enhance_templates_smart.ts
   ```

### Expected Output
```
🚀 Smart Template Enhancement
============================================================

📦 STEP 1: Bulk Updating Global CSS...

Found 15 templates
   ✅ HbA1c
   ✅ Lipid Profile
   ✅ CBC
   ... (all templates)

📚 STEP 2: Generating Interpretation Sections...

[1/5] HbA1c
   🤖 Asking AI + knowledge base...
   💾 Updating database...
   ✅ Success!
   ⏳ Waiting 3s...

[2/5] Lipid Profile
   🤖 Asking AI + knowledge base...
   💾 Updating database...
   ✅ Success!
   ... (continues)

============================================================

🎉 Enhancement Complete!
```

---

## What Gets Added

For each template, the agent adds (after results table):

```html
<div class="section-header">Clinical Interpretation</div>
<figure class="table">
  <table class="tbl-interpretation">
    <thead>
      <tr><th>Level</th><th>Meaning & Potential Causes</th></tr>
    </thead>
    <tbody>
      <!-- Knowledge base driven rows -->
      <tr>
        <td>High</td>
        <td>[KB-based interpretation]</td>
      </tr>
      <tr>
        <td>Normal</td>
        <td>[KB-based interpretation]</td>
      </tr>
      <tr>
        <td>Low</td>
        <td>[KB-based interpretation]</td>
      </tr>
    </tbody>
  </table>
</figure>

<div class="note">
  <strong>Note on Reference Ranges:</strong> [Generic note]
  <br><br>
  <strong>Additional Note:</strong> [KB-based test-specific factors]
</div>
```

---

## Benefits

| Feature | Old Approach | New Approach |
|---------|-------------|--------------|
| **Structure** | Changed entire HTML | Only adds content block |
| **Accuracy** | Generic content | Uses knowledge base |
| **CSS** | Mixed with AI generation | Bulk updated separately |
| **Risk** | High (could break templates) | Low (insertion only) |
| **Speed** | Slow (full regeneration) | Fast (content only) |

---

## Troubleshooting

### Agent returns wrong format
- Verify system prompt is added to agent
- Check agent response in logs
- May need to adjust insertion markers in script

### Interpretation already exists
- Script checks for "Clinical Interpretation" text
- Skips templates that already have it
- Delete manually if you want to regenerate

### Knowledge base not used
- Ensure `include_retrieval_info: true` in API call
- Verify agent has documents in knowledge base
- Check agent logs for retrieval evidence

---

## Next Steps

1. **Add system prompt** to DO Agent dashboard
2. **Run script** to enhance 5 templates
3. **Test one template** to verify quality
4. **Increase limit** if satisfied (change limit(5) to limit(50))
5. **Run full batch** for all templates

---

## Example: HbA1c Template

**Before:**
```html
<section>
  <h2>Lab Report</h2>
  <!-- patient info -->
  <!-- results table -->
</section>
```

**After:**
```html
<section>
  <h2>Lab Report</h2>
  <!-- patient info -->
  <!-- results table -->
  
  <!-- NEW: Added by AI -->
  <div class="section-header">Clinical Interpretation</div>
  <figure class="table">
    <table class="tbl-interpretation">
      <thead><tr><th>Level</th><th>Meaning</th></tr></thead>
      <tbody>
        <tr><td>Diabetes</td><td>HbA1c ≥6.5% is diagnostic of diabetes...</td></tr>
        <tr><td>Prediabetes</td><td>HbA1c 5.7-6.4% suggests increased risk...</td></tr>
        <tr><td>Normal</td><td>HbA1c <5.7% generally indicates good glycemic control...</td></tr>
      </tbody>
    </table>
  </figure>
  <div class="note">
    <strong>Note:</strong> Hemoglobin variants, anemia, or recent transfusion may affect accuracy...
  </div>
</section>
```

**CSS:**
All templates get the same global CSS (no inline styles).
