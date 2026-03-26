/**
 * Thermal Invoice HTML Generator
 * 
 * Generates thermal receipt-style HTML for 58mm and 80mm thermal printers.
 * Designed for browser printing (Ctrl+P / window.print()) - no ESC/POS commands needed.
 * 
 * Features:
 * - Responsive width (58mm or 80mm)
 * - Barcode generation (CODE128/QR)
 * - Optimized for thermal printer drivers
 * - Clean, receipt-style layout
 */

import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

export interface ThermalInvoiceConfig {
  width_mm: number;           // 58 or 80
  font_size: string;          // e.g., '10px', '11px', '12px'
  line_spacing: string;       // e.g., '1.2', '1.3'
  margins: string;            // e.g., '3mm', '5mm'
  barcode_height: string;     // e.g., '30px', '40px'
  barcode_format: 'CODE128' | 'QR';
  include_logo: boolean;
  logo_height: string;        // e.g., '35px'
  show_barcode: boolean;
  auto_cut: boolean;          // Not used for browser print, kept for compatibility
}

export interface ThermalInvoiceData {
  invoice_number: string;
  invoice_date: string;
  patient_name: string;
  patient_phone?: string;
  items: Array<{
    test_name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amount_paid?: number;
  balance?: number;
  lab_name: string;
  lab_address?: string;
  lab_phone?: string;
  lab_email?: string;
  lab_logo?: string;
  payment_terms?: string;
  doctor?: string;
}

/**
 * Generate thermal invoice HTML
 */
export async function generateThermalInvoiceHtml(
  data: ThermalInvoiceData,
  config: ThermalInvoiceConfig
): Promise<string> {
  const width = `${config.width_mm}mm`;
  const is58mm = config.width_mm === 58;
  
  // Generate barcode if enabled
  let barcodeHtml = '';
  if (config.show_barcode) {
    barcodeHtml = await generateBarcodeHtml(
      data.invoice_number,
      config.barcode_format,
      config.barcode_height,
      is58mm
    );
  }
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${width}">
  <title>Invoice ${data.invoice_number}</title>
  <style>
    /* Page settings for thermal printer */
    @page {
      size: ${width} auto;
      margin: 0;
    }
    
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      width: ${width};
      font-family: 'Courier New', 'Courier', monospace;
      font-size: ${config.font_size};
      line-height: ${config.line_spacing};
      padding: ${config.margins};
      background: white;
      color: #000;
    }
    
    /* Header Section */
    .header {
      text-align: center;
      margin-bottom: ${is58mm ? '5px' : '8px'};
      padding-bottom: ${is58mm ? '5px' : '8px'};
      border-bottom: 1px dashed #000;
    }
    
    .logo {
      max-width: ${is58mm ? '50%' : '60%'};
      max-height: ${config.logo_height};
      margin: 0 auto ${is58mm ? '3px' : '5px'};
      display: ${config.include_logo && data.lab_logo ? 'block' : 'none'};
    }
    
    .lab-name {
      font-weight: bold;
      font-size: ${is58mm ? '13px' : '16px'};
      margin-bottom: 3px;
      text-transform: uppercase;
    }
    
    .lab-info {
      font-size: ${is58mm ? '9px' : '10px'};
      line-height: 1.3;
      margin-bottom: 2px;
    }
    
    /* Invoice Details */
    .invoice-details {
      margin: ${is58mm ? '6px 0' : '8px 0'};
      font-size: ${is58mm ? '10px' : '11px'};
      line-height: 1.4;
    }
    
