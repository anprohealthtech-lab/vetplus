/**
 * Direct PDF Generation Utility
 * Sends HTML directly to PDF.co via Edge Function
 * No queue, no template processing - just HTML → PDF
 */

import { supabase } from './supabase';

export interface DirectPDFOptions {
  html: string;
  orderId?: string;
  fileName?: string;
}

export interface DirectPDFResult {
  success: boolean;
  pdfUrl?: string;
  storagePath?: string;
  error?: string;
}

/**
 * Generate PDF directly from HTML
 * Perfect for design studio where HTML is already ready
 */
export async function generatePDFDirect(options: DirectPDFOptions): Promise<DirectPDFResult> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-pdf-direct', {
      body: {
        html: options.html,
        orderId: options.orderId,
        fileName: options.fileName,
      },
    });

    if (error) {
      console.error('Edge Function error:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate PDF',
      };
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'PDF generation failed',
      };
    }

    return {
      success: true,
      pdfUrl: data.pdfUrl,
      storagePath: data.storagePath,
    };
  } catch (err) {
    console.error('Error generating PDF:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Example usage in Report Design Studio:
 * 
 * const result = await generatePDFDirect({
 *   html: finalHtmlContent,
 *   orderId: order.id,
 *   fileName: `report_${order.id}.pdf`
 * });
 * 
 * if (result.success) {
 *   console.log('PDF ready:', result.pdfUrl);
 * }
 */
