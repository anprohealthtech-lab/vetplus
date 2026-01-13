import { database, supabase } from './supabase';

// Helper function to fetch invoice data
async function fetchInvoiceData(invoiceId: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      patient:patients(*),
      invoice_items(*),
      lab:labs(name, address, phone, email, gst_number)
    `)
    .eq('id', invoiceId)
    .single();

  if (error) throw error;
  return data;
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
 * Generate Thermal Invoice HTML
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

    // 4. Generate thermal HTML
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
          }
          body { 
            width: ${width}; 
            font-family: 'Courier New', monospace; 
            font-size: ${fontSize};
            margin: 5mm;
            padding: 0;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .line { border-top: 1px dashed #000; margin: 5px 0; }
          .right { text-align: right; }
          .item-row { display: flex; justify-content: space-between; margin: 3px 0; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size: ${format === 'thermal_80mm' ? '14px' : '12px'};">
          ${invoice.lab?.name || 'Lab'}
        </div>
        <div class="center">${invoice.lab?.address || ''}</div>
        <div class="center">Ph: ${invoice.lab?.phone || ''}</div>
        ${invoice.lab?.gst_number ? `<div class="center">GST: ${invoice.lab.gst_number}</div>` : ''}
        <div class="line"></div>
        
        <div class="bold">Invoice: ${invoice.invoice_number}</div>
        <div>Date: ${new Date(invoice.invoice_date).toLocaleDateString()}</div>
        <div>Patient: ${invoice.patient_name}</div>
        ${invoice.patient?.phone ? `<div>Phone: ${invoice.patient.phone}</div>` : ''}
        <div class="line"></div>
        
        ${(invoice.invoice_items || []).map((item: any) => `
          <div class="item-row">
            <div style="flex: 1;">${item.test_name}</div>
            <div>${item.price.toFixed(2)}</div>
          </div>
        `).join('')}
        
        <div class="line"></div>
        <div class="item-row">
          <div>Subtotal:</div>
          <div>${invoice.subtotal.toFixed(2)}</div>
        </div>
        ${invoice.discount > 0 ? `
          <div class="item-row">
            <div>Discount:</div>
            <div>-${invoice.discount.toFixed(2)}</div>
          </div>
        ` : ''}
        ${invoice.tax > 0 ? `
          <div class="item-row">
            <div>Tax:</div>
            <div>${invoice.tax.toFixed(2)}</div>
          </div>
        ` : ''}
        <div class="line"></div>
        <div class="item-row bold" style="font-size: ${format === 'thermal_80mm' ? '14px' : '12px'};">
          <div>TOTAL:</div>
          <div>${invoice.total.toFixed(2)}</div>
        </div>
        ${invoice.amount_paid > 0 ? `
          <div class="item-row">
            <div>Paid:</div>
            <div>${invoice.amount_paid.toFixed(2)}</div>
          </div>
          <div class="item-row bold">
            <div>Balance:</div>
            <div>${(invoice.total - invoice.amount_paid).toFixed(2)}</div>
          </div>
        ` : ''}
        <div class="line"></div>
        <div class="center">Thank You!</div>
        ${invoice.lab?.email ? `<div class="center" style="font-size: 10px;">${invoice.lab.email}</div>` : ''}
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
