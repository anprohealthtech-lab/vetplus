# Invoice PDF Generation & Management - Implementation Plan

## Current Issues

### 1. **Hardcoded Lab Name**
- ❌ Invoice preview shows "MediLab Diagnostics" (hardcoded)
- ❌ Should show actual lab name from database

### 2. **Thermal Print Error**
```
Thermal invoice print failed
```
- Missing proper error handling
- No fallback mechanism

### 3. **Invoice Generation Logic**
- ❌ Unclear if multiple PDF generations create new invoices or reuse existing
- ❌ No clear PDF storage strategy
- ❌ No link between invoice and generated PDF

### 4. **Missing Features**
- ❌ No way to view previously generated PDFs
- ❌ No PDF storage in Supabase Storage
- ❌ No tracking of PDF generation history
- ❌ No integration with Cash Reconciliation

---

## Proposed Solution

### **Architecture Overview**

```
┌─────────────────────────────────────────────────────────────┐
│ Invoice Creation Flow                                       │
└─────────────────────────────────────────────────────────────┘
                    ↓
1. User creates order
                    ↓
2. Invoice record created in `invoices` table
   - invoice_number: auto-generated
   - pdf_url: NULL (not generated yet)
   - pdf_generated_at: NULL
                    ↓
3. User clicks "Generate PDF"
                    ↓
4. Check if PDF already exists (pdf_url IS NOT NULL)
   ├─ YES → Show existing PDF + option to regenerate
   └─ NO  → Generate new PDF
                    ↓
5. Generate PDF via Edge Function
   - Fetch lab details (name, address, logo)
   - Fetch invoice details
   - Fetch patient details
   - Apply selected template
   - Generate PDF
                    ↓
6. Upload PDF to Supabase Storage
   - Path: invoices/{lab_id}/{year}/{month}/{invoice_number}.pdf
   - Get public URL
                    ↓
7. Update invoice record
   - pdf_url: {storage_url}
   - pdf_generated_at: NOW()
   - template_id: {selected_template}
                    ↓
8. Return PDF URL to frontend
   - Download PDF
   - Send via WhatsApp
   - Print thermal receipt
```

---

## Database Schema Updates

### **Already Exists in `invoices` table**:
```sql
-- These columns already exist
pdf_url TEXT NULL
pdf_generated_at TIMESTAMP WITH TIME ZONE NULL
template_id UUID NULL
```

### **Add Invoice Number Auto-Generation**:
```sql
-- Create sequence for invoice numbers per lab
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;

-- Create function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number(p_lab_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_month TEXT;
  v_sequence INT;
  v_invoice_number TEXT;
BEGIN
  -- Get current year and month
  v_year := TO_CHAR(NOW(), 'YY');
  v_month := TO_CHAR(NOW(), 'MM');
  
  -- Get next sequence number for this lab
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '\d+$') AS INT)), 0) + 1
  INTO v_sequence
  FROM invoices
  WHERE lab_id = p_lab_id
    AND invoice_number LIKE 'INV-' || v_year || v_month || '%';
  
  -- Format: INV-YYMM-0001
  v_invoice_number := 'INV-' || v_year || v_month || '-' || LPAD(v_sequence::TEXT, 4, '0');
  
  RETURN v_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate invoice number
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := generate_invoice_number(NEW.lab_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_number();
```

---

## Implementation Steps

### **Phase 1: Fix Invoice Preview (Immediate)**

#### 1.1 Update Invoice Preview Component
**File**: `src/components/Billing/InvoicePreviewModal.tsx` (or similar)

```typescript
// Fetch lab details
const [labDetails, setLabDetails] = useState<any>(null);

useEffect(() => {
  const loadLabDetails = async () => {
    const labId = await database.getCurrentUserLabId();
    const { data } = await supabase
      .from('labs')
      .select('name, address, phone, email, gst_number, logo_url')
      .eq('id', labId)
      .single();
    
    setLabDetails(data);
  };
  loadLabDetails();
}, []);

// Use in preview
<h1>{labDetails?.name || 'Loading...'}</h1>
<p>{labDetails?.address}</p>
<p>Phone: {labDetails?.phone} | GST: {labDetails?.gst_number}</p>
```

---

### **Phase 2: PDF Generation & Storage**

#### 2.1 Create Edge Function: `generate-invoice-pdf`

