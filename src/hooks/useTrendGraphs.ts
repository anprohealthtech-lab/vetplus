import { useState, useCallback } from 'react';
import { database } from '../utils/supabase';

export interface TrendDataPoint {
  date: string;
  timestamp: string; // Full timestamp for uniqueness
  value: number;
  flag?: string | null;
  resultValueId?: string; // For debugging/tracking
}

export interface TrendAnalyte {
  analyte_id: string;
  analyte_name: string;
  unit: string;
  dataPoints: TrendDataPoint[];
  reference_range: {
    min: number;
    max: number;
  };
  trend: 'increasing' | 'decreasing' | 'stable' | 'insufficient_data';
}

export interface TrendGraphData {
  analytes: TrendAnalyte[];
  patient_id: string;
  generated_at: string;
}

// Input type for generating trends - supports both ID and name matching
export interface AnalyteInput {
  analyte_id?: string;
  parameter: string; // analyte name for fallback matching
}

export const useTrendGraphs = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Calculate trend direction from data points
   */
  const calculateTrend = useCallback((dataPoints: TrendDataPoint[]): TrendAnalyte['trend'] => {
    if (dataPoints.length < 2) return 'insufficient_data';
    
    const recent = dataPoints.slice(-3); // Last 3 points
    const older = dataPoints.slice(Math.max(0, dataPoints.length - 6), Math.max(0, dataPoints.length - 3));
    
    if (older.length === 0) return 'insufficient_data';
    
    const recentAvg = recent.reduce((sum, p) => sum + p.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, p) => sum + p.value, 0) / older.length;
    
    const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (Math.abs(percentChange) < 5) return 'stable';
    if (percentChange > 0) return 'increasing';
    return 'decreasing';
  }, []);

  /**
   * Generate and save trend data for an order
   * Uses v_report_template_context view for consistency with TrendModal
   */
  const generateAndSaveTrends = useCallback(async (
    orderId: string,
    patientId: string,
    analyteIds: string[],
    analyteNames?: string[] // Optional: analyte names for better matching
  ) => {
    setLoading(true);
    setError(null);

    try {
      console.log('[TrendGraphs] Generating trends for:', {
        orderId,
        patientId,
        analyteIds,
        analyteNames
      });

      // 1. Fetch historical data from v_report_template_context (same as TrendModal)
      // This ensures consistency - the view aggregates all analytes by order
      const { data: orderData, error: fetchError } = await database.supabase
        .from('v_report_template_context')
        .select('order_id, order_date, analytes')
        .eq('patient_id', patientId)
        .order('order_date', { ascending: true })
        .limit(50); // Get up to 50 orders for trend

      if (fetchError) {
        console.error('[TrendGraphs] Fetch error:', fetchError);
        throw fetchError;
      }

      console.log('[TrendGraphs] Fetched orders:', orderData?.length || 0);

      if (!orderData || orderData.length === 0) {
        throw new Error('No historical data found for trend analysis');
      }

      // 2. Extract analytes from the view data and group by analyte name
      // The view contains JSONB array of analytes per order
      const analyteMap = new Map<string, {
        analyte_id: string;
        analyte_name: string;
        unit: string;
        reference_range: string;
        dataPoints: Array<{
          date: string;
          timestamp: string;
          resultValueId: string;
          value: number;
          flag: string | null;
        }>;
      }>();

      // Build set of analyte names to match (from IDs or provided names)
      const targetAnalyteNames = new Set<string>();
      
      orderData.forEach((order: any) => {
        const analytes = order.analytes || [];
        analytes.forEach((a: any) => {
          // If analyteIds provided, check if this analyte's ID matches
          const matchesId = analyteIds.length === 0 || analyteIds.includes(a.analyte_id);
          // If analyteNames provided, also check name match
          const matchesName = !analyteNames || analyteNames.length === 0 || 
            analyteNames.some(name => name.toLowerCase() === a.parameter?.toLowerCase());
          
          if (matchesId || matchesName) {
            targetAnalyteNames.add(a.parameter);
          }
        });
      });

      console.log('[TrendGraphs] Target analyte names:', Array.from(targetAnalyteNames));

      // Now extract all matching data points
      orderData.forEach((order: any) => {
        const analytes = order.analytes || [];
        analytes.forEach((a: any) => {
          if (!targetAnalyteNames.has(a.parameter)) return;
          if (!a.value) return; // Skip if no value

          const key = a.parameter; // Group by analyte name
          
          if (!analyteMap.has(key)) {
            analyteMap.set(key, {
              analyte_id: a.analyte_id || '',
              analyte_name: a.parameter,
              unit: a.unit || '',
              reference_range: a.reference_range || '',
              dataPoints: []
            });
          }

          analyteMap.get(key)!.dataPoints.push({
            date: order.order_date,
            timestamp: order.order_date, // View doesn't have created_at, use order_date
            resultValueId: a.result_value_id || '',
            value: parseFloat(a.value),
            flag: a.flag || null
          });
        });
      });

      console.log('[TrendGraphs] Grouped analytes:', analyteMap.size);

      if (analyteMap.size === 0) {
        throw new Error('No matching analyte data found for trend analysis');
      }

      // 3. Build trend graph data structure
      const parseReferenceRange = (rangeText: string): { min: number; max: number } => {
        if (!rangeText) return { min: 0, max: 0 };
        const rangeMatch = rangeText.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
        if (rangeMatch) {
          return { min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) };
        }
        const lessThanMatch = rangeText.match(/<\s*([\d.]+)/);
        if (lessThanMatch) {
          return { min: 0, max: parseFloat(lessThanMatch[1]) };
        }
        const greaterThanMatch = rangeText.match(/>\s*([\d.]+)/);
        if (greaterThanMatch) {
          return { min: parseFloat(greaterThanMatch[1]), max: Number.MAX_VALUE };
        }
        return { min: 0, max: 0 };
      };

      const trendData: TrendGraphData = {
        analytes: Array.from(analyteMap.values()).map((data) => {
          // Sort by date
          const sortedPoints = data.dataPoints.sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );

          return {
            analyte_id: data.analyte_id,
            analyte_name: data.analyte_name,
            unit: data.unit,
            dataPoints: sortedPoints,
            reference_range: parseReferenceRange(data.reference_range),
            trend: calculateTrend(sortedPoints)
          };
        }),
        patient_id: patientId,
        generated_at: new Date().toISOString()
      };

      console.log('[TrendGraphs] Built trend data:', {
        analytesCount: trendData.analytes.length,
        dataPointsByAnalyte: trendData.analytes.map(a => ({
          name: a.analyte_name,
          points: a.dataPoints.length
        }))
      });

      // 4. Save to database via RPC
      const { error: saveError } = await database.aiAnalysis.saveTrendData(
        orderId,
        trendData
      );

      if (saveError) throw saveError;

      setLoading(false);
      return { success: true, data: trendData };

    } catch (err: any) {
      const errorMsg = err.message || 'Failed to generate trend graphs';
      setError(errorMsg);
      console.error('Trend generation error:', err);
      setLoading(false);
      return { success: false, error: errorMsg };
    }
  }, [calculateTrend]);

  /**
   * Load existing trend data for an order
   */
  const loadTrendData = useCallback(async (orderId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: loadError } = await database.aiAnalysis.getTrendData(orderId);
      
      if (loadError) throw loadError;

      setLoading(false);
      // Return null data gracefully if order not found or no trend data yet
      return { success: true, data: data?.trend_graph_data || null };
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to load trend data';
      setError(errorMsg);
      setLoading(false);
      // Don't treat "not found" as error - just return null data
      return { success: true, data: null };
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    generateAndSaveTrends,
    loadTrendData,
    loading,
    error,
    clearError
  };
};
