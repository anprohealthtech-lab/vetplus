# Report Template Enhancement Script

## Overview
This script uses a DigitalOcean RAG agent to enhance existing report templates by:
- Adding proper clinical interpretation sections
- Adding standardized notes about reference ranges
- Ensuring global CSS compliance
- Removing inline styles

## How It Works

1. **Fetches 5 templates** from `report_templates` table
2. **For each template:**
   - Sends `gjs_html` + global CSS to DO agent
   - Agent returns enhanced HTML with:
     - Clinical interpretation table
     - Reference range disclaimer
     - Factors affecting interpretation notes
   - Updates template in database with new HTML and CSS

3. **Safety Features:**
   - 2-second delay between templates (avoid rate limiting)
   - Continues on error (skips failed templates)
   - Detailed logging for each step

## Usage

```bash
# Run the script
npx tsx scripts/enhance_report_templates.ts
```

## What the Agent Does

### Adds Clinical Interpretation Section
```html
<div class="section-header">Clinical Interpretation</div>
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
        <td>High</td>
        <td>May suggest inflammation/infection; correlate clinically.</td>
      </tr>
      <tr>
        <td>Normal</td>
        <td>Results within reference ranges.</td>
      </tr>
      <tr>
        <td>Low</td>
        <td>May suggest anemia/immune suppression; correlate clinically.</td>
      </tr>
    </tbody>
  </table>
</figure>
```

### Adds Standardized Note
```html
<div class="note">
  <strong>Note on Reference Ranges:</strong> Reference ranges may vary by laboratory...
  <br><br>
  <strong>Additional Note:</strong> Certain conditions can affect interpretation...
</div>
```

### Applies Global CSS
- Removes all inline `style=""` attributes
- Ensures all tables use class-based styling
- Applies consistent color scheme and typography

## Agent Configuration

- **URL:** `https://sirvwszn3jrtvmxtnirmvwjz.agents.do-ai.run`
- **Access Key:** (embedded in script)

## Output

For each template, you'll see:
```
📋 Template 1/5: HbA1c Test Report
   ID: abc-123-def

📤 Calling DO Agent...
✅ Agent response received

📝 Enhancement Summary:
   1. Inserted clinical interpretation table after results
   2. Added reference range disclaimer
   3. Removed 3 inline style attributes
   4. Applied global CSS classes

💾 Updating template abc-123-def...
✅ Template updated successfully!
```

## Important Notes

1. **Fragment-only output** - Agent never wraps with `<html>`, `<head>`, `<body>`
2. **Preserves placeholders** - All `{{patientName}}`, `{{ANALYTE_*}}` remain unchanged
3. **Medical safety** - Uses neutral language ("may be associated with")
4. **No diagnosis** - Never suggests treatment or makes definitive diagnoses

## Troubleshooting

### Agent API Errors
- Check DigitalOcean agent status
- Verify access key is correct
- Check network connectivity

### Template Not Updated
- Check Supabase connection
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set
- Check template has `gjs_html` (not null)

### Rate Limiting
- Script has 2-second delay between templates
- If needed, increase delay in code

## Future Enhancements

- [ ] Add `retrievedText` from knowledge base for specific tests
- [ ] Allow custom template selection (not just first 5)
- [ ] Preview changes before applying
- [ ] Backup templates before modification