**File**: `supabase/functions/generate-invoice-pdf/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const { invoiceId, templateId } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Fetch invoice details
    const { data: invoice } = await supabase
      .from('invoices')
      .select(`
        *,
        patients (*),
        invoice_items (*),
        labs (name, address, phone, email, gst_number, logo_url),
        invoice_templates (*)
      `)
      .eq('id', invoiceId)
      .single();

    // 2. Check if PDF already exists
    if (invoice.pdf_url) {
      return new Response(JSON.stringify({
        success: true,
        pdf_url: invoice.pdf_url,
        already_generated: true
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 3. Generate PDF HTML
    const html = generateInvoiceHTML(invoice, templateId);

    // 4. Convert HTML to PDF (using Puppeteer or similar)
    const pdfBuffer = await htmlToPdf(html);

    // 5. Upload to Supabase Storage
    const fileName = `${invoice.invoice_number}.pdf`;
    const filePath = `invoices/${invoice.lab_id}/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // 6. Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('invoices')
      .getPublicUrl(filePath);

    // 7. Update invoice record
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
      pdf_url: publicUrl,
      file_path: filePath
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
```

#### 2.2 Update Frontend: Invoice Generation Modal

**File**: `src/components/Billing/InvoiceGenerationModal.tsx`

```typescript
const handleGeneratePDF = async () => {
  try {
    setGenerating(true);

    // Call Edge Function
    const { data, error } = await supabase.functions.invoke('generate-invoice-pdf', {
      body: {
        invoiceId: invoice.id,
        templateId: selectedTemplate
      }
    });

    if (error) throw error;

    if (data.already_generated) {
      // PDF already exists
      const regenerate = confirm('PDF already exists. Regenerate?');
      if (!regenerate) {
        window.open(data.pdf_url, '_blank');
        return;
      }
      // Force regeneration by deleting old PDF first
      await deleteOldPDF(invoice.pdf_url);
      // Retry generation
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

    // Show success message
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

### **Phase 3: Fix Thermal Print**

#### 3.1 Update Thermal Print Service

**File**: `src/utils/thermalInvoiceService.ts`

```typescript
export async function printThermalInvoice(invoiceId: string, format: '80mm' | '58mm' = '80mm') {
  try {
    // 1. Fetch invoice with lab details
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(`
        *,
        patients (name, phone),
        invoice_items (test_name, price, quantity),
        labs (name, address, phone, gst_number)
      `)
      .eq('id', invoiceId)
      .single();

    if (error) throw error;

    // 2. Generate thermal HTML (use lab details, not hardcoded)
    const thermalHTML = generateThermalHTML(invoice, format);

    // 3. Print via browser print API
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('Popup blocked. Please allow popups for thermal printing.');
    }

    printWindow.document.write(thermalHTML);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();

    return { success: true };

  } catch (error) {
    console.error('Thermal print failed:', error);
    throw new Error(`Thermal print failed: ${error.message}`);
  }
}

function generateThermalHTML(invoice: any, format: string) {
  const width = format === '80mm' ? '80mm' : '58mm';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @page { size: ${width} auto; margin: 0; }
        body { 
          width: ${width}; 
          font-family: monospace; 
          font-size: 12px;
          margin: 5mm;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 5px 0; }
      </style>
    </head>
    <body>
      <div class="center bold">${invoice.labs.name}</div>
      <div class="center">${invoice.labs.address}</div>
      <div class="center">Ph: ${invoice.labs.phone}</div>
      <div class="center">GST: ${invoice.labs.gst_number}</div>
      <div class="line"></div>
      
      <div class="bold">Invoice: ${invoice.invoice_number}</div>
      <div>Date: ${new Date(invoice.invoice_date).toLocaleDateString()}</div>
      <div>Patient: ${invoice.patients.name}</div>
      <div class="line"></div>
      
      ${invoice.invoice_items.map(item => `
        <div>
          <div>${item.test_name}</div>
          <div style="text-align: right;">${item.price.toFixed(2)}</div>
        </div>
      `).join('')}
      
      <div class="line"></div>
      <div class="bold" style="text-align: right;">
        Total: ${invoice.total.toFixed(2)}
      </div>
      <div class="center">Thank You!</div>
    </body>
    </html>
  `;
}
```

---

### **Phase 4: Dashboard Integration**

#### 4.1 Add "View Invoice" Button

**File**: `src/pages/Billing.tsx`

```typescript
// In invoice table row
{invoice.pdf_url ? (
  <button
    onClick={() => window.open(invoice.pdf_url, '_blank')}
    className="text-blue-600 hover:text-blue-900"
    title="View Generated PDF"
  >
    <FileText className="h-4 w-4" />
  </button>
) : (
  <span className="text-gray-400 text-xs">Not generated</span>
)}
```

---

## Best Practices

### **1. Invoice Number Format**
```
INV-YYMM-0001
INV-YYMM-0002
...
INV-2601-0001  (January 2026, Invoice #1)
```

### **2. PDF Storage Structure**
```
invoices/
  {lab_id}/
    2026/
      01/
        INV-2601-0001.pdf
        INV-2601-0002.pdf
      02/
        INV-2602-0001.pdf
```

### **3. PDF Generation Rules**
- ✅ **One PDF per invoice** - Don't create duplicates
- ✅ **Check before generate** - If `pdf_url` exists, ask to regenerate
- ✅ **Store URL in database** - Always update `pdf_url` field
- ✅ **Track generation time** - Update `pdf_generated_at`

### **4. Template Selection**
- ✅ Save `template_id` with invoice
- ✅ Allow regeneration with different template
- ✅ Show template preview before generation

---

## Summary

### **Immediate Fixes**
1. ✅ Replace hardcoded "MediLab" with actual lab name from database
2. ✅ Fix thermal print error handling
3. ✅ Add proper PDF storage in Supabase Storage

### **Implementation Priority**
1. **High**: Fix invoice preview (hardcoded lab name)
2. **High**: Implement PDF storage and URL tracking
3. **Medium**: Add "View PDF" button in billing module
4. **Medium**: Fix thermal print service
5. **Low**: Add PDF regeneration with different templates

### **Files to Create/Modify**
- ✅ `supabase/functions/generate-invoice-pdf/index.ts` (NEW)
- ✅ `supabase/migrations/20260106_invoice_number_generation.sql` (NEW)
- ✅ `src/components/Billing/InvoicePreviewModal.tsx` (UPDATE)
- ✅ `src/components/Billing/InvoiceGenerationModal.tsx` (UPDATE)
- ✅ `src/utils/thermalInvoiceService.ts` (UPDATE)
- ✅ `src/pages/Billing.tsx` (UPDATE)

---

**This plan ensures proper invoice PDF generation, storage, and management!** 📄
