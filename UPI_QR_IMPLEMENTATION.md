# UPI QR Code Implementation for Invoices

## Overview

Static UPI QR codes have been implemented for both **thermal receipts** (58mm/80mm) and **A4 invoice PDFs**. No external payment gateway API is required - the QR codes use the standard UPI deep link format that works with all UPI apps (PhonePe, Google Pay, Paytm, BHIM, Amazon Pay, etc.).

## How It Works

### UPI Deep Link Format
```
upi://pay?pa=UPI_ID&pn=BUSINESS_NAME&am=AMOUNT&cu=INR&tn=TRANSACTION_NOTE
```

When a customer scans the QR code with any UPI app:
1. The app opens with payment details pre-filled
2. Amount is set to the balance due
3. Transaction note includes invoice number for reference
4. Customer confirms and completes payment

## Files Modified/Created

### New Files
- `src/utils/upiQrService.ts` - Core UPI QR code generation service

### Modified Files
- `src/utils/thermalInvoiceService.ts` - Thermal receipts now include UPI QR codes
- `src/utils/invoicePdfService.ts` - A4 invoices support UPI QR placeholder

## Configuration

### Step 1: Add UPI ID to Lab Settings

Update your lab's UPI ID in the database:

```sql
UPDATE labs 
SET upi_id = 'your-lab@upi' 
WHERE id = 'your-lab-id';
```

Or via the Supabase dashboard:
1. Go to Table Editor → `labs`
2. Find your lab record
3. Add/update the `upi_id` column with your UPI VPA

### Supported UPI ID Formats
- `username@paytm`
- `username@ybl` (PhonePe)
- `username@okaxis` (Google Pay)
- `username@oksbi` (SBI)
- `merchant.username@icici`
- Any valid UPI VPA (Virtual Payment Address)

### Step 2: Update Invoice Templates (Optional)

For A4 invoices, add the `{{upi_qr_code}}` placeholder to your custom templates:

```html
<!-- Add this where you want the QR code to appear -->
{{upi_qr_code}}
```

**Note:** The default template already includes this placeholder. Only update if you're using custom templates.

## New Template Placeholders

| Placeholder | Description |
|-------------|-------------|
| `{{upi_qr_code}}` | UPI payment QR code block (only shown if balance due) |
| `{{payment_status}}` | "Paid" or "Payment Due" text |
| `{{payment_status_badge}}` | Styled payment status badge |
| `{{cgst}}` | CGST amount (9% of tax) |
| `{{sgst}}` | SGST amount (9% of tax) |
| `{{lab_gst}}` | Lab's GST number |
| `{{lab_upi}}` | Lab's UPI ID |

## Thermal Receipt Features

Thermal receipts now include:

1. **UPI QR Code** - Scannable payment QR (only if balance due)
2. **Invoice Barcode** - CODE128 barcode with invoice number
3. **Payment Status** - Clear PAID/PAYMENT DUE badge
4. **Supported Apps List** - Shows "PhonePe • GPay • Paytm • BHIM"

### Size Variations
- **80mm thermal**: Larger QR (120px), full details
- **58mm thermal**: Smaller QR (90px), condensed layout

## A4 Invoice Features

A4 PDF invoices now include:

1. **UPI Payment Block** - Professional styled block with:
   - "Scan to Pay Instantly" header
   - QR code (150px)
   - Balance amount prominently displayed
   - UPI ID for manual entry
   - Supported apps list

2. **Payment Status Badge** - Shows paid/pending status

## Conditional Display

The UPI QR code **only appears when**:
1. Lab has a valid UPI ID configured
2. Invoice has a balance due (not fully paid)
3. Amount is greater than ₹0

## Testing

### Test Thermal Receipt
```typescript
import { generateThermalInvoiceHTML } from './utils/thermalInvoiceService';

const html = await generateThermalInvoiceHTML(invoiceId, 'thermal_80mm');
// Print via window.print()
```

### Test A4 Invoice
```typescript
import { generateInvoicePDF } from './utils/invoicePdfService';

const result = await generateInvoicePDF(invoiceId, templateId);
console.log(result.pdfUrl);
```

## Troubleshooting

### QR Code Not Appearing

1. **Check UPI ID**: Ensure `labs.upi_id` is set and valid
2. **Check Balance**: QR only shows if balance > 0
3. **Validate Format**: UPI ID must contain `@` symbol

### Invalid UPI ID Format

The system validates UPI IDs with this pattern:
```
username@provider
```
- Must contain exactly one `@`
- Username: 3+ alphanumeric characters
- Provider: Valid UPI PSP handle

### Common UPI Providers
- `@paytm` - Paytm
- `@ybl` - PhonePe (Yes Bank)
- `@okaxis` - Google Pay (Axis Bank)
- `@oksbi` - Google Pay (SBI)
- `@icici` - iMobile
- `@upi` - Generic UPI

## Security Notes

1. **No Payment Gateway Required**: Uses standard UPI protocol
2. **No API Keys**: QR generation is client-side
3. **No Transaction Fees**: Direct bank-to-bank transfer
4. **No Sensitive Data**: Only UPI ID is stored

## B2B Invoice Compliance

For GST-compliant B2B invoices:
- Use `{{cgst}}` and `{{sgst}}` for split GST display
- Add `{{lab_gst}}` to show lab's GST number
- Consider adding HSN/SAC codes to test items

## Future Enhancements

Potential additions:
1. Payment status auto-update via UPI callback (requires payment gateway)
2. Multiple UPI IDs per lab (different banks)
3. QR code with logo overlay
4. Dynamic QR refresh for real-time balance updates
