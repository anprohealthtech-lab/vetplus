import { supabase } from './supabase';
import type { ReportData } from './pdfService';

export interface PreparedReportHtml {
  html: string;
  bundle: any;
  filenameBase: string;
  brandingDefaults: any;
}

interface PuppeteerPDFOptions {
  orderId: string;
  html: string;
  variant?: 'final' | 'draft' | 'print';
  cacheKey?: string;
  // Optional separate header/footer (like PDF.co)
  headerHtml?: string;
  footerHtml?: string;
  displayHeaderFooter?: boolean;
  // PDF layout settings (like PDF.co API parameters)
  scale?: number;
  margins?: string; // Format: "top right bottom left" in px, e.g., "120px 20px 80px 20px"
  headerHeight?: string; // e.g., "90px"
  footerHeight?: string; // e.g., "80px"
  paperSize?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  printBackground?: boolean;
}

// No longer used - keeping for backwards compatibility
// interface PDFGenerationResult {
//   url: string;
//   generationTime: number;
//   breakdown?: {
//     htmlLoad: number;
//     pdfGeneration: number;
//     storageUpload: number;
//     databaseUpdate: number;
//   };
// }

// In-memory cache for recently generated PDFs
const pdfCache = new Map<string, { url: string; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Generate PDF using Puppeteer Edge Function
 * Significantly faster than PDF.co for most reports
 */
export async function generatePDFWithPuppeteer(
  options: PuppeteerPDFOptions
): Promise<string> {
  const { 
    orderId, 
    html, 
    variant = 'final', 
    cacheKey, 
    headerHtml, 
    footerHtml, 
    displayHeaderFooter,
    scale,
    margins,
    headerHeight,
    footerHeight,
    paperSize,
    orientation,
    printBackground
  } = options;

  // Check cache first
  if (cacheKey) {
    const cached = pdfCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('📦 Returning cached PDF:', cached.url);
      return cached.url;
    }
  }

  const startTime = performance.now();

  try {
    console.log(`🚀 Generating ${variant} PDF with Puppeteer for order:`, orderId);

    // Get Puppeteer service URL from environment
    const puppeteerServiceUrl = import.meta.env.VITE_PUPPETEER_SERVICE_URL || 'https://plankton-app-oakzv.ondigitalocean.app';
    console.log('🎭 Using Puppeteer service:', puppeteerServiceUrl);

    // Build request body with optional header/footer support
    const requestBody: any = {
      html,
      orderId,
      variant,
      filename: `${orderId}_${Date.now()}_${variant}.pdf`,
    };

    // Add PDF layout settings if provided (like PDF.co API parameters)
    if (scale !== undefined) {
      requestBody.scale = scale;
      console.log('📐 Scale:', scale);
    }
    if (margins !== undefined) {
      requestBody.margins = margins;
      console.log('📏 Margins:', margins);
    }
    if (paperSize !== undefined) {
      requestBody.paperSize = paperSize;
      console.log('📄 Paper Size:', paperSize);
    }
    if (orientation !== undefined) {
      requestBody.orientation = orientation;
      console.log('🔄 Orientation:', orientation);
    }
    if (printBackground !== undefined) {
      requestBody.printBackground = printBackground;
      console.log('🖼️ Print Background:', printBackground);
    }

    // Add header/footer if provided (like PDF.co API)
    if (displayHeaderFooter !== undefined) {
      requestBody.displayHeaderFooter = displayHeaderFooter;
      console.log('📺 Display Header/Footer:', displayHeaderFooter);
    }
    if (headerHtml !== undefined) {
      requestBody.headerTemplate = headerHtml;
      console.log('📄 Including header template in Puppeteer request, length:', headerHtml.length);
    }
    if (footerHtml !== undefined) {
      requestBody.footerTemplate = footerHtml;
      console.log('📄 Including footer template in Puppeteer request, length:', footerHtml.length);
    }
    if (headerHeight !== undefined) {
      requestBody.headerHeight = headerHeight;
      console.log('⬆️ Header Height:', headerHeight);
    }
    if (footerHeight !== undefined) {
      requestBody.footerHeight = footerHeight;
      console.log('⬇️ Footer Height:', footerHeight);
    }

    // Call DigitalOcean Puppeteer Service (NOT Supabase Edge Function)
    const response = await fetch(`${puppeteerServiceUrl}/generate-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Puppeteer service error:', response.status, errorText);
      throw new Error(`Puppeteer service failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    if (!data || !data.success || !data.pdf) {
      throw new Error(data?.error || 'PDF generation failed - no PDF data returned');
    }

    const generationTime = performance.now() - startTime;
    console.log(`✅ PDF generated with Puppeteer in ${generationTime.toFixed(0)}ms`);
    console.log('📊 Timing:', data.timing);

    // Convert base64 to blob
    const base64Data = data.pdf;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const pdfBlob = new Blob([bytes], { type: 'application/pdf' });
    console.log('📄 PDF blob created:', pdfBlob.size, 'bytes');

    // Upload to Supabase storage
    const timestamp = Date.now();
    const filename = `${orderId}_${timestamp}_${variant}.pdf`;
    const filePath = `reports/${orderId}/${filename}`;

    console.log('📤 Uploading PDF to Supabase storage:', filePath);
    const { error: uploadError } = await supabase.storage
      .from('reports')
      .upload(filePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('❌ Failed to upload PDF to storage:', uploadError);
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('reports')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;
    console.log('✅ PDF uploaded successfully:', publicUrl);

    // Cache the result
    if (cacheKey) {
      pdfCache.set(cacheKey, { url: publicUrl, timestamp: Date.now() });
    }

    return publicUrl;
  } catch (error) {
    console.error('❌ Puppeteer PDF generation failed:', error);
    throw error;
  }
}

/**
 * Generate multiple PDFs in parallel
 * Useful for batch processing
 */
export async function generateMultiplePDFsWithPuppeteer(
  htmlDocuments: Array<{ orderId: string; html: string; variant?: string }>
): Promise<string[]> {
  const startTime = performance.now();

  console.log(`📚 Generating ${htmlDocuments.length} PDFs in parallel`);

  // Generate all PDFs in parallel
  const promises = htmlDocuments.map((doc) =>
    generatePDFWithPuppeteer({
      orderId: doc.orderId,
      html: doc.html,
      variant: (doc.variant as any) || 'final',
    })
  );

  const results = await Promise.allSettled(promises);

  const urls: string[] = [];
  const failed: number[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      urls.push(result.value);
    } else {
      console.error(`Failed to generate PDF ${index + 1}:`, result.reason);
      failed.push(index);
    }
  });

  const totalTime = performance.now() - startTime;
  console.log(
    `✅ Generated ${urls.length}/${htmlDocuments.length} PDFs in ${totalTime.toFixed(0)}ms (${(totalTime / urls.length).toFixed(0)}ms avg)`
  );

  if (failed.length > 0) {
    console.warn(`⚠️  ${failed.length} PDF(s) failed to generate`);
  }

  return urls;
}