    .invoice-details .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
    }
    
    .invoice-details .label {
      font-weight: bold;
    }
    
    /* Barcode Section */
    .barcode-container {
      text-align: center;
      margin: ${is58mm ? '6px 0' : '10px 0'};
      padding: ${is58mm ? '5px 0' : '8px 0'};
      border-top: 1px dashed #000;
      border-bottom: 1px dashed #000;
    }
    
    .barcode {
      max-width: 100%;
      height: auto;
      margin: 0 auto;
    }
    
    .barcode-text {
      font-size: ${is58mm ? '9px' : '10px'};
      margin-top: 3px;
      font-family: 'Courier New', monospace;
      letter-spacing: 2px;
    }
    
    /* Items Table */
    .items {
      margin: ${is58mm ? '6px 0' : '8px 0'};
      border-top: 1px dashed #000;
      padding-top: ${is58mm ? '5px' : '8px'};
    }
    
    .items-header {
      display: flex;
      justify-content: space-between;
      font-weight: bold;
      margin-bottom: 3px;
      padding-bottom: 3px;
      border-bottom: 1px solid #000;
      font-size: ${is58mm ? '10px' : '11px'};
    }
    
    .item {
      display: flex;
      justify-content: space-between;
      margin: ${is58mm ? '3px 0' : '4px 0'};
      font-size: ${is58mm ? '10px' : '11px'};
    }
    
    .item-name {
      flex: 1;
      padding-right: 5px;
      ${is58mm ? 'max-width: 70%;' : ''}
      word-wrap: break-word;
    }
    
    .item-price {
      text-align: right;
      white-space: nowrap;
      font-weight: bold;
    }
    
    /* Totals Section */
    .totals {
      margin: ${is58mm ? '6px 0' : '8px 0'};
      border-top: 1px dashed #000;
      padding-top: ${is58mm ? '5px' : '8px'};
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
      font-size: ${is58mm ? '10px' : '11px'};
    }
    
    .total-row.grand {
      font-weight: bold;
      font-size: ${is58mm ? '12px' : '14px'};
      border-top: 1px solid #000;
      padding-top: 5px;
      margin-top: 5px;
    }
    
    /* Payment Info */
    .payment-info {
      margin: ${is58mm ? '6px 0' : '8px 0'};
      font-size: ${is58mm ? '10px' : '11px'};
    }
    
    /* Footer */
    .footer {
      text-align: center;
      margin-top: ${is58mm ? '8px' : '12px'};
      padding-top: ${is58mm ? '6px' : '8px'};
      border-top: 1px dashed #000;
      font-size: ${is58mm ? '9px' : '10px'};
      line-height: 1.4;
    }
    
    .footer-message {
      font-weight: bold;
      margin-bottom: 3px;
    }
    
    /* Print button (hidden on print) */
    .print-button {
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 10px 20px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      z-index: 1000;
    }
    
    .print-button:hover {
      background: #45a049;
    }
    
    @media print {
      .print-button {
        display: none;
      }
    }
  </style>
