import { database, supabase } from './supabase';
import { generateUPIQRCodeDataURL, generateUPIPaymentLink, isValidUPIId } from './upiQrService';
import JsBarcode from 'jsbarcode';

// Helper function to fetch invoice data with UPI details (location + lab fallback)
async function fetchInvoiceData(invoiceId: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      patient:patients(*),
      invoice_items(*),
      lab:labs(name, address, phone, email, gst_number, upi_id, bank_details),
      location:locations(id, name, address, phone, email, contact_person, upi_id, bank_details)
    `)
    .eq('id', invoiceId)
    .single();

  if (error) throw error;
  return data;
}

// Generate barcode as data URL
async function generateBarcodeDataURL(text: string, height: number = 40): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, text, {
        format: 'CODE128',
        width: 1.5,
        height: height,
        displayValue: false,
        margin: 0,
      });
      resolve(canvas.toDataURL('image/png'));
    } catch (error) {
      console.error('Barcode generation failed:', error);
      resolve(''); // Return empty on error
    }
  });
}

// Helper function to validate invoice
async function validateInvoiceForPdf(invoice: any) {
  if (!invoice.total || invoice.total <= 0) {
    throw new Error('Invoice total must be greater than 0');
  }
  return true;
}

// Helper function to generate invoice number
async function generateInvoiceNumber(invoice: any) {
  const year = new Date().getFullYear().toString().slice(-2);
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  // Get count of invoices this month for this lab
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('lab_id', invoice.lab_id)
    .gte('created_at', `${new Date().getFullYear()}-${month}-01`);

  const sequence = String((count || 0) + 1).padStart(4, '0');
  return `INV-${year}${month}-${sequence}`;
}

/**
 * Generate Thermal Invoice HTML with UPI QR Code & Barcode
 */
export async function generateThermalInvoiceHTML(
  invoiceId: string,
  format: 'thermal_80mm' | 'thermal_58mm' = 'thermal_80mm'
): Promise<string> {
  try {
    // 1. Fetch invoice data
    const invoice = await fetchInvoiceData(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // 2. Financial validation
    await validateInvoiceForPdf(invoice);

    // 3. Generate invoice number if not exists
    if (!invoice.invoice_number) {
      invoice.invoice_number = await generateInvoiceNumber(invoice);
      
      await supabase
        .from('invoices')
        .update({ invoice_number: invoice.invoice_number })
        .eq('id', invoiceId);
    }

    // 4. Calculate balance due
    const balanceDue = invoice.total - (invoice.amount_paid || 0);
    const isPaid = balanceDue <= 0;

    // 5. Generate UPI QR Code - prioritize location UPI ID, fallback to lab UPI ID
    let upiQrHtml = '';
    // Location-wise UPI: Check location first, then fall back to lab
    const locationUpiId = invoice.location?.upi_id || invoice.location?.bank_details?.upi_id;
    const labUpiId = invoice.lab?.upi_id || invoice.lab?.bank_details?.upi_id;
    const effectiveUpiId = locationUpiId || labUpiId;
    
    if (effectiveUpiId && isValidUPIId(effectiveUpiId) && !isPaid && balanceDue > 0) {
      try {
        const qrSize = format === 'thermal_80mm' ? 120 : 90;
        // Use location name if location has UPI, else use lab name
        const payeeName = locationUpiId ? (invoice.location?.name || invoice.lab?.name || 'Lab') : (invoice.lab?.name || 'Lab');
        const qrDataURL = await generateUPIQRCodeDataURL({
          upiId: effectiveUpiId,
          payeeName,
          amount: balanceDue,
          transactionNote: `INV-${invoice.invoice_number}`,
        }, { size: qrSize });

        upiQrHtml = `
          <div class="line"></div>
          <div class="center bold" style="font-size: ${format === 'thermal_80mm' ? '12px' : '10px'}; margin: 5px 0;">
            SCAN TO PAY
          </div>
          <div class="center">
            <img src="${qrDataURL}" alt="UPI QR" style="width: ${qrSize}px; height: ${qrSize}px;" />
          </div>
          <div class="center" style="font-size: 9px; margin: 3px 0;">
            UPI: ${effectiveUpiId}
          </div>
          <div class="center bold" style="font-size: ${format === 'thermal_80mm' ? '14px' : '12px'}; color: #000;">
            Pay ₹${balanceDue.toFixed(2)}
          </div>
          <div class="center" style="font-size: 8px; color: #666;">
            PhonePe • GPay • Paytm • BHIM
          </div>
        `;
      } catch (qrError) {
        console.error('UPI QR generation failed:', qrError);
      }
    }

    // 6. Generate Invoice Barcode
    let barcodeHtml = '';
    try {
      const barcodeHeight = format === 'thermal_80mm' ? 35 : 25;
      const barcodeDataURL = await generateBarcodeDataURL(invoice.invoice_number, barcodeHeight);
      if (barcodeDataURL) {
        barcodeHtml = `
          <div class="center" style="margin: 5px 0;">
            <img src="${barcodeDataURL}" alt="Barcode" style="max-width: ${format === 'thermal_80mm' ? '70mm' : '48mm'}; height: ${barcodeHeight}px;" />
          </div>
          <div class="center" style="font-size: 9px;">${invoice.invoice_number}</div>
        `;
      }
    } catch (barcodeError) {
      console.error('Barcode generation failed:', barcodeError);
    }

    // 7. Payment status badge
    const statusBadge = isPaid 
      ? `<div class="center bold" style="background: #d4edda; color: #155724; padding: 5px; margin: 5px 0; font-size: ${format === 'thermal_80mm' ? '14px' : '12px'};">✓ PAID</div>`
      : `<div class="center bold" style="background: #fff3cd; color: #856404; padding: 5px; margin: 5px 0; font-size: ${format === 'thermal_80mm' ? '14px' : '12px'};">PAYMENT DUE: ₹${balanceDue.toFixed(2)}</div>`;

    // 8. Generate thermal HTML
    const width = format === 'thermal_80mm' ? '80mm' : '58mm';
    const fontSize = format === 'thermal_80mm' ? '12px' : '10px';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page { 
            size: ${width} auto; 
            margin: 0; 
          }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
          * { box-sizing: border-box; }
          body { 
            width: ${width}; 
            font-family: 'Courier New', 'Lucida Console', monospace; 
            font-size: ${fontSize};
            margin: 0;
            padding: 3mm;
            line-height: 1.3;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .line { border-top: 1px dashed #000; margin: 6px 0; }
          .double-line { border-top: 3px double #000; margin: 6px 0; }
          .right { text-align: right; }
          .item-row { 
            display: flex; 
            justify-content: space-between; 
            margin: 3px 0;
            gap: 5px;
          }
          .item-row > div:first-child {
            flex: 1;
            word-break: break-word;
          }
          .item-row > div:last-child {
            flex-shrink: 0;
            text-align: right;
          }
          .header-title {
            font-size: ${format === 'thermal_80mm' ? '16px' : '13px'};
            font-weight: bold;
            margin-bottom: 3px;
          }
          .sub-text {
            font-size: ${format === 'thermal_80mm' ? '10px' : '9px'};
            color: #333;
          }
          .total-row {
            font-size: ${format === 'thermal_80mm' ? '14px' : '12px'};
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="center header-title">${invoice.lab?.name || 'Laboratory'}</div>
        <div class="center sub-text">${invoice.lab?.address || ''}</div>
        <div class="center sub-text">Ph: ${invoice.lab?.phone || ''} ${invoice.lab?.email ? `| ${invoice.lab.email}` : ''}</div>
        ${invoice.lab?.gst_number ? `<div class="center sub-text">GSTIN: ${invoice.lab.gst_number}</div>` : ''}
        
        <div class="double-line"></div>
        
        <!-- Invoice Info -->
        <div class="center bold" style="font-size: ${format === 'thermal_80mm' ? '13px' : '11px'};">INVOICE / RECEIPT</div>
        <div class="item-row">
          <div>Invoice #:</div>
          <div class="bold">${invoice.invoice_number}</div>
        </div>
        <div class="item-row">
          <div>Date:</div>
          <div>${new Date(invoice.invoice_date).toLocaleDateString('en-IN')}</div>
        </div>
        <div class="item-row">
          <div>Time:</div>
          <div>${new Date(invoice.invoice_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        
        <div class="line"></div>
        
        <!-- Patient Info -->
        <div class="bold">Patient: ${invoice.patient_name}</div>
        ${invoice.patient?.phone ? `<div class="sub-text">Phone: ${invoice.patient.phone}</div>` : ''}
        
        <div class="line"></div>
        
        <!-- Items -->
        <div class="bold" style="margin-bottom: 5px;">Tests/Services:</div>
        ${(invoice.invoice_items || []).map((item: any, index: number) => `
          <div class="item-row">
            <div>${index + 1}. ${item.test_name}</div>
            <div>₹${item.price.toFixed(2)}</div>
          </div>
        `).join('')}
        
        <div class="line"></div>
        
        <!-- Totals -->
        <div class="item-row">
          <div>Subtotal:</div>
          <div>₹${invoice.subtotal.toFixed(2)}</div>
        </div>
        ${invoice.discount > 0 ? `
          <div class="item-row" style="color: #28a745;">
            <div>Discount:</div>
            <div>-₹${invoice.discount.toFixed(2)}</div>
          </div>
        ` : ''}
        ${invoice.tax > 0 ? `
          <div class="item-row">
            <div>Tax (GST):</div>
            <div>₹${invoice.tax.toFixed(2)}</div>
          </div>
        ` : ''}
        
        <div class="double-line"></div>
        
        <div class="item-row total-row">
          <div>GRAND TOTAL:</div>
          <div>₹${invoice.total.toFixed(2)}</div>
        </div>
        
        ${invoice.amount_paid > 0 ? `
          <div class="item-row" style="color: #28a745;">
            <div>Amount Paid:</div>
            <div>₹${invoice.amount_paid.toFixed(2)}</div>
          </div>
          <div class="item-row bold" style="color: ${isPaid ? '#28a745' : '#dc3545'};">
            <div>Balance Due:</div>
            <div>₹${balanceDue.toFixed(2)}</div>
          </div>
        ` : ''}
        
        <!-- Payment Status -->
        ${statusBadge}
        
        <!-- UPI QR Code (if balance due) -->
        ${upiQrHtml}
        
        <!-- Barcode -->
        ${barcodeHtml}
        
        <div class="line"></div>
        
        <!-- Footer -->
        <div class="center bold" style="margin: 8px 0;">Thank You for Choosing Us!</div>
        <div class="center sub-text">This is a computer generated receipt.</div>
        <div class="center sub-text">Please retain for your records.</div>
        
      </body>
      </html>
    `;

    return html;
  } catch (error) {
    console.error('Thermal invoice generation failed:', error);
    throw error;
  }
}

/**
 * Print Thermal Invoice (opens print dialog)
 */
export async function printThermalInvoice(
  invoiceId: string,
  format: 'thermal_80mm' | 'thermal_58mm' = 'thermal_80mm'
): Promise<void> {
  try {
    // Generate HTML
    const html = await generateThermalInvoiceHTML(invoiceId, format);

    // Open print window
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    
    if (!printWindow) {
      throw new Error('Popup blocked. Please allow popups for thermal printing.');
    }

    printWindow.document.write(html);
    printWindow.document.close();
    
    // Wait for content to load
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      
      // Close after printing (optional)
      setTimeout(() => {
        printWindow.close();
      }, 100);
    };

  } catch (error) {
    console.error('Thermal invoice print failed:', error);
    throw error;
  }
}
