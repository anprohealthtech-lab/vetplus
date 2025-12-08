import { useState, useCallback, useRef } from 'react';
import type { LabTemplateRecord, PreparedPDFBundle, PdfCoRequestOptions } from '../utils/pdfService';
import {
  generateAndSavePDFReportWithProgress,
  ReportData,
  selectTemplateForContext,
  createReportDataFromContext,
  preparePDFBundle,
  regeneratePDFWithSettings,
} from '../utils/pdfService';
import { supabase, database } from '../utils/supabase';

export async function isOrderReportReady(orderId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("v_result_panel_status")
    .select("panel_ready")
    .eq("order_id", orderId);

  if (error) return false;
  if (!data?.length) return false;
  return data.every(r => r.panel_ready);
}

interface PDFGenerationState {
  isGenerating: boolean;
  stage: string;
  progress: number;
  error?: string;
}

export const usePDFGeneration = () => {
  const [state, setState] = useState<PDFGenerationState>({
    isGenerating: false,
    stage: '',
    progress: 0
  });

  // Cache the last prepared bundle for regeneration with different settings
  const lastBundleRef = useRef<PreparedPDFBundle | null>(null);
  const lastReportDataRef = useRef<ReportData | null>(null);

  const generatePDF = useCallback(async (orderId: string, forceDraft = false) => {
    setState({
      isGenerating: true,
      stage: 'Initializing...',
      progress: 0,
      error: undefined
    });

    try {
      setState(prev => ({ ...prev, stage: 'Loading report context...', progress: 10 }));

      const { data: context, error: contextError } = await database.reports.getTemplateContext(orderId);
      if (contextError || !context) {
        const message = contextError?.message || 'Failed to load report context';
        throw new Error(message);
      }

      if (!Array.isArray(context.analytes) || context.analytes.length === 0) {
        throw new Error('No test results found for this order');
      }

      const isDraft = forceDraft || context.meta?.allAnalytesApproved !== true;

      setState(prev => ({
        ...prev,
        stage: isDraft ? 'Draft report – pending approvals...' : 'All panels approved.',
        progress: 30,
      }));

      let selectedTemplate: LabTemplateRecord | null = null;
      let allTemplates: LabTemplateRecord[] = [];
      try {
        const { data: templates, error: templateError } = await database.labTemplates.list();
        if (templateError) {
          console.warn('Unable to load lab templates for PDF generation:', templateError);
        } else if (Array.isArray(templates) && templates.length > 0) {
          allTemplates = templates as LabTemplateRecord[];
          selectedTemplate = selectTemplateForContext(allTemplates, context);
        }
      } catch (templateFetchError) {
        console.warn('Unexpected template fetch failure:', templateFetchError);
      }

      setState(prev => ({ ...prev, stage: 'Preparing report data...', progress: 55 }));

      const reportData: ReportData = createReportDataFromContext(context, {
        template: selectedTemplate,
        isDraft,
      });

      setState(prev => ({ ...prev, stage: 'Generating PDF...', progress: 75 }));

      // Use old service with direct PDF.co API for all reports (includes attachment support)
      const pdfUrl = await generateAndSavePDFReportWithProgress(
        orderId,
        reportData,
        (stage: string, progress?: number) => {
          setState(prev => ({
            ...prev,
            stage,
            progress: progress ?? prev.progress,
          }));
        },
        isDraft,
        allTemplates
      );

      if (pdfUrl) {
        setState(prev => ({ ...prev, stage: 'Starting download...', progress: 95 }));
        
        // Download the PDF
        const safePatientName = reportData.patient.name || 'Patient';
        const filename = `${safePatientName.replace(/\s+/g, '_')}_${orderId}${isDraft ? '_DRAFT' : ''}.pdf`;
        const response = await fetch(pdfUrl);
        if (response.ok) {
          const blob = await response.blob();
          const downloadUrl = window.URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(downloadUrl);
          
          setState(prev => ({
            ...prev,
            stage: 'PDF downloaded successfully!',
            progress: 100
          }));
          
          // Auto-hide after 2 seconds on success
          setTimeout(() => {
            setState(prev => ({ ...prev, isGenerating: false }));
          }, 2000);
        } else {
          throw new Error('Failed to download PDF');
        }
      } else {
        setState(prev => ({
          ...prev,
          stage: 'PDF generation failed',
          progress: 0,
          error: 'Failed to generate PDF'
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        stage: 'PDF generation failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, []);

  const resetState = useCallback(() => {
    setState({
      isGenerating: false,
      stage: '',
      progress: 0,
      error: undefined
    });
  }, []);

  /**
   * Regenerate PDF with custom settings using cached HTML bundle
   */
  const regenerateWithSettings = useCallback(async (
    orderId: string,
    options: PdfCoRequestOptions
  ): Promise<string | null> => {
    setState({
      isGenerating: true,
      stage: 'Preparing for regeneration...',
      progress: 0,
      error: undefined
    });

    try {
      let bundle = lastBundleRef.current;
      
      // If no cached bundle or different order, prepare fresh
      if (!bundle || bundle.orderId !== orderId) {
        setState(prev => ({ ...prev, stage: 'Loading report context...', progress: 10 }));
        
        const { data: context, error: contextError } = await database.reports.getTemplateContext(orderId);
        if (contextError || !context) {
          throw new Error(contextError?.message || 'Failed to load report context');
        }

        const isDraft = context.meta?.allAnalytesApproved !== true;
        
        let selectedTemplate: LabTemplateRecord | null = null;
        let allTemplates: LabTemplateRecord[] = [];
        try {
          const { data: templates } = await database.labTemplates.list();
          if (Array.isArray(templates) && templates.length > 0) {
            allTemplates = templates as LabTemplateRecord[];
            selectedTemplate = selectTemplateForContext(allTemplates, context);
          }
        } catch (e) {
          console.warn('Template fetch failed:', e);
        }

        setState(prev => ({ ...prev, stage: 'Preparing report data...', progress: 30 }));

        const reportData = createReportDataFromContext(context, {
          template: selectedTemplate,
          isDraft,
        });
        
        lastReportDataRef.current = reportData;
        
        setState(prev => ({ ...prev, stage: 'Building HTML bundle...', progress: 50 }));
        
        bundle = await preparePDFBundle(orderId, reportData, isDraft, allTemplates);
        lastBundleRef.current = bundle;
      }

      setState(prev => ({ ...prev, stage: 'Regenerating PDF with custom settings...', progress: 70 }));

      const pdfUrl = await regeneratePDFWithSettings(bundle, options);

      if (pdfUrl) {
        setState(prev => ({ ...prev, stage: 'Waiting for PDF to be ready...', progress: 85 }));
        
        // Retry downloading the PDF with exponential backoff
        // PDF.co S3 URLs sometimes need time to propagate
        const maxDownloadRetries = 5;
        const baseDelay = 1500;
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxDownloadRetries; attempt++) {
          try {
            setState(prev => ({ 
              ...prev, 
              stage: attempt > 1 ? `Retrying download (attempt ${attempt})...` : 'Downloading PDF...', 
              progress: 85 + (attempt * 2) 
            }));
            
            const response = await fetch(pdfUrl);
            if (response.ok) {
              const blob = await response.blob();
              const downloadUrl = window.URL.createObjectURL(blob);
              
              const link = document.createElement('a');
              link.href = downloadUrl;
              link.download = bundle.filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(downloadUrl);
              
              setState(prev => ({
                ...prev,
                stage: 'PDF downloaded successfully!',
                progress: 100
              }));
              
              setTimeout(() => {
                setState(prev => ({ ...prev, isGenerating: false }));
              }, 2000);
              
              return pdfUrl;
            } else {
              lastError = new Error(`Download failed with status ${response.status}`);
              console.warn(`PDF download attempt ${attempt} failed:`, response.status);
            }
          } catch (fetchError) {
            lastError = fetchError instanceof Error ? fetchError : new Error('Download failed');
            console.warn(`PDF download attempt ${attempt} error:`, fetchError);
          }
          
          // Wait before retry (exponential backoff)
          if (attempt < maxDownloadRetries) {
            await new Promise(resolve => setTimeout(resolve, baseDelay * attempt));
          }
        }
        
        throw lastError || new Error('Failed to download PDF after multiple attempts');
      }
      
      return null;
    } catch (error) {
      setState(prev => ({
        ...prev,
        stage: 'PDF regeneration failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
      return null;
    }
  }, []);

  /**
   * Get the last cached bundle (for passing to settings modal)
   */
  const getCachedBundle = useCallback(() => lastBundleRef.current, []);

  return {
    ...state,
    generatePDF,
    regenerateWithSettings,
    getCachedBundle,
    resetState
  };
};

export default usePDFGeneration;