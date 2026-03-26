# PDF Generation Integration Guide

## Step 1: Add Import to generate-pdf-auto/index.ts

At the TOP of the file (around line 5-10), add:

```typescript
import { 
  fetchHeaderFooter, 
  getDefaultHeaderHTML, 
  getDefaultFooterHTML 
} from './headerFooterHelper.ts';
```

---

## Step 2: Find the PDF Generation Section

Search for one of these in the file:
- `PDFCO_API_URL`
- `pdf.co`
- `html:` (in the payload)
- `const pdfPayload`

You should find a section that creates the PDF payload.

---

## Step 3: Add Header/Footer Fetching Logic

**BEFORE** the PDF payload is created, add this code:

```typescript
// ============================================
// FETCH CUSTOM HEADER/FOOTER
// ============================================

console.log('[PDF] Fetching custom header/footer for order:', orderId);

// Fetch custom header/footer based on priority (B2B Account > Location > Lab)
const customHeader = await fetchHeaderFooter(supabase, orderId, 'header');
const customFooter = await fetchHeaderFooter(supabase, orderId, 'footer');

// Get lab info for default templates
const { data: labInfo, error: labError } = await supabase
  .from('labs')
  .select('name, logo_url, address, phone, website, email')
  .eq('id', order.lab_id)
  .single();

if (labError) {
  console.error('[PDF] Error fetching lab info:', labError);
}

// Use custom or default
const headerHTML = customHeader || getDefaultHeaderHTML(labInfo || {
  name: 'Lab Name',
  logo_url: '',
  address: '',
  phone: '',
  website: '',
  email: ''
});

const footerHTML = customFooter || getDefaultFooterHTML(labInfo || {
  name: 'Lab Name',
  website: ''
});

console.log('[PDF] Using header:', customHeader ? 'Custom' : 'Default');
console.log('[PDF] Using footer:', customFooter ? 'Custom' : 'Default');
```

---

## Step 4: Update PDF Payload

Find where the PDF payload is created. It might look like:

```typescript
const pdfPayload = {
  html: reportHTML,
  // ... other settings
};
```

**UPDATE IT TO:**

```typescript
const pdfPayload = {
  html: reportHTML,
  headerTemplate: headerHTML,  // ← ADD THIS
  footerTemplate: footerHTML,  // ← ADD THIS
  displayHeaderFooter: true,   // ← ADD THIS
  // ... rest of your existing settings
  margins: '180px 20px 150px 20px',  // Adjust if needed
  headerHeight: '120px',  // Adjust if needed
  footerHeight: '80px',   // Adjust if needed
};
```

---

## Step 5: Test

1. Deploy the function:
   ```bash
   supabase functions deploy generate-pdf-auto
   ```

2. Generate a test report

3. Check console logs for:
   ```
   [PDF] Fetching custom header/footer for order: xxx
   [PDF] Using header: Custom (or Default)
   [PDF] Using footer: Custom (or Default)
   ```

---

## Example: Complete Integration

Here's what the complete section might look like:

```typescript
// ... existing code ...

// Get order details
const { data: order, error: orderError } = await supabase
  .from('orders')
  .select('*')
  .eq('id', orderId)
  .single();

if (orderError) throw orderError;

// ============================================
// FETCH CUSTOM HEADER/FOOTER (NEW CODE)
// ============================================

console.log('[PDF] Fetching custom header/footer for order:', orderId);

const customHeader = await fetchHeaderFooter(supabase, orderId, 'header');
const customFooter = await fetchHeaderFooter(supabase, orderId, 'footer');

const { data: labInfo } = await supabase
  .from('labs')
  .select('name, logo_url, address, phone, website, email')
  .eq('id', order.lab_id)
  .single();

const headerHTML = customHeader || getDefaultHeaderHTML(labInfo || {});
const footerHTML = customFooter || getDefaultFooterHTML(labInfo || {});

console.log('[PDF] Using header:', customHeader ? 'Custom' : 'Default');
console.log('[PDF] Using footer:', customFooter ? 'Custom' : 'Default');

// ============================================
// GENERATE PDF (EXISTING CODE WITH UPDATES)
// ============================================

const pdfPayload = {
  html: reportHTML,
  headerTemplate: headerHTML,  // NEW
  footerTemplate: footerHTML,  // NEW
  displayHeaderFooter: true,   // NEW
  margins: '180px 20px 150px 20px',
  headerHeight: '120px',
  footerHeight: '80px',
  // ... rest of existing settings
};

// ... rest of PDF generation code ...
```

---

## Troubleshooting

### Issue: Import error
**Solution**: Make sure `headerFooterHelper.ts` is in the same directory as `index.ts`

### Issue: Headers not showing
**Solution**: 
- Check `displayHeaderFooter: true` is set
- Verify `headerHeight` and `footerHeight` are set
- Check margins have enough space

### Issue: "fetchHeaderFooter is not defined"
**Solution**: Verify the import statement is at the top of the file

---

## Quick Test Checklist

- [ ] Import added at top of file
- [ ] Header/footer fetching code added
- [ ] PDF payload updated with headerTemplate and footerTemplate
- [ ] displayHeaderFooter set to true
- [ ] Function deployed
- [ ] Test report generated
- [ ] Console logs show correct header/footer usage

---

**Need help finding the right place?**

Search for these patterns in the file:
1. `const pdfPayload` or `pdfPayload =`
2. `html:` followed by `reportHTML` or similar
3. `PDF.co` or `PDFCO`
4. `fetch(PDFCO_API_URL`

The PDF payload creation is usually near these patterns.
