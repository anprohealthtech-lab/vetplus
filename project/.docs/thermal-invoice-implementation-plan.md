# Thermal Printer Invoice Integration Plan

## Overview
Implementation plan for adding thermal printer support to the invoice generation system, including barcode integration and printer-specific layouts.

---

## Current System Analysis

### Existing Invoice Generation Flow
1. **Template System**: Uses `invoice_templates` table with CKEditor/GrapesJS HTML/CSS
2. **PDF Generation**: Calls Edge Function `generate-invoice-pdf` which uses PDF.co API
3. **Storage**: PDFs saved to Supabase Storage
4. **Format**: Currently only A4 paper format (210mm x 297mm)

### Database Schema
```sql
invoice_templates (
  id, lab_id, template_name,
  gjs_html, gjs_css,
  is_default, is_active,
  format_type,  -- NEW: 'a4', 'thermal_80mm', 'thermal_58mm'
  print_mode,   -- NEW: 'pdf', 'thermal', 'both'
  ...
)
```

---

## Implementation Plan

### Phase 1: Database Schema Updates

#### 1.1 Add Thermal Template Support
```sql
-- Migration: Add thermal printer support columns

ALTER TABLE invoice_templates 
ADD COLUMN IF NOT EXISTS format_type VARCHAR(20) DEFAULT 'a4' 
  CHECK (format_type IN ('a4', 'thermal_80mm', 'thermal_58mm', 'thermal_custom'));

ADD COLUMN IF NOT EXISTS print_mode VARCHAR(20) DEFAULT 'pdf' 
  CHECK (print_mode IN ('pdf', 'thermal', 'both'));

ADD COLUMN IF NOT EXISTS thermal_settings JSONB DEFAULT '{
  "width_mm": 80,
  "paper_size": "80mm",
  "font_size": "12px",
  "line_spacing": "1.2",
  "margins": "5mm",
  "barcode_height": "40px",
  "barcode_width": "200px",
  "barcode_format": "CODE128",
  "include_logo": true,
  "logo_height": "40px",
  "auto_cut": true
}'::jsonb;

COMMENT ON COLUMN invoice_templates.format_type IS 
  'Invoice format: a4 (standard PDF), thermal_80mm, thermal_58mm, thermal_custom';
  
COMMENT ON COLUMN invoice_templates.print_mode IS 
  'Generation mode: pdf (A4 only), thermal (thermal only), both (generate both formats)';
  
COMMENT ON COLUMN invoice_templates.thermal_settings IS 
  'Thermal printer configuration: width, font size, barcode settings, etc.';
```

#### 1.2 Add Print Configuration to Labs
```sql
ALTER TABLE labs 
ADD COLUMN IF NOT EXISTS default_print_mode VARCHAR(20) DEFAULT 'pdf'
  CHECK (default_print_mode IN ('pdf', 'thermal', 'both'));

ADD COLUMN IF NOT EXISTS thermal_printer_model VARCHAR(100);
  -- e.g., 'Epson TM-T20', 'Star TSP100', 'Custom VKP80'

ADD COLUMN IF NOT EXISTS thermal_paper_width INTEGER DEFAULT 80;
  -- 58 or 80 (mm)

COMMENT ON COLUMN labs.default_print_mode IS 
  'Default invoice generation mode for this lab';
```

---

### Phase 2: Thermal Template HTML Generator

#### 2.1 Create Thermal Template Builder
**File**: `src/utils/thermalInvoiceGenerator.ts`

