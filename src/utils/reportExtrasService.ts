/**
 * reportExtrasService.ts
 * 
 * Manages report extras (trend charts, clinical summaries) for inclusion in final PDF reports.
 * Stores data in the `results` table's `report_extras` JSONB column.
 */

import { supabase } from './supabase';
import { 
  TrendChartResult, 
  generateTrendChart, 
  generateTrendSectionHtml 
} from './trendChartGenerator';

// ============ Types ============

export interface ClinicalSummaryData {
  text: string;
  recommendation?: string;
  generated_at: string;
  generated_by?: 'ai' | 'manual';
}

export interface ReportExtras {
  // Trend charts
  trend_charts?: TrendChartResult[];
  include_trends_in_report?: boolean;
  
  // Clinical summary for doctor
  clinical_summary?: ClinicalSummaryData;
  include_summary_in_report?: boolean;
  
  // Metadata
  generated_at?: string;
  last_updated?: string;
}

export interface SaveReportExtrasOptions {
  resultId: string;
  orderId: string;
  patientId: string;
  
  // Analytes with flags for trend generation
  analytesToIncludeTrends?: { name: string; flag?: string | null }[];
  includeTrendsInReport?: boolean;
  
  // Clinical summary
  clinicalSummary?: ClinicalSummaryData;
  includeSummaryInReport?: boolean;
}

// ============ Database Operations ============

/**
 * Get report extras for a result
 */
export const getReportExtras = async (resultId: string): Promise<ReportExtras | null> => {
  try {
    const { data, error } = await supabase
      .from('results')
      .select('report_extras')
      .eq('id', resultId)
      .single();

    if (error) {
      console.error('Error fetching report extras:', error);
      return null;
    }

    return data?.report_extras as ReportExtras || null;
  } catch (error) {
    console.error('Error in getReportExtras:', error);
    return null;
  }
};

/**
 * Update report extras for a result (merge with existing)
 */