/**
 * Progressive PDF generation with real-time updates
 * Yields progress updates as the PDF is generated
 */
export async function* generatePDFStream(
  reportData: ReportData,
  preparedHtml: PreparedReportHtml
): AsyncGenerator<{
  stage: string;
  progress: number;
  url?: string;
  breakdown?: any;
}> {
  yield { stage: 'Optimizing HTML for rendering', progress: 10 };

  // Optimize HTML for Puppeteer
  const optimizedHtml = await optimizeHtmlForPuppeteer(preparedHtml.html);
  yield { stage: 'HTML optimized', progress: 20 };

  // Generate main PDF
  yield { stage: 'Generating PDF with Puppeteer', progress: 30 };

  try {
    const pdfUrl = await generatePDFWithPuppeteer({
      orderId: reportData.report.reportId,
      html: optimizedHtml,
      variant: 'final',
      cacheKey: `${reportData.report.reportId}_final`,
    });

    yield { stage: 'PDF ready', progress: 90, url: pdfUrl };

    // Generate print version asynchronously (fire and forget)
    if (reportData.labTemplateRecord) {
      generatePDFWithPuppeteer({
        orderId: reportData.report.reportId,
        html: optimizedHtml,
        variant: 'print',
      }).catch((err) => console.warn('Print PDF generation failed:', err));
    }

    yield { stage: 'Complete', progress: 100, url: pdfUrl };
  } catch (error) {
    yield {
      stage: 'Error',
      progress: 0,
      url: undefined,
    };
    throw error;
  }
}

/**
 * Optimize HTML for faster Puppeteer rendering
 */