```typescript
interface ThermalInvoiceConfig {
  width_mm: number;          // 58 or 80
  font_size: string;         // '10px', '12px'
  margins: string;           // '5mm'
  barcode_height: string;    // '40px'
  barcode_format: 'CODE128' | 'QR' | 'CODE39';
  include_logo: boolean;
  auto_cut: boolean;
}

interface ThermalInvoiceData {
  invoice_number: string;
  invoice_date: string;
  patient_name: string;
  items: Array<{
    test_name: string;
    price: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  lab_name: string;
  lab_address: string;
  lab_phone: string;
  lab_logo?: string;
}

export async function generateThermalInvoiceHtml(
  data: ThermalInvoiceData,
  config: ThermalInvoiceConfig
): Promise<string> {
  const width = `${config.width_mm}mm`;
  
  // Generate barcode SVG or use barcode generator library
  const barcodeHtml = await generateBarcode(
    data.invoice_number,
    config.barcode_format,
    config.barcode_height
  );
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page {
          size: ${width} auto;
          margin: ${config.margins};
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          width: ${width};
          font-family: 'Courier New', monospace;
          font-size: ${config.font_size};
          line-height: 1.4;
          padding: ${config.margins};
        }
        .header {
          text-align: center;
          margin-bottom: 10px;
          border-bottom: 1px dashed #000;
          padding-bottom: 8px;
        }
        .logo {
          max-width: 60%;
          max-height: ${config.include_logo ? '40px' : '0'};
          margin-bottom: 5px;
        }
        .title {
          font-weight: bold;
          font-size: 16px;
          margin: 5px 0;
        }
        .barcode-container {
          text-align: center;
          margin: 10px 0;
        }
        .barcode {
          max-width: 100%;
          height: ${config.barcode_height};
        }
        .invoice-details {
          margin: 10px 0;
          font-size: 11px;
        }
        .items {
          margin: 10px 0;
          border-top: 1px dashed #000;
          border-bottom: 1px dashed #000;
          padding: 8px 0;
        }
        .item {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
        }
        .totals {
          margin: 10px 0;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
        }
        .total-row.grand {
          font-weight: bold;
          font-size: 14px;
          border-top: 1px solid #000;
          padding-top: 5px;
        }
        .footer {
          text-align: center;
          margin-top: 15px;
          font-size: 10px;
          border-top: 1px dashed #000;
          padding-top: 8px;
        }
        ${config.auto_cut ? '.cut-line { page-break-after: always; }' : ''}
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="header">
        ${config.include_logo && data.lab_logo ? `
          <img src="${data.lab_logo}" class="logo" alt="Lab Logo">
        ` : ''}
        <div class="title">${data.lab_name}</div>
        <div>${data.lab_address}</div>
        <div>Ph: ${data.lab_phone}</div>
      </div>
      
      <!-- Invoice Details -->
      <div class="invoice-details">
        <div><strong>Invoice:</strong> ${data.invoice_number}</div>
        <div><strong>Date:</strong> ${formatDate(data.invoice_date)}</div>
        <div><strong>Patient:</strong> ${data.patient_name}</div>
      </div>
      
      <!-- Barcode -->
      <div class="barcode-container">
        ${barcodeHtml}
        <div style="font-size: 10px; margin-top: 3px;">${data.invoice_number}</div>
      </div>
      
      <!-- Items -->
      <div class="items">
        ${data.items.map(item => `
          <div class="item">
            <span>${item.test_name}</span>
            <span>₹${item.price.toFixed(2)}</span>
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
      
      <!-- Footer -->
      <div class="footer">
        <div>Thank you for your visit!</div>
        <div>www.yourlab.com</div>
        ${config.auto_cut ? '<div class="cut-line"></div>' : ''}
      </div>
    </body>
    </html>
  `;
}

// Barcode generation using JsBarcode or similar
async function generateBarcode(
  text: string,
  format: string,
  height: string
): Promise<string> {
  // Option 1: Client-side with JsBarcode
  // Option 2: Server-side with bwip-js
  // Option 3: Use external API (e.g., barcodeapi.org)
  
  // Example using SVG barcode (CODE128)
  return `
    <svg id="barcode" class="barcode"></svg>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
    <script>
      JsBarcode("#barcode", "${text}", {
        format: "${format}",
        width: 2,
        height: ${parseInt(height)},
        displayValue: false
      });
    </script>
  `;
}
```

---

### Phase 3: Edge Function Updates

#### 3.1 Update `generate-invoice-pdf` Edge Function
```typescript
// supabase/functions/generate-invoice-pdf/index.ts

interface GenerateInvoiceRequest {
  invoiceId: string;
  labId: string;
  templateId?: string;
  format?: 'a4' | 'thermal_80mm' | 'thermal_58mm';  // NEW
  outputType?: 'pdf' | 'html' | 'both';              // NEW
}

Deno.serve(async (req: Request) => {
  const { invoiceId, labId, format, outputType } = await req.json();
  
  // Fetch invoice data
  const invoice = await fetchInvoiceData(invoiceId);
  
  // Fetch template
  const template = await fetchTemplate(labId, format);
  
  let pdfUrl: string | null = null;
  let thermalHtml: string | null = null;
  
  if (template.format_type.startsWith('thermal')) {
    // Generate thermal HTML
    thermalHtml = await generateThermalInvoiceHtml(invoice, template.thermal_settings);
    
    if (outputType === 'html') {
      // Return thermal HTML directly for printing
      return new Response(thermalHtml, {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    if (outputType === 'pdf' || outputType === 'both') {
      // Convert thermal HTML to PDF for archival
      pdfUrl = await convertToPdf(thermalHtml, `thermal_${invoiceId}.pdf`);
    }
  } else {
    // Standard A4 PDF generation (existing logic)
    pdfUrl = await generateStandardPdf(invoice, template);
  }
  
  return new Response(JSON.stringify({
    success: true,
    pdfUrl,
    thermalHtml,
    format: template.format_type
  }));
});
```

---

### Phase 4: Frontend Integration

