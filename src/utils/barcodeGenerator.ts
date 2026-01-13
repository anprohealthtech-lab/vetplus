// utils/barcodeGenerator.ts
// Barcode generation for sample tubes using Code 128 format

/**
 * Generate Code 128 barcode as data URL
 * Uses canvas-based rendering for maximum compatibility
 * 
 * @param data - Data to encode (typically sample ID)
 * @param options - Barcode rendering options
 * @returns Data URL of the barcode image
 */
export function generateBarcode(
  data: string,
  options?: {
    width?: number;
    height?: number;
    displayValue?: boolean;
    fontSize?: number;
    margin?: number;
  }
): string {
  const {
    width = 2,
    height = 50,
    displayValue = true,
    fontSize = 12,
    margin = 10
  } = options || {};

  try {
    // Dynamic import of JsBarcode to avoid SSR issues
    if (typeof window === 'undefined') {
      console.warn('Barcode generation is only available in browser');
      return '';
    }

    const canvas = document.createElement('canvas');
    
    // Dynamically import JsBarcode
    import('jsbarcode').then(({ default: JsBarcode }) => {
      JsBarcode(canvas, data, {
        format: 'CODE128',
        width,
        height,
        displayValue,
        fontSize,
        margin,
        background: '#ffffff',
        lineColor: '#000000'
      });
    });

    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error generating barcode:', error);
    return '';
  }
}

/**
 * Generate barcode synchronously (requires JsBarcode to be pre-loaded)
 * Use this when JsBarcode is already imported in your component
 */
export function generateBarcodeSync(
  JsBarcode: any,
  data: string,
  options?: {
    width?: number;
    height?: number;
    displayValue?: boolean;
    fontSize?: number;
    margin?: number;
  }
): string {
  const {
    width = 2,
    height = 50,
    displayValue = true,
    fontSize = 12,
    margin = 10
  } = options || {};

  const canvas = document.createElement('canvas');
  
  JsBarcode(canvas, data, {
    format: 'CODE128',
    width,
    height,
    displayValue,
    fontSize,
    margin,
    background: '#ffffff',
    lineColor: '#000000'
  });

  return canvas.toDataURL('image/png');
}

/**
 * Validate if a string can be encoded as Code 128
 */
export function isValidBarcodeData(data: string): boolean {
  // Code 128 can encode all ASCII characters (0-127)
  if (!data || data.length === 0) return false;
  
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i);
    if (charCode > 127) {
      return false;
    }
  }
  
  return true;
}

/**
 * Generate printable barcode label HTML
 * Can be used with window.print() or react-to-print
 */
export function generateBarcodeLabelHTML(
  sampleId: string,
  barcodeDataUrl: string,
  metadata?: {
    sampleType?: string;
    patientName?: string;
    collectionDate?: string;
  }
): string {
  return `
    <html>
      <head>
        <title>Sample Label - ${sampleId}</title>
        <style>
          @page { 
            size: 3in 2in; 
            margin: 0; 
          }
          body { 
            font-family: 'Courier New', monospace; 
            text-align: center; 
            padding: 8px;
            margin: 0;
          }
          .sample-id { 
            font-size: 14px; 
            font-weight: bold; 
            margin-bottom: 4px;
            letter-spacing: 1px;
          }
          .barcode { 
            margin: 6px 0; 
          }
          .barcode img {
            max-width: 100%;
            height: auto;
          }
          .metadata { 
            font-size: 9px; 
            color: #333; 
            margin-top: 4px;
            line-height: 1.3;
          }
          .timestamp {
            font-size: 7px;
            color: #666;
            margin-top: 2px;
          }
        </style>
      </head>
      <body>
        <div class="sample-id">${sampleId}</div>
        <div class="barcode">
          <img src="${barcodeDataUrl}" alt="Barcode" />
        </div>
        ${metadata?.sampleType ? `<div class="metadata">Type: ${metadata.sampleType}</div>` : ''}
        ${metadata?.patientName ? `<div class="metadata">Patient: ${metadata.patientName}</div>` : ''}
        ${metadata?.collectionDate ? `<div class="timestamp">Collected: ${metadata.collectionDate}</div>` : ''}
      </body>
    </html>
  `;
}
