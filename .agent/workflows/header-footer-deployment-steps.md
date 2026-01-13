# Header/Footer Implementation - Deployment Guide

## ✅ Step 1: Database Migration (DONE)
You've already completed this step!

---

## 📦 Step 2: Create Storage Bucket

### **Run this SQL:**
```bash
# In Supabase SQL Editor, run:
supabase/migrations/20260107_storage_bucket_attachments.sql
```

Or copy/paste the SQL from that file into Supabase Dashboard → SQL Editor → Run

**Expected Output:**
```
NOTICE: ✅ Attachments bucket created successfully
NOTICE: ✅ Created 3 storage policies for attachments
```

---

## 🎨 Step 3: Integrate UI Component

### **Option A: Add to Account Master (for B2B accounts)**

Edit: `src/components/Masters/AccountMaster.tsx`

Add import:
```typescript
import HeaderFooterUpload from '../Settings/HeaderFooterUpload';
```

In the edit modal, add a new tab or section:
```typescript
{/* Add after the billing mode section */}
{!editingAccount && (
  <div className="col-span-2 border-t pt-4 mt-4">
    <h3 className="font-medium mb-4">Report Customization</h3>
    <HeaderFooterUpload
      entityType="account"
      entityId={editingAccount?.id || ''}
      entityName={editingAccount?.name || 'Account'}
    />
  </div>
)}
```

### **Option B: Add to Lab Settings**

Edit: `src/pages/Settings.tsx`

Add import:
```typescript
import HeaderFooterUpload from '../components/Settings/HeaderFooterUpload';
```

Add a new section:
```typescript
{/* Add in settings page */}
<div className="bg-white rounded-lg shadow p-6">
  <h2 className="text-xl font-bold mb-4">Report Customization</h2>
  <HeaderFooterUpload
    entityType="lab"
    entityId={labId}
    entityName={labName}
  />
</div>
```

---

## 🔧 Step 4: Update PDF Generation Function

Edit: `supabase/functions/generate-pdf-auto/index.ts`

### **4.1: Add Import at Top**
```typescript
import { 
  fetchHeaderFooter, 
  getDefaultHeaderHTML, 
  getDefaultFooterHTML 
} from './headerFooterHelper.ts';
```

### **4.2: Find the PDF Generation Section**

Look for where the PDF payload is created (search for "pdfPayload" or "PDF.co" or "html:")

### **4.3: Add Header/Footer Fetching**

Add this BEFORE creating the PDF payload:

```typescript
// Fetch custom header/footer based on priority
console.log('[PDF] Fetching custom header/footer for order:', orderId);

const customHeader = await fetchHeaderFooter(supabase, orderId, 'header');
const customFooter = await fetchHeaderFooter(supabase, orderId, 'footer');

// Get lab info for default templates
const { data: labInfo } = await supabase
  .from('labs')
  .select('name, logo_url, address, phone, website, email')
  .eq('id', order.lab_id)
  .single();

// Use custom or default
const headerHTML = customHeader || getDefaultHeaderHTML(labInfo || {});
const footerHTML = customFooter || getDefaultFooterHTML(labInfo || {});

console.log('[PDF] Using header:', customHeader ? 'Custom' : 'Default');
console.log('[PDF] Using footer:', customFooter ? 'Custom' : 'Default');
```

### **4.4: Update PDF Payload**

Modify the PDF payload to include headers/footers:

```typescript
const pdfPayload = {
  html: reportHTML,
  headerTemplate: headerHTML,
  footerTemplate: footerHTML,
  displayHeaderFooter: true,
  // ... rest of your existing settings
};
```

---

## 🧪 Step 5: Test the Implementation

### **Test 1: Upload Lab Header**
1. Go to Settings → Report Customization
2. Upload `.agent/templates/default-lab-header.html`
3. Upload `.agent/templates/default-lab-footer.html`
4. Generate a test report
5. Verify header/footer appears

### **Test 2: Upload B2B Account Header**
1. Go to Account Master
2. Edit a B2B account
3. Upload `.agent/templates/b2b-account-header.html`
4. Generate report for that account
5. Verify B2B header appears (not lab header)

### **Test 3: Test Fallback**
1. Create order without account_id
2. Generate report
3. Should use lab header (fallback)

---

## 📝 Quick Commands

### **Deploy Storage Bucket:**
```bash
# Option 1: Via migration
supabase db push

# Option 2: Via SQL Editor
# Copy/paste: supabase/migrations/20260107_storage_bucket_attachments.sql
```

### **Test Upload:**
```bash
# You can test file upload via Supabase Dashboard:
# Storage → attachments → Upload file
```

---

## 🎯 Current Status

- [x] ✅ Database migration complete
- [ ] ⏳ Storage bucket creation (NEXT STEP)
- [ ] ⏳ UI component integration
- [ ] ⏳ PDF generation update
- [ ] ⏳ End-to-end testing

---

## 🚀 Next Immediate Steps

1. **Run Storage Bucket SQL** (2 minutes)
   - Open Supabase SQL Editor
   - Run `20260107_storage_bucket_attachments.sql`

2. **Integrate UI Component** (5 minutes)
   - Add to Account Master OR Settings page
   - Test upload functionality

3. **Update PDF Function** (10 minutes)
   - Add import
   - Add header/footer fetching
   - Update PDF payload

4. **Test** (5 minutes)
   - Upload sample template
   - Generate report
   - Verify customization works

**Total Time: ~20 minutes**

---

## 💡 Tips

- Start with lab-level headers (easier to test)
- Use sample templates from `.agent/templates/`
- Check browser console for errors
- Verify files upload to `attachments` bucket
- Test with small HTML files first

---

## 🆘 Troubleshooting

**Issue: Can't upload files**
- Check storage bucket exists
- Verify storage policies are set
- Check file size (<100KB)

**Issue: Header not showing in PDF**
- Check PDF generation function is updated
- Verify import statement is correct
- Check console logs for errors

**Issue: Wrong header showing**
- Verify priority logic (B2B > Location > Lab)
- Check order has correct account_id/location_id
- Verify attachment is linked to correct entity

---

Ready for Step 2? Run the storage bucket SQL! 🚀
