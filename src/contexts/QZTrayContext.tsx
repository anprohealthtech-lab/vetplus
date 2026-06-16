/**
 * Print bridge context.
 *
 * The export names stay as QZTrayContext/useQZTray during Phase 1 so the
 * existing app can move from QZ Tray direct printing to queue-backed LIMS
 * Utility printing without broad import churn.
 *
 * Settings resolution (location overrides lab):
 *   barcodePrinterName      = non-empty location.barcode_printer_name || non-empty lab.barcode_printer_name
 *   reportPrinterName       = non-empty location.report_printer_name || non-empty lab.report_printer_name
 *   autoPrintBarcodeOnOrder = location.auto_print_barcode_on_order ?? lab.auto_print_barcode_on_order
 *   autoPrintReportOnApproval = location.auto_print_report_on_approval ?? lab.auto_print_report_on_approval
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { database, supabase } from '../utils/supabase';
import * as printService from '../utils/qzTrayService';
import type { BarcodeLabelData, QZConnectionStatus } from '../utils/qzTrayService';

interface QZPrintSettings {
  barcodePrinterName: string | null;
  reportPrinterName: string | null;
  autoPrintBarcodeOnOrder: boolean;
  autoPrintReportOnApproval: boolean;
}

interface QZTrayContextValue {
  status: QZConnectionStatus;
  settings: QZPrintSettings;
  refreshSettings: () => Promise<QZPrintSettings>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  autoPrintBarcode: (data: BarcodeLabelData) => Promise<void>;
  autoPrintReport: (pdfUrl: string) => Promise<void>;
}

const defaultSettings: QZPrintSettings = {
  barcodePrinterName: null,
  reportPrinterName: null,
  autoPrintBarcodeOnOrder: false,
  autoPrintReportOnApproval: false,
};

export const QZTrayContext = createContext<QZTrayContextValue>({
  status: 'connected',
  settings: defaultSettings,
  refreshSettings: async () => defaultSettings,
  connect: async () => {},
  disconnect: async () => {},
  autoPrintBarcode: async () => {},
  autoPrintReport: async () => {},
});

export const useQZTray = () => useContext(QZTrayContext);

const cleanPrinterName = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed || null;
};

export const QZTrayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<QZConnectionStatus>('connected');
  const [settings, setSettings] = useState<QZPrintSettings>(defaultSettings);
  const settingsLoadedRef = useRef(false);

  useEffect(() => {
    return printService.onConnectionStatusChange(setStatus);
  }, []);

  const refreshSettings = useCallback(async (): Promise<QZPrintSettings> => {
    try {
      const [labId, locationId] = await Promise.all([
        database.getCurrentUserLabId(),
        database.getCurrentUserPrimaryLocation(),
      ]);

      if (!labId) {
        setSettings(defaultSettings);
        return defaultSettings;
      }

      const [labResult, locationResult] = await Promise.all([
        supabase
          .from('labs')
          .select('barcode_printer_name, report_printer_name, auto_print_barcode_on_order, auto_print_report_on_approval')
          .eq('id', labId)
          .single(),
        locationId
          ? supabase
              .from('locations')
              .select('barcode_printer_name, report_printer_name, auto_print_barcode_on_order, auto_print_report_on_approval')
              .eq('id', locationId)
              .single()
          : Promise.resolve({ data: null }),
      ]);

      const lab = labResult.data;
      const loc = locationResult.data;

      if (!lab) {
        setSettings(defaultSettings);
        return defaultSettings;
      }

      const nextSettings = {
        barcodePrinterName:
          cleanPrinterName(loc?.barcode_printer_name) || cleanPrinterName(lab.barcode_printer_name),
        reportPrinterName:
          cleanPrinterName(loc?.report_printer_name) || cleanPrinterName(lab.report_printer_name),
        autoPrintBarcodeOnOrder:
          loc?.auto_print_barcode_on_order ?? lab.auto_print_barcode_on_order ?? false,
        autoPrintReportOnApproval:
          loc?.auto_print_report_on_approval ?? lab.auto_print_report_on_approval ?? false,
      };

      setSettings(nextSettings);
      return nextSettings;
    } catch {
      // Non-critical; printing remains optional.
      return settings;
    }
  }, [settings]);

  useEffect(() => {
    if (settingsLoadedRef.current) return;
    settingsLoadedRef.current = true;
    refreshSettings();
  }, []);

  const connect = useCallback(async () => {
    await printService.connect();
  }, []);

  const disconnect = useCallback(async () => {
    await printService.disconnect();
  }, []);

  const autoPrintBarcode = useCallback(async (data: BarcodeLabelData) => {
    console.debug('[PrintBridge][Context] autoPrintBarcode invoked', {
      enabled: settings.autoPrintBarcodeOnOrder,
      printerName: settings.barcodePrinterName,
      sampleId: data.sampleId,
      labelId: data.labelId,
    });

    if (!settings.autoPrintBarcodeOnOrder) return;
    if (!settings.barcodePrinterName) {
      console.warn('[PrintBridge] Auto-print barcode skipped: no barcode printer configured for this location.');
      return;
    }

    try {
      await printService.printBarcodeLabel(settings.barcodePrinterName, data);
      console.log('[PrintBridge] Barcode label print job queued for', data.sampleId);
    } catch (err) {
      console.error('[PrintBridge] Barcode print queue failed:', err);
    }
  }, [settings]);

  const autoPrintReport = useCallback(async (pdfUrl: string) => {
    console.debug('[PrintBridge][Context] autoPrintReport invoked', {
      enabled: settings.autoPrintReportOnApproval,
      printerName: settings.reportPrinterName,
      pdfUrl,
    });

    if (!settings.autoPrintReportOnApproval) return;
    if (!settings.reportPrinterName) {
      console.warn('[PrintBridge] Auto-print report skipped: no report printer configured for this location.');
      return;
    }

    try {
      await printService.printPDFFromUrl(settings.reportPrinterName, pdfUrl);
      console.log('[PrintBridge] Report print job queued from', pdfUrl);
    } catch (err) {
      console.error('[PrintBridge] Report print queue failed:', err);
    }
  }, [settings]);

  return (
    <QZTrayContext.Provider value={{ status, settings, refreshSettings, connect, disconnect, autoPrintBarcode, autoPrintReport }}>
      {children}
    </QZTrayContext.Provider>
  );
};
