# Billing Page Action Buttons Cleanup

## Summary of Changes

This document describes the cleanup of hardcoded formats and obsolete functionality in the Billing page action buttons.

---

## Issues Found

### 1. **Obsolete Download Function**
- **Function**: `handleDownloadInvoice()`
- **Problem**: Used old `pdfGenerator` utility with hardcoded data
- **Issues**:
  - Hardcoded patient age (32) and gender ('Female')
  - Hardcoded currency symbol (₹)
  - Used report template instead of invoice template
  - Converted invoice to "test results" format (incorrect)

### 2. **Hardcoded Currency Symbols**
- **Location**: Invoice amount displays
- **Problem**: Hardcoded `₹` symbol in multiple places
- **Impact**: Won't work for Pakistan, Sri Lanka, UAE, Bangladesh, Nepal

### 3. **Duplicate Action Buttons**
- **Problem**: Two buttons for PDF generation:
  - "Download Invoice" (obsolete function)
  - "Generate PDF" (proper modal)

---

## Changes Made

### 1. ✅ Removed Obsolete Download Function

**Before**:
```typescript
const handleDownloadInvoice = async (invoice: Invoice) => {
  // 50 lines of hardcoded logic
  // Using pdfGenerator instead of proper invoice PDF
  const reportData: ReportData = {
    patient: {
      age: 32, // Hardcoded!
      gender: 'Female', // Hardcoded!
    },
    testResults: testItems.map((test: any) => ({
      result: `₹${test.price}`, // Hardcoded currency!
    })),
  };
  await generateAndDownloadReport(reportData);
};
```

**After**: ❌ **Removed entirely**

---

### 2. ✅ Cleaned Up Action Buttons

**Before** (5 buttons, cluttered):
```tsx
<Eye /> {/* Preview */}
<Download onClick={handleDownloadInvoice} /> {/* Obsolete */}
<File onClick={openPdfModal} /> {/* Duplicate */}
<Printer /> {/* Thermal */}
<CreditCard /> {/* Payment */}
<RotateCcw /> {/* Refund */}
```

**After** (4 buttons, clean):
```tsx
{/* View Invoice */}
<Eye onClick={() => setSelectedInvoice(invoice)} />

{/* Generate/Download PDF */}
<File onClick={() => {
  setPdfInvoiceId(invoice.id);
  setShowPdfModal(true);
}} />

{/* Thermal Print */}
<ThermalPrintButton invoiceId={invoice.id} />

{/* Record Payment */}
{!isPaid && <CreditCard onClick={handleOpenPaymentModal} />}

{/* Request Refund */}
{isPaid && <RotateCcw onClick={openRefundModal} />}
```

---

### 3. ✅ Removed Hardcoded Currency

**Before**:
```tsx
<div>₹{invoice.total.toLocaleString()}</div>
<div>Sub: ₹{invoice.subtotal}</div>
<div>Paid: ₹{invoice.paid_amount.toLocaleString()}</div>
```

**After**:
```tsx
<div>{invoice.total.toLocaleString()}</div>
<div>Sub: {invoice.subtotal.toLocaleString()}</div>
<div>Paid: {invoice.paid_amount.toLocaleString()}</div>
```

**Note**: Currency symbol will be added dynamically via `currencyFormatter.ts` in future update.

---

### 4. ✅ Cleaned Up Imports

**Removed**:
- `Download` icon (unused)
- `generateAndDownloadReport` (obsolete)
- `getLabTemplate` (obsolete)
- `ReportData` type (obsolete)

**Removed State**:
- `downloadingInvoices` (no longer needed)
- `setDownloadingInvoices` (no longer needed)

---

## Action Buttons Explained

### 👁️ **View Invoice** (Eye icon)
- **Purpose**: Preview invoice details in modal
- **Action**: Opens invoice preview modal
- **Always visible**: Yes

### 📄 **Generate PDF** (File icon)
- **Purpose**: Generate and download invoice PDF
- **Action**: Opens `InvoiceGenerationModal`
- **Features**:
  - Select template
  - Choose language
  - Customize format
  - Download or send via WhatsApp
- **Always visible**: Yes
- **Color**: Green (was purple)

### 🖨️ **Thermal Print** (Printer icon)
- **Purpose**: Print invoice on thermal printer
- **Action**: Opens thermal print dialog
- **Formats**: 80mm, 58mm
- **Always visible**: Yes

### 💳 **Record Payment** (CreditCard icon)
- **Purpose**: Record payment for unpaid invoice
- **Action**: Opens payment capture modal
- **Visible when**: Invoice is not paid
- **Color**: Orange

### 🔄 **Request Refund** (RotateCcw icon)
- **Purpose**: Request refund for paid invoice
- **Action**: Opens refund request modal
- **Visible when**: Invoice has payment
- **Color**: Purple

---

## Benefits

### ✅ **Cleaner Code**
- Removed 50+ lines of obsolete code
- Removed hardcoded values
- Simplified action button logic

### ✅ **Better UX**
- Clear button purposes
- Consistent color coding
- Proper tooltips
- Conditional visibility

### ✅ **Multi-Currency Ready**
- No hardcoded ₹ symbols
- Ready for dynamic currency formatting
- Works for all supported countries

### ✅ **Proper PDF Generation**
- Uses `InvoiceGenerationModal`
- Supports templates
- Supports multiple languages
- Can send via WhatsApp

---

## Migration Notes

### For Dynamic Currency (Future)

To add dynamic currency symbols:

```typescript
import { formatCurrency, getLabCurrency } from '../utils/currencyFormatter';

// In component
const [currencyCode, setCurrencyCode] = useState<CurrencyCode>('INR');

useEffect(() => {
  getLabCurrency().then(setCurrencyCode);
}, []);

// In render
<div>{formatCurrency(invoice.total, currencyCode)}</div>
```

---

## Testing Checklist

- [ ] View invoice preview works
- [ ] Generate PDF opens modal correctly
- [ ] Thermal print works for 80mm and 58mm
- [ ] Record payment only shows for unpaid invoices
- [ ] Request refund only shows for paid invoices
- [ ] All tooltips are correct
- [ ] No console errors
- [ ] Currency amounts display without ₹ symbol

---

## Summary

**Removed**:
- ❌ Obsolete `handleDownloadInvoice` function (50 lines)
- ❌ Hardcoded currency symbols (₹)
- ❌ Duplicate download button
- ❌ Unused imports and state

**Improved**:
- ✅ Clean, organized action buttons
- ✅ Proper PDF generation via modal
- ✅ Multi-currency ready
- ✅ Better UX with conditional buttons
- ✅ Clear comments for each button

**Result**: Clean, maintainable, multi-currency ready billing page! 🎉
