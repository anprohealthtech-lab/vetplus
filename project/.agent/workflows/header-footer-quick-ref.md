# Header/Footer Customization - Quick Reference

## 🎯 Goal
Allow custom headers and footers in PDF reports based on:
1. **B2B Account** (highest priority)
2. **Location** (medium priority)
3. **Lab** (default fallback)

**Signature**: Always based on approver (unchanged)

---

## 📊 Priority Logic

```
PDF Generation
    ↓
Has account_id? → Use B2B Account Header/Footer
    ↓ No
Has location_id? → Use Location Header/Footer
    ↓ No
Use Lab Header/Footer (default)
```

---

## 🗄️ Database Approach

**Use existing `attachments` table:**

```sql
-- B2B Account Header
INSERT INTO attachments (entity_type, entity_id, attachment_type, file_url)
VALUES ('account', 'account-uuid', 'header', 'url-to-header.html');

-- Location Header
INSERT INTO attachments (entity_type, entity_id, attachment_type, file_url)
VALUES ('location', 'location-uuid', 'header', 'url-to-header.html');

-- Lab Header
INSERT INTO attachments (entity_type, entity_id, attachment_type, file_url)
VALUES ('lab', 'lab-uuid', 'header', 'url-to-header.html');
```

---

## 🔧 Key Functions to Modify

### **1. Add to `generate-pdf-auto/index.ts`:**

```typescript
async function fetchHeaderFooter(
  supabase: any,
  orderId: string,
  type: 'header' | 'footer'
): Promise<string | null> {
  // Get order
  const { data: order } = await supabase
    .from('orders')
    .select('account_id, location_id, lab_id')
    .eq('id', orderId)
    .single();

  // Priority 1: B2B Account
  if (order.account_id) {
    const attachment = await getAttachment('account', order.account_id, type);
    if (attachment) return attachment;
  }

  // Priority 2: Location
  if (order.location_id) {
    const attachment = await getAttachment('location', order.location_id, type);
    if (attachment) return attachment;
  }

  // Priority 3: Lab
  if (order.lab_id) {
    const attachment = await getAttachment('lab', order.lab_id, type);
    if (attachment) return attachment;
  }

  return null; // Use default
}
```

### **2. Update PDF Generation:**

```typescript
// Fetch custom header/footer
const headerHTML = await fetchHeaderFooter(supabase, orderId, 'header');
const footerHTML = await fetchHeaderFooter(supabase, orderId, 'footer');

// Use in PDF payload
const pdfPayload = {
  html: reportHTML,
  headerTemplate: headerHTML || defaultHeaderHTML,
  footerTemplate: footerHTML || defaultFooterHTML,
  displayHeaderFooter: true,
  // ... other settings
};
```

---

## 🎨 UI Components Needed

### **1. HeaderFooterUpload Component**
- Upload HTML file
- Preview header/footer
- Delete header/footer
- Show current file

### **2. Integration Points**
- **Lab Settings** → Upload lab-level header/footer
- **Location Master** → Upload location-specific header/footer
- **Account Master** → Upload B2B account header/footer

---

## 📁 Storage Structure

```
attachments/
  ├── labs/{lab_id}/
  │   ├── header.html
  │   └── footer.html
  │
  ├── locations/{location_id}/
  │   ├── header.html
  │   └── footer.html
  │
  └── accounts/{account_id}/
      ├── header.html
      └── footer.html
```

---

## 🧪 Testing Checklist

- [ ] Upload lab header → Generate report → Verify lab header used
- [ ] Upload location header → Generate report with location → Verify location header used
- [ ] Upload B2B header → Generate report with account → Verify B2B header used (highest priority)
- [ ] Order with account but no account header → Falls back to location/lab
- [ ] Signature always based on approver (unchanged)

---

## 📝 Template Variables

Provide in documentation:
- `{{LAB_NAME}}`
- `{{LAB_LOGO}}`
- `{{LAB_ADDRESS}}`
- `{{ACCOUNT_NAME}}`
- `{{ACCOUNT_LOGO}}`
- `{{LOCATION_NAME}}`
- `{{GENERATED_DATE}}`

---

## ⚡ Quick Start

1. **Create attachments table** (if not exists)
2. **Add indexes** for fast lookup
3. **Implement `fetchHeaderFooter()` function**
4. **Modify PDF generation** to use custom headers/footers
5. **Create UI component** for uploading
6. **Test** with sample HTML files

---

## 🎯 Success Metrics

- B2B accounts have custom branded reports ✅
- Locations have location-specific headers ✅
- Fallback logic works correctly ✅
- No breaking changes to existing reports ✅
- Performance: <2s additional time ✅

---

**See full plan**: `location-b2b-header-footer-plan.md`
