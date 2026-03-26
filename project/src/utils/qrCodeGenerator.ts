// utils/qrCodeGenerator.ts
// QR code generation for sample tubes with comprehensive metadata

import QRCode from 'qrcode';

/**
 * Sample QR code data structure
 */
export interface SampleQRData {
  sampleId: string;
  sampleType: string;
  patientId: string;
  orderId: string;
  labCode: string;
  collectionDate: string;
  barcode?: string;
}

/**
 * Generate QR code as data URL
 * 
 * @param data - Sample data to encode
 * @param options - QR code rendering options
 * @returns Promise<string> - Data URL of the QR code image
 */
export async function generateSampleQRCode(
  data: SampleQRData,
  options?: {
    width?: number;
    margin?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  }
): Promise<string> {
  const {
    width = 200,
    margin = 1,
    errorCorrectionLevel = 'M'
  } = options || {};

  try {
    // Encode data as JSON string
    const jsonData = JSON.stringify(data);
    
    const qrCodeDataUrl = await QRCode.toDataURL(jsonData, {
      width,
      margin,
      errorCorrectionLevel,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate compact QR code (smaller size for labels)
 */
export async function generateCompactQRCode(
  data: SampleQRData
): Promise<string> {
  return generateSampleQRCode(data, {
    width: 100,
    margin: 1,
    errorCorrectionLevel: 'L' // Lower error correction for smaller size
  });
}

/**
 * Generate high-quality QR code (for printing)
 */
export async function generatePrintableQRCode(
  data: SampleQRData
): Promise<string> {
  return generateSampleQRCode(data, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: 'H' // High error correction for print
  });
}

/**
 * Parse QR code data back to object
 */
export function parseSampleQRData(qrDataString: string): SampleQRData | null {
  try {
    const data = JSON.parse(qrDataString);
    
    // Validate required fields
    if (!data.sampleId || !data.sampleType || !data.patientId || !data.orderId) {
      console.error('Invalid QR data: missing required fields');
      return null;
    }
    
    return data as SampleQRData;
  } catch (error) {
    console.error('Error parsing QR data:', error);
    return null;
  }
}

/**
 * Validate QR code data structure
 */
export function isValidQRData(data: any): data is SampleQRData {
  return (
    typeof data === 'object' &&
    typeof data.sampleId === 'string' &&
    typeof data.sampleType === 'string' &&
    typeof data.patientId === 'string' &&
    typeof data.orderId === 'string' &&
    typeof data.labCode === 'string' &&
    typeof data.collectionDate === 'string'
  );
}