</head>
<body>
  <!-- Print Button (only visible on screen) -->
  <button class="print-button no-print" onclick="window.print()">🖨️ Print Invoice</button>

  <!-- Header -->
  <div class="header">
    ${config.include_logo && data.lab_logo ? `
      <img src="${data.lab_logo}" class="logo" alt="${data.lab_name}">
    ` : ''}
    <div class="lab-name">${data.lab_name}</div>
    ${data.lab_address ? `<div class="lab-info">${data.lab_address}</div>` : ''}
    ${data.lab_phone ? `<div class="lab-info">Ph: ${data.lab_phone}</div>` : ''}
    ${data.lab_email ? `<div class="lab-info">${data.lab_email}</div>` : ''}
  </div>
  
  <!-- Invoice Details -->
  <div class="invoice-details">
    <div class="row">
      <span class="label">Invoice:</span>
      <span>${data.invoice_number}</span>
    </div>
    <div class="row">
      <span class="label">Date:</span>
      <span>${formatDateForReceipt(data.invoice_date)}</span>
    </div>
    <div class="row">
      <span class="label">Patient:</span>
      <span>${data.patient_name}</span>
    </div>
    ${data.patient_phone ? `
      <div class="row">
        <span class="label">Phone:</span>
        <span>${data.patient_phone}</span>
      </div>
    ` : ''}
    ${data.doctor ? `
      <div class="row">
        <span class="label">Doctor:</span>
        <span>${data.doctor}</span>
      </div>
    ` : ''}
  </div>
  
  <!-- Barcode -->
  ${barcodeHtml}
  
  <!-- Items -->
  <div class="items">
    <div class="items-header">
      <span>Item</span>
      <span>Amount</span>
    </div>
    ${data.items.map(item => `
      <div class="item">
        <span class="item-name">${item.test_name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}</span>
        <span class="item-price">₹${item.total.toFixed(2)}</span>
      </div>
    `).join('')}
  </div>
  
  <!-- Totals -->
  <div class="totals">
    <div class="total-row">
      <span>Subtotal:</span>
      <span>₹${data.subtotal.toFixed(2)}</span>
    </div>
    ${data.discount > 0 ? `
      <div class="total-row">
        <span>Discount:</span>
        <span>-₹${data.discount.toFixed(2)}</span>
      </div>
    ` : ''}
    ${data.tax > 0 ? `
      <div class="total-row">
        <span>Tax:</span>
        <span>₹${data.tax.toFixed(2)}</span>
      </div>
    ` : ''}
    <div class="total-row grand">
      <span>TOTAL:</span>
      <span>₹${data.total.toFixed(2)}</span>
    </div>
  </div>
  
  <!-- Payment Info -->
  ${data.amount_paid !== undefined ? `
    <div class="payment-info">
      <div class="total-row">
        <span>Paid:</span>
        <span>₹${data.amount_paid.toFixed(2)}</span>
      </div>
      ${data.balance !== undefined && data.balance > 0 ? `
        <div class="total-row" style="font-weight: bold;">
          <span>Balance Due:</span>
          <span>₹${data.balance.toFixed(2)}</span>
        </div>
      ` : ''}
    </div>
  ` : ''}
  
  <!-- Footer -->
  <div class="footer">
    <div class="footer-message">${data.payment_terms || 'Thank you for your visit!'}</div>
    ${!is58mm && data.lab_email ? `<div>Email: ${data.lab_email}</div>` : ''}
    <div style="margin-top: 8px; font-size: ${is58mm ? '8px' : '9px'};">
      This is a computer-generated invoice
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate barcode HTML (CODE128 or QR)
 */
async function generateBarcodeHtml(
  text: string,
  format: 'CODE128' | 'QR',
  height: string,
  is58mm: boolean
): Promise<string> {
  try {
    if (format === 'QR') {
      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(text, {
        width: is58mm ? 120 : 150,
        margin: 1,
        errorCorrectionLevel: 'M'
      });
      
      return `
        <div class="barcode-container">
          <img src="${qrDataUrl}" class="barcode" alt="QR Code">
          <div class="barcode-text">${text}</div>
        </div>
      `;
    } else {
      // Generate CODE128 barcode as SVG
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, text, {
        format: 'CODE128',
        width: is58mm ? 1.5 : 2,
        height: parseInt(height) || 40,
        displayValue: false,
        margin: 5
      });
      
      const barcodeDataUrl = canvas.toDataURL('image/png');
      
      return `
        <div class="barcode-container">
          <img src="${barcodeDataUrl}" class="barcode" alt="Barcode">
          <div class="barcode-text">${text}</div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Barcode generation error:', error);
    // Fallback: just show text
    return `
      <div class="barcode-container">
        <div class="barcode-text" style="font-size: 14px; font-weight: bold;">${text}</div>
      </div>
    `;
  }
}

/**
 * Format date for receipt (short format)
 */
function formatDateForReceipt(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Open thermal invoice in new window for printing
 */
export async function printThermalInvoice(
  data: ThermalInvoiceData,
  config: ThermalInvoiceConfig
): Promise<void> {
  const html = await generateThermalInvoiceHtml(data, config);
  
  // Open in new window
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  
  if (!printWindow) {
    alert('Please allow popups to print thermal invoices');
    return;
  }
  
  printWindow.document.write(html);
  printWindow.document.close();
  
  // Auto-trigger print dialog after load
  printWindow.onload = () => {
    printWindow.focus();
    // Small delay to ensure fonts are loaded
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}
