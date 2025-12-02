import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CreditCard,
  DollarSign,
  Download,
  Loader2,
  MapPin,
  Printer,
  RefreshCcw,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import PaymentSummaryReport from '../components/Billing/PaymentSummaryReport';
import { database } from '../utils/supabase';

interface LocationOption {
  id: string;
  name: string;
}

interface DailySummaryRow {
  location_id: string | null;
  location_name: string | null;
  summary_date: string;
  cash_collections: number;
  non_cash_collections: number;
  total_collections: number;
  cash_refunds: number;
  net_cash: number;
  payment_count: number;
  invoice_count: number;
}

interface PaymentRow {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: string;
  payment_reference: string | null;
  payment_date: string;
  location_id: string | null;
  created_at: string;
}

interface RefundRow {
  id: string;
  invoice_id: string;
  refund_amount: number;
  refund_method: string;
  reason_category: string | null;
  reason_details: string | null;
  paid_at: string | null;
  status: string;
  locations?: { name?: string | null } | null;
  users?: { name?: string | null } | null;
}

const formatCurrency = (value: number) =>
  `₹${(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function CashReconciliation() {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [activeTab, setActiveTab] = useState<'daily' | 'report'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [summaryRows, setSummaryRows] = useState<DailySummaryRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [cashRefunds, setCashRefunds] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadLocations = useCallback(async () => {
    try {
      const { data, error: locationError } = await database.locations.getAll();
      if (locationError) {
        console.error('Failed to load locations:', locationError);
        return;
      }
      setLocations(data || []);
    } catch (err) {
      console.error('Unexpected error loading locations:', err);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const locationFilter = selectedLocationId === 'all' ? undefined : selectedLocationId;

    try {
      const [summaryResponse, paymentsResponse, refundsResponse] = await Promise.all([
        database.refundRequests.getDailyCashSummary(selectedDate, locationFilter),
        database.payments.getPaymentSummary(selectedDate, selectedDate),
        database.refundRequests.getCashRefundsByDate(selectedDate, locationFilter)
      ]);

      if (summaryResponse.error) {
        throw summaryResponse.error;
      }

      if (paymentsResponse.error) {
        throw paymentsResponse.error;
      }

      if (refundsResponse.error) {
        throw refundsResponse.error;
      }

      const summaryData = (summaryResponse.data || []) as DailySummaryRow[];
      const paymentData = (paymentsResponse.data || []) as PaymentRow[];
      const refundData = (refundsResponse.data || []) as RefundRow[];

      const filteredPayments = paymentData.filter((payment) => {
        const paymentDate = payment.payment_date?.split('T')[0];
        const matchesDate = paymentDate === selectedDate;
        const matchesLocation =
          selectedLocationId === 'all' || !locationFilter || payment.location_id === locationFilter;
        return matchesDate && matchesLocation;
      });

      setSummaryRows(summaryData);
      setPayments(filteredPayments);
      setCashRefunds(refundData);
    } catch (err) {
      console.error('Error loading cash reconciliation:', err);
      const message = err instanceof Error ? err.message : 'Failed to load cash reconciliation data.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedLocationId]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const locationOptions = useMemo(() => {
    const base: LocationOption[] = [{ id: 'all', name: 'All Locations' }];
    const mapped = locations.map((location) => ({ id: location.id, name: location.name }));
    return [...base, ...mapped];
  }, [locations]);

  const aggregatedSummary = useMemo(() => {
    // Calculate actual cash refunds from refund data
    const actualCashRefunds = cashRefunds.reduce(
      (sum, refund) => sum + (Number(refund.refund_amount) || 0),
      0
    );

    if (!summaryRows.length) {
      return {
        cash_collections: 0,
        non_cash_collections: 0,
        total_collections: 0,
        cash_refunds: actualCashRefunds,
        net_cash: -actualCashRefunds,
        payment_count: 0,
        invoice_count: 0
      };
    }

    const summary = summaryRows.reduce(
      (totals, row) => ({
        cash_collections: totals.cash_collections + (row.cash_collections || 0),
        non_cash_collections: totals.non_cash_collections + (row.non_cash_collections || 0),
        total_collections: totals.total_collections + (row.total_collections || 0),
        cash_refunds: totals.cash_refunds + (row.cash_refunds || 0),
        net_cash: totals.net_cash + (row.net_cash || 0),
        payment_count: totals.payment_count + (row.payment_count || 0),
        invoice_count: totals.invoice_count + (row.invoice_count || 0)
      }),
      {
        cash_collections: 0,
        non_cash_collections: 0,
        total_collections: 0,
        cash_refunds: 0,
        net_cash: 0,
        payment_count: 0,
        invoice_count: 0
      }
    );

    // Override cash_refunds with actual data and recalculate net_cash
    summary.cash_refunds = actualCashRefunds;
    summary.net_cash = summary.cash_collections - actualCashRefunds;

    return summary;
  }, [summaryRows, cashRefunds]);

  const paymentBreakdown = useMemo(() => {
    const breakdown = new Map<string, { amount: number; count: number }>();
    payments.forEach((payment) => {
      const methodKey = payment.payment_method?.toLowerCase() || 'unknown';
      const entry = breakdown.get(methodKey) || { amount: 0, count: 0 };
      entry.amount += Number(payment.amount) || 0;
      entry.count += 1;
      breakdown.set(methodKey, entry);
    });
    return breakdown;
  }, [payments]);

  const totalPaymentAmount = useMemo(
    () => payments.reduce((total, payment) => total + (Number(payment.amount) || 0), 0),
    [payments]
  );

  const cashPayments = useMemo(
    () => payments.filter((payment) => payment.payment_method?.toLowerCase() === 'cash'),
    [payments]
  );

  const digitalPayments = useMemo(
    () => payments.filter((payment) => payment.payment_method?.toLowerCase() !== 'cash'),
    [payments]
  );

  const cashVariance = useMemo(() => {
    const expectedNetCash = aggregatedSummary.cash_collections - aggregatedSummary.cash_refunds;
    return {
      expectedNetCash,
      status: expectedNetCash >= 0 ? 'positive' : 'negative'
    };
  }, [aggregatedSummary.cash_collections, aggregatedSummary.cash_refunds]);

  const locationBreakdown = useMemo(() => {
    if (!summaryRows.length) {
      return [];
    }
    return summaryRows.map((row) => ({
      locationId: row.location_id || 'unassigned',
      locationName: row.location_name || 'Unassigned Location',
      cash: row.cash_collections || 0,
      digital: row.non_cash_collections || 0,
      deposits: row.cash_collections - row.net_cash,
      refunds: row.cash_refunds || 0,
      netCash: row.net_cash || 0,
      payments: row.payment_count || 0
    }));
  }, [summaryRows]);

  const handleRefresh = useCallback(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cash Reconciliation</h1>
          <p className="text-sm text-gray-500">
            Live reconciliation view driven from payments, refunds, and daily cash summary aggregated by lab location.
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'daily' ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            Daily Reconciliation
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'report' ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            Payment Reports
          </button>
        </div>
      </div>

      {activeTab === 'daily' ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center space-x-3">
                <Calendar className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Recon Date</p>
                  <h3 className="text-lg font-semibold text-gray-900">{formatDate(selectedDate)}</h3>
                </div>
              </div>
              <div className="mt-3 flex items-center space-x-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center space-x-3">
                <MapPin className="h-5 w-5 text-indigo-500" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Location</p>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {locationOptions.find((option) => option.id === selectedLocationId)?.name || 'All Locations'}
                  </h3>
                </div>
              </div>
              <div className="mt-3 flex items-center space-x-2">
                <select
                  value={selectedLocationId}
                  onChange={(event) => setSelectedLocationId(event.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                >
                  {locationOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center space-x-3">
                <RefreshCcw className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Data Sync</p>
                  <h3 className="text-lg font-semibold text-gray-900">Realtime Pull</h3>
                </div>
              </div>
              <div className="mt-3 flex items-center space-x-2">
                <button
                  onClick={handleRefresh}
                  className="flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
                  Refresh Data
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Unable to load reconciliation data</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-blue-500">Cash Collections</span>
                <DollarSign className="h-5 w-5 text-blue-500" />
              </div>
              <div className="mt-3 text-2xl font-bold text-gray-900">{formatCurrency(aggregatedSummary.cash_collections)}</div>
              <p className="mt-2 text-xs text-gray-500">Cash receipts posted on {formatDate(selectedDate)}</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-purple-500">Digital Collections</span>
                <CreditCard className="h-5 w-5 text-purple-500" />
              </div>
              <div className="mt-3 text-2xl font-bold text-gray-900">{formatCurrency(aggregatedSummary.non_cash_collections)}</div>
              <p className="mt-2 text-xs text-gray-500">UPI, card, and bank transfer receipts</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-500">Cash Refunds</span>
                <TrendingDown className="h-5 w-5 text-amber-500" />
              </div>
              <div className="mt-3 text-2xl font-bold text-gray-900">{formatCurrency(aggregatedSummary.cash_refunds)}</div>
              <p className="mt-2 text-xs text-gray-500">Cash refunds that were marked as paid</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Net Cash Expected</span>
                {cashVariance.status === 'positive' ? (
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                )}
              </div>
              <div
                className={`mt-3 text-2xl font-bold ${cashVariance.status === 'positive' ? 'text-emerald-600' : 'text-red-600'}`}
              >
                {formatCurrency(cashVariance.expectedNetCash)}
              </div>
              <p className="mt-2 text-xs text-gray-500">Cash remaining after refunds (before physical count)</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Payment Breakdown</h3>
                <p className="text-sm text-gray-500">{payments.length} transactions totalling {formatCurrency(totalPaymentAmount)}.</p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => alert('Printable summary will include all payment methods and totals.')}
                  className="flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Summary
                </button>
                <button
                  onClick={() => alert('CSV export will include payment-level detail from the database.')}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </button>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Transactions</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Share</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paymentBreakdown.size === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                        No payments recorded for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    Array.from(paymentBreakdown.entries()).map(([methodKey, entry]) => {
                      const methodLabel = methodKey.replace(/\b\w/g, (char) => char.toUpperCase());
                      const share = totalPaymentAmount ? (entry.amount / totalPaymentAmount) * 100 : 0;
                      return (
                        <tr key={methodKey} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{methodLabel}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">{entry.count}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">{formatCurrency(entry.amount)}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">{share.toFixed(1)}%</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Cash Collections</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {cashPayments.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                          No cash payments recorded for the selected filters.
                        </td>
                      </tr>
                    ) : (
                      cashPayments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                            {formatDateTime(payment.payment_date)}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{payment.invoice_id}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {formatCurrency(Number(payment.amount) || 0)}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                            {payment.payment_reference || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Digital Collections</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Method</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {digitalPayments.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                          No digital payments recorded for the selected filters.
                        </td>
                      </tr>
                    ) : (
                      digitalPayments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                            {formatDateTime(payment.payment_date)}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{payment.invoice_id}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                            {payment.payment_method || '—'}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {formatCurrency(Number(payment.amount) || 0)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Cash Refunds Paid</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Reason</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Processed By</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Paid At</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {cashRefunds.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                        No cash refunds were marked as paid for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    cashRefunds.map((refund) => (
                      <tr key={refund.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{refund.invoice_id}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {formatCurrency(Number(refund.refund_amount) || 0)}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                          {refund.reason_details || refund.reason_category || '—'}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                          {refund.users?.name || '—'}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">{formatDateTime(refund.paid_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Daily Summary by Location</h3>
              <span className="text-xs text-gray-500">Sourced from v_daily_cash_summary</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Cash</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Digital</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Refunds</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Net Cash</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Payments</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {locationBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                        No summary data available for the selected date.
                      </td>
                    </tr>
                  ) : (
                    locationBreakdown.map((item) => (
                      <tr key={item.locationId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{item.locationName}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">{formatCurrency(item.cash)}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">{formatCurrency(item.digital)}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">{formatCurrency(item.refunds)}</td>
                        <td
                          className={`px-6 py-3 whitespace-nowrap text-sm font-semibold ${item.netCash >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                        >
                          {formatCurrency(item.netCash)}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">{item.payments}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <PaymentSummaryReport key={`${selectedDate}-${selectedLocationId}-${activeTab}`} />
      )}
    </div>
  );
}