export const updateReportExtras = async (
  resultId: string, 
  extras: Partial<ReportExtras>
): Promise<boolean> => {
  try {
    // Get existing extras to merge
    const existing = await getReportExtras(resultId);
    
    const merged: ReportExtras = {
      ...existing,
      ...extras,
      last_updated: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('results')
      .update({ report_extras: merged })
      .eq('id', resultId);

    if (error) {
      console.error('Error updating report extras:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateReportExtras:', error);
    return false;
  }
};

/**
 * Generate and save trend charts for specified analytes
 */
export const generateAndSaveTrendCharts = async (
  resultId: string,
  orderId: string,
  patientId: string,
  analytes: { name: string; flag?: string | null }[],
  includeInReport: boolean = true
): Promise<TrendChartResult[]> => {
  const trendCharts: TrendChartResult[] = [];

  // Filter to flagged analytes that would benefit from trend analysis
  const flaggedAnalytes = analytes.filter(a => a.flag && ['H', 'L', 'C'].includes(a.flag));
  
  if (flaggedAnalytes.length === 0) {
    console.log('No flagged analytes to generate trends for');
    return [];
  }

  console.log(`Generating trend charts for ${flaggedAnalytes.length} flagged analyte(s)...`);

  for (const analyte of flaggedAnalytes) {
    try {
      const result = await generateTrendChart(patientId, analyte.name, orderId);
      if (result.data.length >= 2) {
        trendCharts.push(result);
      }
    } catch (error) {
      console.error(`Error generating trend for ${analyte.name}:`, error);
    }
  }

  if (trendCharts.length > 0) {
    await updateReportExtras(resultId, {
      trend_charts: trendCharts,
      include_trends_in_report: includeInReport,
      generated_at: new Date().toISOString(),
    });
  }

  return trendCharts;
};

/**
 * Save clinical summary for a result
 */
export const saveClinicalSummary = async (
  resultId: string,
  summary: ClinicalSummaryData,
  includeInReport: boolean = true
): Promise<boolean> => {
  return updateReportExtras(resultId, {
    clinical_summary: summary,
    include_summary_in_report: includeInReport,
  });
};

/**
 * Toggle inclusion of trends in report
 */
export const toggleTrendsInReport = async (
  resultId: string,
  include: boolean
): Promise<boolean> => {
  return updateReportExtras(resultId, {
    include_trends_in_report: include,
  });
};

/**
 * Toggle inclusion of clinical summary in report
 */
export const toggleSummaryInReport = async (
  resultId: string,
  include: boolean
): Promise<boolean> => {
  return updateReportExtras(resultId, {
    include_summary_in_report: include,
  });
};

// ============ HTML Generation for PDF ============

/**
 * Generate clinical summary HTML section
 */
export const generateClinicalSummaryHtml = (summary: ClinicalSummaryData): string => {
  if (!summary?.text) {
    return '';
  }

  const recommendationHtml = summary.recommendation ? `
    <div style="margin-top: 12px; padding: 10px; background: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 4px;">
      <strong style="color: #92400e;">Recommendation:</strong>
      <p style="margin: 5px 0 0 0; color: #78350f;">${summary.recommendation}</p>
    </div>
  ` : '';

  return `
    <div style="margin-top: 20px; page-break-inside: avoid;">
      <h3 style="font-size: 16px; color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin-bottom: 15px;">
        🩺 Clinical Summary for Referring Physician
      </h3>
      <div style="padding: 15px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px;">
        <p style="margin: 0; line-height: 1.6; color: #0c4a6e; white-space: pre-line;">${summary.text}</p>
        ${recommendationHtml}
      </div>
      <p style="margin-top: 8px; font-size: 10px; color: #6b7280; font-style: italic;">
        Generated: ${new Date(summary.generated_at).toLocaleString('en-IN')}
        ${summary.generated_by === 'ai' ? ' (AI-Assisted)' : ''}
      </p>
    </div>
  `;
};

/**
 * Generate print-friendly clinical summary (no background colors)
 */
export const generateClinicalSummaryHtmlPrint = (summary: ClinicalSummaryData): string => {
  if (!summary?.text) {
    return '';
  }

  const recommendationHtml = summary.recommendation ? `
    <div style="margin-top: 12px; padding: 10px; border-left: 3px solid #333;">
      <strong>Recommendation:</strong>
      <p style="margin: 5px 0 0 0;">${summary.recommendation}</p>
    </div>
  ` : '';

  return `
    <div style="margin-top: 20px; page-break-inside: avoid;">
      <h3 style="font-size: 14px; color: #000; border-bottom: 1px solid #333; padding-bottom: 6px; margin-bottom: 12px;">
        Clinical Summary for Referring Physician
      </h3>
      <div style="padding: 12px; border: 1px solid #ccc;">
        <p style="margin: 0; line-height: 1.6; white-space: pre-line;">${summary.text}</p>
        ${recommendationHtml}
      </div>
    </div>
  `;
};

/**
 * Generate complete report extras section HTML
 * Combines trends and clinical summary based on inclusion flags
 */
export const generateReportExtrasHtml = (
  extras: ReportExtras,
  forPrint: boolean = false
): string => {
  if (!extras) {
    return '';
  }

  const parts: string[] = [];

  // Add clinical summary if included
  if (extras.include_summary_in_report && extras.clinical_summary?.text) {
    parts.push(
      forPrint 
        ? generateClinicalSummaryHtmlPrint(extras.clinical_summary)
        : generateClinicalSummaryHtml(extras.clinical_summary)
    );
  }

  // Add trend charts if included
  if (extras.include_trends_in_report && extras.trend_charts && extras.trend_charts.length > 0) {
    parts.push(generateTrendSectionHtml(extras.trend_charts, forPrint));
  }

  if (parts.length === 0) {
    return '';
  }

  // Wrap in page break section for appendix placement
  return `
    <div class="report-extras-section" style="page-break-before: always; padding: 20px;">
      <h2 style="text-align: center; margin-bottom: 25px; color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
        Additional Analysis & Summary
      </h2>
      ${parts.join('\n')}
    </div>
  `;
};

/**
 * Fetch report extras for an order (across all results)
 * Used during PDF generation
 */
export const getReportExtrasForOrder = async (orderId: string): Promise<ReportExtras | null> => {
  try {
    const { data, error } = await supabase
      .from('results')
      .select('id, report_extras')
      .eq('order_id', orderId)
      .not('report_extras', 'is', null);

    if (error) {
      console.error('Error fetching report extras for order:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    // Merge all report extras from different results
    const merged: ReportExtras = {
      trend_charts: [],
      include_trends_in_report: false,
      include_summary_in_report: false,
    };

    for (const result of data) {
      const extras = result.report_extras as ReportExtras;
      if (!extras) continue;

      // Merge trend charts
      if (extras.trend_charts && extras.trend_charts.length > 0) {
        merged.trend_charts = [...(merged.trend_charts || []), ...extras.trend_charts];
        if (extras.include_trends_in_report) {
          merged.include_trends_in_report = true;
        }
      }

      // Use the first clinical summary found (typically order-level)
      if (extras.clinical_summary && !merged.clinical_summary) {
        merged.clinical_summary = extras.clinical_summary;
        merged.include_summary_in_report = extras.include_summary_in_report;
      }
    }

    return merged.trend_charts?.length || merged.clinical_summary ? merged : null;
  } catch (error) {
    console.error('Error in getReportExtrasForOrder:', error);
    return null;
  }
};

export default {
  getReportExtras,
  updateReportExtras,
  generateAndSaveTrendCharts,
  saveClinicalSummary,
  toggleTrendsInReport,
  toggleSummaryInReport,
  generateClinicalSummaryHtml,
  generateClinicalSummaryHtmlPrint,
  generateReportExtrasHtml,
  getReportExtrasForOrder,
};
