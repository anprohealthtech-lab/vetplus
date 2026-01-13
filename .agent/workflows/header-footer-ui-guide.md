# Where to Upload Headers & Footers - UI Guide

## 📍 Location-Specific Header/Footer

### **How to Access:**
1. Go to **Masters** → **Location Master**
2. Click **Edit** (pencil icon) on any location
3. Scroll down to see **"Report Header & Footer"** section
4. Upload header/footer HTML files

### **When to Use:**
- Different branches have different addresses
- Location-specific branding needed
- Different contact info per location

### **Priority:**
- Medium (used if no B2B account header exists)

---

## 🏢 B2B Account-Specific Header/Footer

### **How to Access:**
1. Go to **Masters** → **Account Master**
2. Click **Edit** (pencil icon) on any B2B account
3. Scroll down to see **"Report Header & Footer"** section
4. Upload header/footer HTML files

### **When to Use:**
- Hospital/corporate wants their own branding
- Custom logo and info for specific accounts
- White-label reports for partners

### **Priority:**
- **Highest** (overrides location and lab headers)

---

## 🏥 Lab-Level Header/Footer (Default)

### **How to Access:**
Currently NOT implemented in UI. 

### **Workaround:**
Upload directly to database:
```sql
INSERT INTO attachments (entity_type, entity_id, attachment_type, file_url, file_name)
VALUES (
  'lab',
  'your-lab-id',
  'header',
  'https://storage.../header.html',
  'lab-header.html'
);
```

### **When to Use:**
- Default header for all reports
- Fallback when no location/account header exists

### **Priority:**
- Lowest (default fallback)

---

## 🎯 Priority Order

When generating a PDF report:

```
1. B2B Account Header (if order has account_id)
   ↓ Not found
2. Location Header (if order has location_id)
   ↓ Not found
3. Lab Header (default)
   ↓ Not found
4. Built-in Default Template
```

---

## 📝 How to Upload

### **Step 1: Edit Entity**
- Click Edit on Location or Account

### **Step 2: Scroll to Report Customization**
- Section appears at bottom of form
- Only visible when editing existing records

### **Step 3: Upload Files**
- Click "Upload Header" or "Upload Footer"
- Select HTML file (<100KB)
- Preview to verify
- Save

### **Step 4: Test**
- Generate a report for that location/account
- Verify custom header/footer appears

---

## 📄 Sample Templates

Located in: `.agent/templates/`

1. **default-lab-header.html** - Basic lab header
2. **default-lab-footer.html** - Basic lab footer
3. **b2b-account-header.html** - Premium B2B header

---

## 🎨 Template Variables

Use these in your HTML:

| Variable | Description |
|----------|-------------|
| `{{LAB_NAME}}` | Lab name |
| `{{LAB_LOGO}}` | Lab logo URL |
| `{{LAB_ADDRESS}}` | Lab address |
| `{{ACCOUNT_NAME}}` | Account name (B2B only) |
| `{{ACCOUNT_LOGO}}` | Account logo (B2B only) |
| `{{LOCATION_NAME}}` | Location name |
| `{{GENERATED_DATE}}` | Report generation date |

---

## ✅ Quick Test

1. **Edit a Location:**
   - Masters → Location Master → Edit any location
   - See "Report Header & Footer" section

2. **Edit a B2B Account:**
   - Masters → Account Master → Edit any account
   - See "Report Header & Footer" section

3. **Upload Template:**
   - Use sample from `.agent/templates/`
   - Preview before saving

4. **Generate Report:**
   - Create order for that location/account
   - Generate PDF
   - Verify custom header appears

---

## 🔍 Troubleshooting

### **"Can't see Report Header & Footer section"**
- Make sure you're **editing** an existing record (not creating new)
- Scroll to the bottom of the form
- Check if modal is scrollable

### **"Upload button not working"**
- Check file is HTML (<100KB)
- Verify storage bucket exists
- Check browser console for errors

### **"Header not showing in PDF"**
- PDF generation function needs to be updated
- See: `.agent/workflows/pdf-generation-integration-guide.md`
- Deploy updated function

---

## 📚 Related Documentation

- **Full Implementation**: `.agent/workflows/IMPLEMENTATION-COMPLETE.md`
- **PDF Integration**: `.agent/workflows/pdf-generation-integration-guide.md`
- **Quick Reference**: `.agent/workflows/header-footer-quick-ref.md`

---

## 🎯 Summary

**Location Headers:**
- Masters → Location Master → Edit → Scroll down

**B2B Account Headers:**
- Masters → Account Master → Edit → Scroll down

**Lab Headers:**
- Not in UI yet (use database directly)

**Priority:**
- B2B Account > Location > Lab

That's it! 🚀
