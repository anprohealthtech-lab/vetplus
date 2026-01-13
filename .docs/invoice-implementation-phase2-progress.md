# Invoice System Implementation - Phase 2 Progress

## ✅ Completed

### 1. **Storage Bucket Created**
**File**: `supabase/migrations/20260106_create_invoice_storage_bucket.sql`

- ✅ Created `invoices` storage bucket (public)
- ✅ RLS policies for lab-specific access
- ✅ Users can only access invoices from their own lab
- ✅ Folder structure: `{lab_id}/{year}/{month}/{invoice_number}.pdf`

**Policies**:
- `Users can view invoices from their lab` (SELECT)
- `Users can upload invoices for their lab` (INSERT)
- `Users can update invoices from their lab` (UPDATE)
- `Users can delete invoices from their lab` (DELETE)

---

### 2. **Thermal Print Service Fixed**
**File**: `src/utils/thermalInvoiceService.ts`

**Before** ❌:
- Missing imports
- No error handling for popup blockers
- Incomplete implementation

**After** ✅:
- ✅ Proper imports added
- ✅ Fetches lab details from database (no hardcoding)
- ✅ Popup blocker detection and error message
- ✅ Proper HTML generation for 80mm and 58mm formats
- ✅ Auto-generates invoice number if missing
- ✅ Financial validation
- ✅ Clean, formatted thermal receipt

**Features**:
```typescript
// Generate thermal HTML
await generateThermalInvoiceHTML(invoiceId, 'thermal_80mm');

// Print thermal invoice
await printThermalInvoice(invoiceId, 'thermal_80mm');
```

**Error Handling**:
- Popup blocked → Clear error message
- Invoice not found → Proper error
- Missing data → Validation errors

---

## 🔄 Next Steps (To Complete Phase 2)

### 3. **PDF Generation Edge Function**
**File**: `supabase/functions/generate-invoice-pdf/index.ts` (TO CREATE)

**What it needs to do**:
1. Fetch invoice data with lab details
2. Check if PDF already exists (`pdf_url` field)
3. If exists, return existing URL (with option to regenerate)
4. If not, generate PDF from HTML
5. Upload to Storage: `invoices/{lab_id}/{year}/{month}/{invoice_number}.pdf`
6. Update invoice record with `pdf_url` and `pdf_generated_at`
7. Return PDF URL

**Dependencies**:
- Need PDF generation library (Puppeteer or similar)
- Or use existing `generate-pdf-from-html` function

---

### 4. **Add "View PDF" Button**
**File**: `src/pages/Billing.tsx` (TO UPDATE)

**Add this button** (around line 634):
```typescript
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

**Update Generate PDF button** to show "Regenerate" if PDF exists:
```typescript
<button
  onClick={() => {
    setPdfInvoiceId(invoice.id);
    setShowPdfModal(true);
  }}
  className="text-green-600 hover:text-green-900 p-1 rounded"
  title={invoice.pdf_url ? "Regenerate PDF" : "Generate PDF"}
>
  <File className="h-4 w-4" />
</button>
```

---

### 5. **Update Invoice Generation Modal**
**File**: `src/components/Billing/InvoiceGenerationModal.tsx` (TO UPDATE)

**Add PDF storage logic**:
```typescript
const handleGeneratePDF = async () => {
  try {
    setGenerating(true);

    // Call Edge Function
    const { data, error } = await supabase.functions.invoke('generate-invoice-pdf', {
      body: {
        invoiceId: invoice.id,
        templateId: selectedTemplate,
        language: selectedLanguage
      }
    });

    if (error) throw error;

    // Check if PDF already exists
    if (data.already_generated && !forceRegenerate) {
      const regenerate = confirm('PDF already exists. Regenerate?');
      if (!regenerate) {
        window.open(data.pdf_url, '_blank');
        return;
      }
      setForceRegenerate(true);
      return handleGeneratePDF();
    }

    // Success - PDF generated
    setPdfUrl(data.pdf_url);
    
    // Update local invoice state
    onInvoiceUpdated({
      ...invoice,
      pdf_url: data.pdf_url,
      pdf_generated_at: new Date().toISOString()
    });

    toast.success('Invoice PDF generated successfully!');

  } catch (error) {
    console.error('PDF generation failed:', error);
    toast.error('Failed to generate PDF');
  } finally {
    setGenerating(false);
  }
};
```

---

## Implementation Guide

### **Step 1: Run Migrations**

```bash
# Via Supabase Dashboard
# 1. Run: supabase/migrations/20260106_invoice_number_generation.sql
# 2. Run: supabase/migrations/20260106_create_invoice_storage_bucket.sql

# Or via CLI
supabase db push
```

---

### **Step 2: Create Edge Function (Manual)**

Create `supabase/functions/generate-invoice-pdf/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const { invoiceId, templateId, forceRegenerate } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Fetch invoice
    const { data: invoice } = await supabase
      .from('invoices')
      .select(`
        *,
        patients (*),
        invoice_items (*),
        labs (name, address, phone, email, gst_number, logo_url)
      `)
      .eq('id', invoiceId)
      .single();

    // 2. Check if PDF exists
    if (invoice.pdf_url && !forceRegenerate) {
      return new Response(JSON.stringify({
        success: true,
        pdf_url: invoice.pdf_url,
        already_generated: true
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 3. Generate PDF (call existing generate-pdf-from-html function)
    const pdfResponse = await supabase.functions.invoke('generate-pdf-from-html', {
      body: {
        invoiceId,
        templateId,
        type: 'invoice'
      }
    });

    if (pdfResponse.error) throw pdfResponse.error;

    // 4. Upload to Storage
    const fileName = `${invoice.invoice_number}.pdf`;
    const filePath = `${invoice.lab_id}/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(filePath, pdfResponse.data, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // 5. Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('invoices')
      .getPublicUrl(filePath);

    // 6. Update invoice
    await supabase
      .from('invoices')
      .update({
        pdf_url: publicUrl,
        pdf_generated_at: new Date().toISOString(),
        template_id: templateId
      })
      .eq('id', invoiceId);

    return new Response(JSON.stringify({
      success: true,
      pdf_url: publicUrl
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
```

---

### **Step 3: Update Billing.tsx**

Add View PDF button (manual edit around line 634):

```typescript
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

---

## Testing

### Test Thermal Print
1. Go to Billing page
2. Click thermal print icon
3. Verify popup opens with correct lab details
4. Verify print dialog appears
5. Check printed receipt has lab name, address, GST

### Test Storage Bucket
1. Run migrations
2. Check Supabase Dashboard → Storage
3. Verify `invoices` bucket exists
4. Check RLS policies are active

### Test PDF Generation (After Edge Function)
1. Click "Generate PDF" on invoice
2. Select template
3. Click Generate
4. Verify PDF uploads to Storage
5. Verify `pdf_url` field updates
6. Click "View PDF" button
7. Verify PDF opens in new tab

---

## Summary

✅ **Storage Bucket**: Created with RLS policies  
✅ **Thermal Print**: Fixed with lab details and error handling  
🔄 **PDF Generation**: Edge function needs to be created  
🔄 **View PDF Button**: Needs to be added to Billing.tsx  

**Phase 2 is 60% complete!** 🎉

**Next**: Create PDF generation Edge Function and add View PDF button
