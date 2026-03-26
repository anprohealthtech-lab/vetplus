import { useState, useEffect } from 'react';
import { database } from '../utils/supabase';

interface UseOrderStatusResult {
  order: any | null;
  loading: boolean;
  error: string | null;
  consistentStatus: string | null;
  refreshOrder: () => Promise<void>;
  markAsCollected: (collectedBy: string) => Promise<{ error: any }>;
  markAsNotCollected: () => Promise<{ error: any }>;
}

export const useOrderStatus = (orderId: string | null): UseOrderStatusResult => {
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get consistent status based on sample collection
  const getConsistentStatus = (order: any) => {
    if (!order) return null;
    
    // If sample is collected but status doesn't reflect it
    if (order.sample_collected_at && order.status === 'Pending Collection') {
      return 'In Progress';
    }
    
    // If sample not collected but status says otherwise
    if (!order.sample_collected_at && order.status === 'In Progress') {
      return 'Pending Collection';
    }
    
    return order.status;
  };

  const fetchOrder = async () => {
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await database.orders.getById(orderId);
      
      if (fetchError) {
        setError(fetchError.message || 'Failed to fetch order');
        setOrder(null);
      } else if (data) {
        // Ensure consistent status
        data.status = getConsistentStatus(data);
        setOrder(data);
      }
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Failed to load order details');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const markAsCollected = async (collectedBy: string) => {
    if (!orderId) return { error: new Error('No order ID') };
    
    const { error } = await database.orders.update(orderId, {
      sample_collected_at: new Date().toISOString(),
      sample_collected_by: collectedBy,
      status: 'In Progress' // Explicitly set status
    });
    
    if (!error) {
      await fetchOrder(); // Refresh
    }
    return { error };
  };

  const markAsNotCollected = async () => {
    if (!orderId) return { error: new Error('No order ID') };
    
    const { error } = await database.orders.update(orderId, {
      sample_collected_at: null,
      sample_collected_by: null,
      status: 'Pending Collection' // Explicitly set status
    });
    
    if (!error) {
      await fetchOrder(); // Refresh
    }
    return { error };
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  return {
    order,
    loading,
    error,
    consistentStatus: order ? getConsistentStatus(order) : null,
    refreshOrder: fetchOrder,
    markAsCollected,
    markAsNotCollected
  };
};

export default useOrderStatus;