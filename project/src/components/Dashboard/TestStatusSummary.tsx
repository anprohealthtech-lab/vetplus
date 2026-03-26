import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';

export type TestStatus = 'all_done' | 'mostly_done' | 'pending' | 'awaiting_approval';

export interface OrderStatus {
  id: string;
  patientName: string;
  testsTotal: number;
  testsDone: number;
  awaitingApproval: boolean;
}

const statusColor: Record<TestStatus, string> = {
  all_done: 'bg-green-500',
  mostly_done: 'bg-green-300',
  pending: 'bg-red-500',
  awaiting_approval: 'bg-orange-400',
};

function getStatus(order: OrderStatus): TestStatus {
  if (order.awaitingApproval) return 'awaiting_approval';
  if (order.testsDone === order.testsTotal) return 'all_done';
  if (order.testsDone === 0) return 'pending';
  return 'mostly_done';
}


export const TestStatusSummary: React.FC = () => {
  const [orders, setOrders] = useState<OrderStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, patient_name');
      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        setOrders([]);
        setLoading(false);
        return;
      }

      // For each order, fetch tests and results
      const dashboardOrders: OrderStatus[] = await Promise.all(
        (ordersData || []).map(async (order: any) => {
          // Get total tests for this order
          const { count: testsTotal, error: testsError } = await supabase
            .from('order_tests')
            .select('id', { count: 'exact', head: true })
            .eq('order_id', order.id);
          // Get results for this order
          const { data: resultsData, error: resultsError } = await supabase
            .from('results')
            .select('id, status, reviewed_by')
            .eq('order_id', order.id);

          let testsDone = 0;
          let awaitingApproval = false;
          if (resultsData && resultsData.length > 0) {
            // Count results with status 'Reviewed' or 'Approved' as done
            testsDone = resultsData.filter(r => r.status === 'Reviewed' || r.status === 'Approved').length;
            // If any result is 'Entered' and not reviewed, mark as awaiting approval
            awaitingApproval = resultsData.some(r => r.status === 'Entered' && !r.reviewed_by);
          }

          return {
            id: order.id,
            patientName: order.patient_name,
            testsTotal: testsTotal || 0,
            testsDone,
            awaitingApproval,
          };
        })
      );
      setOrders(dashboardOrders);
      setLoading(false);
    }
    fetchDashboardData();
  }, []);

  const summary = orders.reduce(
    (acc, order) => {
      const status = getStatus(order);
      acc[status]++;
      return acc;
    },
    { all_done: 0, mostly_done: 0, pending: 0, awaiting_approval: 0 }
  );

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-lg font-bold mb-4">Test Status Summary</h2>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          <div className="flex gap-6 mb-6">
            <StatusBadge color={statusColor.all_done} label="All Done" count={summary.all_done} />
            <StatusBadge color={statusColor.mostly_done} label="Mostly Done" count={summary.mostly_done} />
            <StatusBadge color={statusColor.pending} label="Pending" count={summary.pending} />
            <StatusBadge color={statusColor.awaiting_approval} label="Awaiting Approval" count={summary.awaiting_approval} />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Status</th>
                <th>Patient</th>
                <th>Tests Done</th>
                <th>Total Tests</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const status = getStatus(order);
                return (
                  <tr key={order.id} className="border-b">
                    <td>
                      <span className={`inline-block w-3 h-3 rounded-full mr-2 ${statusColor[status]}`}></span>
                      {status.replace('_', ' ')}
                    </td>
                    <td>{order.patientName}</td>
                    <td>{order.testsDone}</td>
                    <td>{order.testsTotal}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};


const StatusBadge: React.FC<{ color: string; label: string; count: number }> = ({ color, label, count }) => (
  <div className="flex items-center gap-2">
    <span className={`inline-block w-4 h-4 rounded-full ${color}`}></span>
    <span className="font-semibold">{label}:</span>
    <span>{count}</span>
  </div>
);

export default TestStatusSummary;