#### 4.1 Add Print Mode Selector to Invoice UI
**File**: `src/pages/Billing.tsx` or `src/components/Invoices/InvoiceActions.tsx`

```typescript
const handlePrintInvoice = async (invoiceId: string) => {
  const labSettings = await fetchLabSettings();
  
  // Check lab's default print mode
  if (labSettings.default_print_mode === 'thermal') {
    await printThermalInvoice(invoiceId);
  } else {
    await downloadPdfInvoice(invoiceId);
  }
};

const printThermalInvoice = async (invoiceId: string) => {
  // Get thermal HTML from Edge Function
  const response = await supabase.functions.invoke('generate-invoice-pdf', {
    body: {
      invoiceId,
      labId: currentLabId,
      format: 'thermal_80mm',
      outputType: 'html'
    }
  });
  
  const thermalHtml = response.data;
  
  // Option 1: Direct browser print (works for USB/network thermal printers)
  const printWindow = window.open('', '_blank');
  printWindow.document.write(thermalHtml);
  printWindow.document.close();
  printWindow.print();
  
  // Option 2: Use Web Serial API for direct thermal printer control
  // await sendToThermalPrinter(thermalHtml);
  
  // Option 3: ESC/POS commands for low-level control
  // await sendEscPosCommands(invoiceId);
};
```

#### 4.2 Create Thermal Preview Component
**File**: `src/components/Invoices/ThermalInvoicePreview.tsx`

```typescript
export const ThermalInvoicePreview: React.FC<{
  invoiceId: string;
  paperWidth: 58 | 80;
}> = ({ invoiceId, paperWidth }) => {
  const [html, setHtml] = useState('');
  
  useEffect(() => {
    loadThermalPreview();
  }, [invoiceId]);
  
  const loadThermalPreview = async () => {
    const response = await supabase.functions.invoke('generate-invoice-pdf', {
      body: {
        invoiceId,
        format: `thermal_${paperWidth}mm`,
        outputType: 'html'
      }
    });
    setHtml(response.data);
  };
  
  return (
    <div className="thermal-preview" style={{ width: `${paperWidth}mm` }}>
      <iframe srcDoc={html} style={{ width: '100%', border: 'none' }} />
      <button onClick={() => window.print()}>Print</button>
    </div>
  );
};
```

---

### Phase 5: Barcode Implementation

#### 5.1 Install Barcode Library
```bash
npm install jsbarcode qrcode
npm install --save-dev @types/jsbarcode @types/qrcode
```

#### 5.2 Create Barcode Generator Utility
**File**: `src/utils/barcodeGenerator.ts`

```typescript
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

export async function generateInvoiceBarcode(
  invoiceNumber: string,
  format: 'CODE128' | 'QR' = 'CODE128'
): Promise<string> {
  if (format === 'QR') {
    return await QRCode.toDataURL(invoiceNumber, {
      width: 200,
      margin: 1
    });
  }
  
  // Generate CODE128 barcode as SVG
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, invoiceNumber, {
    format: 'CODE128',
    width: 2,
    height: 40,
    displayValue: false
  });
  
  return canvas.toDataURL('image/png');
}

// ESC/POS barcode commands for direct thermal printing
export function generateEscPosBarcode(data: string): Uint8Array {
  const encoder = new TextEncoder();
  
  // ESC/POS commands for CODE128 barcode
  const commands = [
    0x1D, 0x68, 0x50,        // Set barcode height to 80
    0x1D, 0x77, 0x02,        // Set barcode width to 2
    0x1D, 0x48, 0x02,        // Print HRI below barcode
    0x1D, 0x6B, 0x49,        // CODE128 barcode type
    data.length,             // Length of data
    ...encoder.encode(data), // Barcode data
  ];
  
  return new Uint8Array(commands);
}
```

---

### Phase 6: Settings UI for Thermal Printing

#### 6.1 Add Thermal Settings to Lab Settings
**File**: `src/pages/Settings.tsx`

```tsx
<div className="thermal-printer-settings">
  <h3>Thermal Printer Configuration</h3>
  
  <label>
    Default Print Mode:
    <select value={printMode} onChange={(e) => setPrintMode(e.target.value)}>
      <option value="pdf">PDF (A4) Only</option>
      <option value="thermal">Thermal Only</option>
      <option value="both">Both (PDF + Thermal)</option>
    </select>
  </label>
  
  <label>
    Thermal Paper Width:
    <select value={paperWidth} onChange={(e) => setPaperWidth(e.target.value)}>
      <option value="58">58mm</option>
      <option value="80">80mm</option>
    </select>
  </label>
  
  <label>
    Printer Model:
    <select value={printerModel}>
      <option value="epson_tm_t20">Epson TM-T20</option>
      <option value="star_tsp100">Star TSP100</option>
      <option value="custom_vkp80">Custom VKP80</option>
      <option value="xprinter_xp58">XPrinter XP-58</option>
    </select>
  </label>
  
  <label>
    Barcode Format:
    <select value={barcodeFormat}>
      <option value="CODE128">CODE128</option>
      <option value="QR">QR Code</option>
      <option value="CODE39">CODE39</option>
    </select>
  </label>
  
  <button onClick={testPrint}>Test Print</button>
</div>
```