async function optimizeHtmlForPuppeteer(html: string): Promise<string> {
  let optimized = html;

  // 1. Remove unnecessary external scripts
  optimized = optimized.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ''
  );

  // 2. Inline small images as base64 (if not already done)
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
  const matches = [...optimized.matchAll(imgRegex)];

  for (const match of matches) {
    const imgUrl = match[1];
    // Skip if already base64 or very large
    if (!imgUrl.startsWith('data:') && imgUrl.startsWith('http')) {
      try {
        const response = await fetch(imgUrl);
        const blob = await response.blob();

        // Only inline images smaller than 100KB
        if (blob.size < 100000) {
          const base64 = await blobToBase64(blob);
          optimized = optimized.replace(imgUrl, base64);
        }
      } catch (err) {
        console.warn('Failed to optimize image:', imgUrl, err);
      }
    }
  }

  // 3. Add print-specific optimizations if not present
  // NOTE: Do NOT inject @page rules with hardcoded margins here!
  // All page layout (margins, scale, header/footer heights) must be controlled
  // by the Puppeteer API parameters or PDF.co API parameters.
  // Injecting @page CSS rules would override the API parameters.
  if (!optimized.includes('-webkit-print-color-adjust')) {
    const pageStyle = `
      <style>
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color-adjust: exact;
          }
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    `;
    optimized = optimized.replace('</head>', `${pageStyle}</head>`);
  }

  // 4. Remove comments
  optimized = optimized.replace(/<!--[\s\S]*?-->/g, '');

  // 5. Minify whitespace (but preserve pre/code blocks)
  const preBlocks: string[] = [];
  optimized = optimized.replace(/<(pre|code)[^>]*>[\s\S]*?<\/\1>/gi, (match) => {
    preBlocks.push(match);
    return `__PRE_BLOCK_${preBlocks.length - 1}__`;
  });

  optimized = optimized.replace(/\s+/g, ' ').trim();

  // Restore pre blocks
  preBlocks.forEach((block, index) => {
    optimized = optimized.replace(`__PRE_BLOCK_${index}__`, block);
  });

  return optimized;
}

/**
 * Convert Blob to base64 data URL
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Warm up Puppeteer instance
 * Call this on app startup or periodically to keep browser ready
 */
export async function warmupPuppeteer(): Promise<void> {
  try {
    console.log('🔥 Warming up Puppeteer instance...');
    const { error } = await supabase.functions.invoke('generate-pdf-puppeteer', {
      body: { warmup: true },
    });

    if (error) {
      console.warn('Warmup warning:', error);
    } else {
      console.log('✅ Puppeteer warmed up and ready');
    }
  } catch (error) {
    console.warn('Failed to warmup Puppeteer:', error);
  }
}

/**
 * Analyze PDF complexity to decide which generation method to use
 */
export interface PDFComplexityAnalysis {
  complexity: 'simple' | 'medium' | 'complex';
  pageCount: number;
  hasImages: boolean;
  hasCharts: boolean;
  htmlSize: number;
  recommendation: 'puppeteer' | 'pdfco';
}

export function analyzePDFComplexity(html: string): PDFComplexityAnalysis {
  const htmlSize = new Blob([html]).size;
  const hasImages = /<img[^>]*>/i.test(html);
  const hasCharts = /<canvas|<svg/i.test(html);
  const tableCount = (html.match(/<table/gi) || []).length;
  const pageBreaks = (html.match(/page-break|break-after|break-before/gi) || []).length;

  const estimatedPages = Math.max(1, pageBreaks + 1, Math.ceil(htmlSize / 50000));

  let complexity: 'simple' | 'medium' | 'complex' = 'simple';
  let recommendation: 'puppeteer' | 'pdfco' = 'puppeteer';

  if (estimatedPages > 10 || tableCount > 20) {
    complexity = 'complex';
    // Very complex PDFs might be better with PDF.co
    if (estimatedPages > 20) {
      recommendation = 'pdfco';
    }
  } else if (estimatedPages > 3 || hasImages || tableCount > 5) {
    complexity = 'medium';
  }

  // Puppeteer is generally better for most cases
  // Only use PDF.co for extremely complex documents
  if (hasCharts && estimatedPages > 15) {
    recommendation = 'pdfco';
  }

  return {
    complexity,
    pageCount: estimatedPages,
    hasImages,
    hasCharts,
    htmlSize,
    recommendation,
  };
}
