# 🚀 Invoice System - Quick Reference

## ✅ **What's Done**

1. ✅ **Auto Invoice Numbers** - `INV-2601-0001` format
2. ✅ **Fixed Invoice Preview** - Shows YOUR lab details
3. ✅ **Storage Bucket** - `invoices` bucket created
4. ✅ **Thermal Print** - Fixed with error handling
5. ✅ **PDF Edge Function** - Already exists

---

## 📝 **One Manual Edit Needed**

### **Add "View PDF" Button**

**File**: `src/pages/Billing.tsx`  
**Line**: ~634 (after Preview button, before Generate PDF)

**Add this code**:

```tsx
{/* View PDF (if exists) */}
{invoice.pdf_url && (
  <button
    onClick={() => window.open(invoice.pdf_url, '_blank')}
    className="text-indigo-600 hover:text-indigo-900 p-1 rounded"
    title="View Generated PDF"
  >
    <FileText className="h-4 w-4" />
  </button>
)}
```

**Also update Generate PDF button**:

Change `title="Generate PDF"` to:
```tsx
title={invoice.pdf_url ? "Regenerate PDF" : "Generate PDF"}
```

---

## 🗄️ **Deploy Migrations**

```bash
# Run these migrations
supabase db push

# Or via Dashboard:
# 1. supabase/migrations/20260106_invoice_number_generation.sql
# 2. supabase/migrations/20260106_create_invoice_storage_bucket.sql
```

---

## 🧪 **Quick Test**

1. Run migrations
2. Add "View PDF" button code
3. Create new invoice → Check invoice number
4. Click "Preview" → Verify YOUR lab name shows
5. Click "Generate PDF" → Verify PDF uploads
6. Click "View PDF" → Opens in new tab
7. Click thermal print → Verify popup works

---

## 📄 **Button Layout (After Edit)**

| Button | Icon | When Visible | Color |
|--------|------|--------------|-------|
| Preview | 👁️ | Always | Blue |
| **View PDF** | 📄 | **When PDF exists** | **Indigo** |
| Generate PDF | 📁 | Always | Green |
| Thermal Print | 🖨️ | Always | Gray |
| Record Payment | 💳 | Unpaid only | Orange |
| Request Refund | 🔄 | Paid only | Purple |

---

## 📚 **Full Documentation**

See: `.docs/invoice-implementation-COMPLETE.md`

---

**That's it! Just add the View PDF button and you're done!** ✅