---

### Phase 7: Printer Communication

#### 7.1 Web Serial API Integration (Modern Browsers)
**File**: `src/utils/thermalPrinterDriver.ts`

```typescript
export class ThermalPrinterDriver {
  private port: SerialPort | null = null;
  
  async connect() {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API not supported');
    }
    
    this.port = await (navigator as any).serial.requestPort();
    await this.port.open({ baudRate: 9600 });
  }
  
  async printInvoice(html: string) {
    if (!this.port) throw new Error('Printer not connected');
    
    // Convert HTML to ESC/POS commands
    const commands = this.htmlToEscPos(html);
    
    const writer = this.port.writable.getWriter();
    await writer.write(commands);
    writer.releaseLock();
  }
  
  private htmlToEscPos(html: string): Uint8Array {
    // Parse HTML and convert to ESC/POS commands
    // This is a simplified example
    const encoder = new TextEncoder();
    
    return new Uint8Array([
      0x1B, 0x40,              // Initialize printer
      ...encoder.encode(html),  // Text content (simplified)
      0x1B, 0x64, 0x02,        // Feed 2 lines
      0x1D, 0x56, 0x41, 0x00,  // Cut paper
    ]);
  }
}
```

---

## Implementation Phases Summary

### Phase 1 (Week 1): Database & Schema
- [ ] Add thermal columns to `invoice_templates`
- [ ] Add printer settings to `labs` table
- [ ] Create migration scripts
- [ ] Test schema changes

### Phase 2 (Week 2): Thermal Template Generator
- [ ] Build `thermalInvoiceGenerator.ts`
- [ ] Create default thermal templates (58mm, 80mm)
- [ ] Add barcode generation
- [ ] Test thermal HTML output

### Phase 3 (Week 3): Edge Function Updates
- [ ] Update `generate-invoice-pdf` for thermal support
- [ ] Add format detection logic
- [ ] Implement dual-mode generation (PDF + Thermal)
- [ ] Test all output modes

### Phase 4 (Week 4): Frontend Integration
- [ ] Add print mode selector
- [ ] Create thermal preview component
- [ ] Implement print handlers
- [ ] Add settings UI

### Phase 5 (Week 5): Barcode & Printer Drivers
- [ ] Integrate JsBarcode library
- [ ] Add QR code support
- [ ] Implement Web Serial API driver
- [ ] Test with actual thermal printers

### Phase 6 (Week 6): Testing & Refinement
- [ ] Test on multiple thermal printer models
- [ ] Optimize thermal layout
- [ ] Add error handling
- [ ] Create user documentation

---

## Technical Considerations

### Barcode Standards
- **CODE128**: Best for alphanumeric invoice numbers
- **QR Code**: Best for URL/payment links
- **CODE39**: Simpler, less data density

### Thermal Printer Compatibility
- **ESC/POS**: Industry standard (Epson, Star, Custom)
- **Web Serial API**: Chrome/Edge only
- **Network Printing**: Works with WiFi thermal printers
- **USB Printing**: Requires Web Serial API or desktop app

### Fallback Options
1. **Browser Print Dialog**: Works for any printer
2. **PDF Generation**: For archival/email
3. **Mobile Apps**: Capacitor plugins for direct printing

---

## Dependencies

### NPM Packages
```json
{
  "jsbarcode": "^3.11.5",
  "qrcode": "^1.5.3",
  "escpos": "^3.0.0",           // ESC/POS command builder
  "node-thermal-printer": "^4.4.5"  // For Node environment
}
```

### Browser APIs
- Web Serial API (Chrome 89+)
- Web Bluetooth API (for Bluetooth printers)
- Print API (window.print())

---

## Cost Estimation

### Development: ~6 weeks
- Backend: 2 weeks
- Frontend: 2 weeks
- Printer Integration: 1 week
- Testing: 1 week

### Hardware Testing
- Need 2-3 thermal printers for testing
- Recommended: Epson TM-T20 (USB), Star TSP100 (Network)

---

## Next Steps

1. **Approval**: Get stakeholder approval for thermal printing feature
2. **Hardware**: Procure thermal printers for testing
3. **Phase 1**: Start database schema updates
4. **Pilot**: Deploy to 1-2 labs for beta testing

Would you like me to start implementing any specific phase?
