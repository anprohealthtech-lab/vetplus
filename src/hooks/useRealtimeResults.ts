import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

export interface RealtimeResultUpdate {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  result: any;
  oldResult?: any;
}

interface UseRealtimeResultsOptions {
  orderId?: string;
  testGroupId?: string;
  onInsert?: (result: any) => void;
  onUpdate?: (result: any, oldResult: any) => void;
  onDelete?: (resultId: string) => void;
  onVerificationChange?: (result: any) => void;
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time result value changes from Supabase
 * 
 * @example
 * ```tsx
 * const { isConnected, lastUpdate } = useRealtimeResults({
 *   orderId: currentOrderId,
 *   onUpdate: (result) => {
 *     setResults(prev => prev.map(r => r.id === result.id ? result : r));
 *     if (result.is_verified) {
 *       showNotification('Result verified!');
 *     }
 *   }
 * });
 * ```
 */
export function useRealtimeResults(options: UseRealtimeResultsOptions = {}) {
  const { 
    orderId, 
    testGroupId, 
    onInsert, 
    onUpdate, 
    onDelete,
    onVerificationChange,
    enabled = true 
  } = options;
  
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<RealtimeResultUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      console.log('📡 Realtime results: Disabled');
      return;
    }

    // Need at least one filter
    if (!orderId && !testGroupId) {
      console.warn('📡 Realtime results: No orderId or testGroupId provided');
      return;
    }

    console.log('📡 Setting up realtime subscription for results...', { orderId, testGroupId });
    
    // Build filter
    let filter: string | undefined;
    if (orderId && testGroupId) {
      filter = `order_id=eq.${orderId}&test_group_id=eq.${testGroupId}`;
    } else if (orderId) {
      filter = `order_id=eq.${orderId}`;
    } else if (testGroupId) {
      filter = `test_group_id=eq.${testGroupId}`;
    }
    
    const channelName = orderId ? `results-order-${orderId}` : `results-test-${testGroupId}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'result_values',
          ...(filter && { filter })
        },
        (payload: any) => {
          console.log('📡 Result change received:', payload.eventType, payload);
          
          const update: RealtimeResultUpdate = {
            type: payload.eventType,
            result: payload.new,
            oldResult: payload.old
          };
          
          setLastUpdate(update);
          
          // Call event-specific handlers
          switch (payload.eventType) {
            case 'INSERT':
              console.log('✨ New result entered:', payload.new.id);
              onInsert?.(payload.new);
              break;
              
            case 'UPDATE':
              console.log('🔄 Result updated:', payload.new.id);
              onUpdate?.(payload.new, payload.old);
              
              // Check if verification status changed
              if (payload.old && payload.new.is_verified !== payload.old.is_verified) {
                console.log('🔐 Verification status changed:', payload.new.is_verified);
                onVerificationChange?.(payload.new);
              }
              break;
              
            case 'DELETE':
              console.log('🗑️ Result deleted:', payload.old.id);
              onDelete?.(payload.old.id);
              break;
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Results subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);
          console.log('✅ Successfully subscribed to result changes');
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setError('Failed to connect to realtime channel');
          console.error('❌ Failed to subscribe to result changes');
        } else if (status === 'TIMED_OUT') {
          setIsConnected(false);
          setError('Connection timed out');
          console.warn('⏱️ Subscription timed out');
        }
      });

    // Cleanup on unmount
    return () => {
      console.log('📡 Unsubscribing from result changes...');
      channel.unsubscribe();
      setIsConnected(false);
    };
  }, [orderId, testGroupId, enabled, onInsert, onUpdate, onDelete, onVerificationChange]);

  return {
    isConnected,
    lastUpdate,
    error
  };
}
