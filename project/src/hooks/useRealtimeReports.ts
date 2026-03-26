import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

export interface RealtimeReportUpdate {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  report: any;
  oldReport?: any;
}

interface UseRealtimeReportsOptions {
  orderId?: string;
  onReportGenerated?: (report: any) => void;
  onReportUpdated?: (report: any) => void;
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time report generation updates
 * 
 * @example
 * ```tsx
 * const { isConnected } = useRealtimeReports({
 *   orderId: currentOrderId,
 *   onReportGenerated: (report) => {
 *     showNotification('✅ Report generated!');
 *     setReportUrl(report.report_url);
 *   }
 * });
 * ```
 */
export function useRealtimeReports(options: UseRealtimeReportsOptions = {}) {
  const { orderId, onReportGenerated, onReportUpdated, enabled = true } = options;
  
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<RealtimeReportUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !orderId) {
      console.log('📡 Realtime reports: Disabled or no orderId');
      return;
    }

    console.log('📡 Setting up realtime subscription for reports...', { orderId });
    
    const channel = supabase
      .channel(`reports-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reports',
          filter: `order_id=eq.${orderId}`
        },
        (payload: any) => {
          console.log('📡 Report change received:', payload.eventType, payload);
          
          const update: RealtimeReportUpdate = {
            type: payload.eventType,
            report: payload.new,
            oldReport: payload.old
          };
          
          setLastUpdate(update);
          
          switch (payload.eventType) {
            case 'INSERT':
              console.log('📄 Report generated:', payload.new.id);
              onReportGenerated?.(payload.new);
              break;
              
            case 'UPDATE':
              console.log('🔄 Report updated:', payload.new.id);
              onReportUpdated?.(payload.new);
              break;
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Reports subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);
          console.log('✅ Successfully subscribed to report changes');
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setError('Failed to connect to realtime channel');
        } else if (status === 'TIMED_OUT') {
          setIsConnected(false);
          setError('Connection timed out');
        }
      });

    return () => {
      console.log('📡 Unsubscribing from report changes...');
      channel.unsubscribe();
      setIsConnected(false);
    };
  }, [orderId, enabled, onReportGenerated, onReportUpdated]);

  return {
    isConnected,
    lastUpdate,
    error
  };
}
