import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Banknote,
  User,
  Calendar,
  Building2,
} from 'lucide-react';
import { database } from '../../utils/supabase';
import type { RefundStatus, RefundReasonCategory } from '../../types';

interface RefundRequestView {
  id: string;
  lab_id: string;
  location_id?: string;
  invoice_id: string;
  patient_id: string;
  refund_amount: number;
  refund_method: string;
  status: RefundStatus;
  reason_category?: RefundReasonCategory;
  reason_details?: string;
  admin_notes?: string;
  rejection_reason?: string;
  created_at: string;
  submitted_at?: string;
  approved_at?: string;
  paid_at?: string;
  
  // Joined fields
  invoice_total?: number;
  amount_paid?: number;
  already_refunded?: number;
  max_refundable?: number;
  patient_name?: string;
  patient_phone?: string;
  requested_by_name?: string;
  location_name?: string;
  hours_pending?: number;
}

interface RefundStats {
  pending_count: number;
  pending_amount: number;
  approved_count: number;
  approved_amount: number;
  paid_count: number;
  paid_amount: number;
  rejected_count: number;
  total_count: number;
}

const STATUS_COLORS: Record<RefundStatus, { bg: string; text: string; border: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  pending_approval: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  approved: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  paid: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-300' },
};

const STATUS_LABELS: Record<RefundStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

const REASON_LABELS: Record<RefundReasonCategory, string> = {
  test_cancelled: 'Test Cancelled',
  duplicate_billing: 'Duplicate Billing',
  patient_request: 'Patient Request',
  price_correction: 'Price Correction',
  insurance_adjustment: 'Insurance Adjustment',
  error_correction: 'Error Correction',
  other: 'Other',
};

const RefundApprovalConsole: React.FC = () => {
  const [refundRequests, setRefundRequests] = useState<RefundRequestView[]>([]);
  const [stats, setStats] = useState<RefundStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('pending_approval');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRefund, setSelectedRefund] = useState<RefundRequestView | null>(null);
  const [actionModal, setActionModal] = useState<{
    type: 'approve' | 'reject' | 'mark_paid' | null;
    refund: RefundRequestView | null;
  }>({ type: null, refund: null });
  const [actionNotes, setActionNotes] = useState('');
  const [actionProcessing, setActionProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchRefundRequests = useCallback(async () => {
    setLoading(true);
    try {
      const filters: { status?: string } = {};
      if (selectedStatus && selectedStatus !== 'all') {
        filters.status = selectedStatus;
      }
      
      const { data, error } = await database.refundRequests.getAll(filters);
      if (error) throw error;
      
      // Transform the data to match our interface
      const transformed = (data || []).map((r: any) => ({
        ...r,
        patient_name: r.patients?.name || r.invoices?.patient_name,
        patient_phone: r.patients?.phone,
        requested_by_name: r.users?.name,
        invoice_total: r.invoices?.total,
      }));
      
      setRefundRequests(transformed);
    } catch (err) {
      console.error('Error fetching refund requests:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus]);

  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await database.refundRequests.getStats();
      if (error) throw error;
      setStats(data);
    } catch (err) {
      console.error('Error fetching refund stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchRefundRequests();
    fetchStats();
  }, [fetchRefundRequests, fetchStats]);

  const handleApprove = async () => {
    if (!actionModal.refund) return;
    setActionProcessing(true);
    setActionError(null);
    
    try {
      const { data, error } = await database.refundRequests.approve(
        actionModal.refund.id,
        actionNotes || undefined
      );
      
      if (error) throw error;
      
      // Check RPC response
      if (data && typeof data === 'object' && 'success' in data && !data.success) {
        throw new Error(data.error || 'Failed to approve refund');
      }
      
      setActionModal({ type: null, refund: null });
      setActionNotes('');
      fetchRefundRequests();
      fetchStats();
    } catch (err: any) {
      setActionError(err.message || 'Failed to approve refund');
    } finally {
      setActionProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!actionModal.refund) return;
    
    if (!actionNotes.trim()) {
      setActionError('Please provide a reason for rejection');
      return;
    }
    
    setActionProcessing(true);
    setActionError(null);
    
    try {
      const { data, error } = await database.refundRequests.reject(
        actionModal.refund.id,
        actionNotes
      );
      
      if (error) throw error;
      
      if (data && typeof data === 'object' && 'success' in data && !data.success) {
        throw new Error(data.error || 'Failed to reject refund');
      }
      
      setActionModal({ type: null, refund: null });
      setActionNotes('');
      fetchRefundRequests();
      fetchStats();
    } catch (err: any) {
      setActionError(err.message || 'Failed to reject refund');
    } finally {
      setActionProcessing(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!actionModal.refund) return;
    setActionProcessing(true);
    setActionError(null);
    
    try {
      const { data, error } = await database.refundRequests.markPaid(
        actionModal.refund.id,
        actionNotes || undefined
      );
      
      if (error) throw error;
      
      if (data && typeof data === 'object' && 'success' in data && !data.success) {
        throw new Error(data.error || 'Failed to mark refund as paid');
      }
      
      setActionModal({ type: null, refund: null });
      setActionNotes('');
      fetchRefundRequests();
      fetchStats();
    } catch (err: any) {
      setActionError(err.message || 'Failed to mark refund as paid');
    } finally {
      setActionProcessing(false);
    }
  };

  const filteredRequests = refundRequests.filter(r => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.patient_name?.toLowerCase().includes(term) ||
      r.invoice_id.toLowerCase().includes(term) ||
      r.id.toLowerCase().includes(term)
    );
  });

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

  const formatDate = (dateStr: string) => 
    new Date(dateStr).toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

  const getTimePending = (createdAt: string) => {
    const hours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    if (hours < 24) return `${Math.round(hours)} hrs`;
    return `${Math.round(hours / 24)} days`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Refund Approvals</h1>
          <p className="text-gray-600 mt-1">Review and process refund requests</p>
        </div>
        <button
          onClick={() => {
            fetchRefundRequests();
            fetchStats();
          }}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-yellow-600 font-medium">Pending Approval</div>
                <div className="text-2xl font-bold text-yellow-700">{stats.pending_count}</div>
                <div className="text-sm text-yellow-600">{formatCurrency(stats.pending_amount)}</div>
              </div>
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-blue-600 font-medium">Approved (Unpaid)</div>
                <div className="text-2xl font-bold text-blue-700">{stats.approved_count}</div>
                <div className="text-sm text-blue-600">{formatCurrency(stats.approved_amount)}</div>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <CheckCircle className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg border border-green-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-green-600 font-medium">Paid Out</div>
                <div className="text-2xl font-bold text-green-700">{stats.paid_count}</div>
                <div className="text-sm text-green-600">{formatCurrency(stats.paid_amount)}</div>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-red-50 rounded-lg border border-red-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-red-600 font-medium">Rejected</div>
                <div className="text-2xl font-bold text-red-700">{stats.rejected_count}</div>
                <div className="text-sm text-red-600">Total: {stats.total_count} requests</div>
              </div>
              <div className="bg-red-100 p-3 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient name, invoice ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Refund Requests List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Refund Requests ({filteredRequests.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-500">Loading refund requests...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No refund requests found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Request Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRequests.map(refund => {
                  const statusStyle = STATUS_COLORS[refund.status];
                  
                  return (
                    <tr key={refund.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          #{refund.id.slice(0, 8)}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(refund.created_at)}
                        </div>
                        {refund.status === 'pending_approval' && (
                          <div className="text-xs text-orange-600 mt-1">
                            <Clock className="h-3 w-3 inline mr-1" />
                            Waiting: {getTimePending(refund.created_at)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {refund.patient_name || 'Unknown'}
                            </div>
                            {refund.location_name && (
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {refund.location_name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">
                          {formatCurrency(refund.refund_amount)}
                        </div>
                        <div className="text-xs text-gray-500 capitalize">
                          {refund.refund_method.replace('_', ' ')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {refund.reason_category ? REASON_LABELS[refund.reason_category] : '-'}
                        </div>
                        {refund.reason_details && (
                          <div className="text-xs text-gray-500 truncate max-w-[200px]" title={refund.reason_details}>
                            {refund.reason_details}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}`}>
                          {STATUS_LABELS[refund.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedRefund(refund)}
                            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          
                          {refund.status === 'pending_approval' && (
                            <>
                              <button
                                onClick={() => setActionModal({ type: 'approve', refund })}
                                className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
                                title="Approve"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setActionModal({ type: 'reject', refund })}
                                className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                                title="Reject"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          
                          {refund.status === 'approved' && (
                            <button
                              onClick={() => setActionModal({ type: 'mark_paid', refund })}
                              className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                              title="Mark as Paid"
                            >
                              <Banknote className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedRefund && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Refund Request Details</h3>
              <button
                onClick={() => setSelectedRefund(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Request ID</div>
                  <div className="font-medium">{selectedRefund.id.slice(0, 12)}...</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Status</div>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[selectedRefund.status].bg} ${STATUS_COLORS[selectedRefund.status].text}`}>
                    {STATUS_LABELS[selectedRefund.status]}
                  </span>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Patient</div>
                  <div className="font-medium">{selectedRefund.patient_name}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Refund Amount</div>
                  <div className="font-bold text-lg">{formatCurrency(selectedRefund.refund_amount)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Method</div>
                  <div className="font-medium capitalize">{selectedRefund.refund_method.replace('_', ' ')}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Requested By</div>
                  <div className="font-medium">{selectedRefund.requested_by_name || 'Unknown'}</div>
                </div>
              </div>
              
              {selectedRefund.reason_category && (
                <div>
                  <div className="text-sm text-gray-500">Reason</div>
                  <div className="font-medium">{REASON_LABELS[selectedRefund.reason_category]}</div>
                </div>
              )}
              
              {selectedRefund.reason_details && (
                <div>
                  <div className="text-sm text-gray-500">Details</div>
                  <div className="text-gray-700 bg-gray-50 p-3 rounded">{selectedRefund.reason_details}</div>
                </div>
              )}
              
              {selectedRefund.admin_notes && (
                <div>
                  <div className="text-sm text-gray-500">Admin Notes</div>
                  <div className="text-gray-700 bg-blue-50 p-3 rounded">{selectedRefund.admin_notes}</div>
                </div>
              )}
              
              {selectedRefund.rejection_reason && (
                <div>
                  <div className="text-sm text-gray-500">Rejection Reason</div>
                  <div className="text-red-700 bg-red-50 p-3 rounded">{selectedRefund.rejection_reason}</div>
                </div>
              )}
              
              <div className="text-xs text-gray-500 pt-4 border-t border-gray-200">
                Created: {formatDate(selectedRefund.created_at)}
                {selectedRefund.approved_at && (
                  <> • Approved: {formatDate(selectedRefund.approved_at)}</>
                )}
                {selectedRefund.paid_at && (
                  <> • Paid: {formatDate(selectedRefund.paid_at)}</>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setSelectedRefund(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Modal */}
      {actionModal.type && actionModal.refund && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {actionModal.type === 'approve' && 'Approve Refund'}
                {actionModal.type === 'reject' && 'Reject Refund'}
                {actionModal.type === 'mark_paid' && 'Mark Refund as Paid'}
              </h3>
              <button
                onClick={() => {
                  setActionModal({ type: null, refund: null });
                  setActionNotes('');
                  setActionError(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Patient:</span>
                    <span className="ml-2 font-medium">{actionModal.refund.patient_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Amount:</span>
                    <span className="ml-2 font-bold">{formatCurrency(actionModal.refund.refund_amount)}</span>
                  </div>
                </div>
              </div>
              
              {actionError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-700">{actionError}</span>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {actionModal.type === 'reject' ? 'Rejection Reason *' : 'Notes (Optional)'}
                </label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  rows={3}
                  required={actionModal.type === 'reject'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={
                    actionModal.type === 'reject'
                      ? 'Provide a reason for rejection...'
                      : actionModal.type === 'mark_paid'
                      ? 'Enter payment reference number...'
                      : 'Add any notes...'
                  }
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setActionModal({ type: null, refund: null });
                  setActionNotes('');
                  setActionError(null);
                }}
                disabled={actionProcessing}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (actionModal.type === 'approve') handleApprove();
                  else if (actionModal.type === 'reject') handleReject();
                  else if (actionModal.type === 'mark_paid') handleMarkPaid();
                }}
                disabled={actionProcessing}
                className={`px-4 py-2 rounded-md text-white disabled:opacity-50 flex items-center gap-2 ${
                  actionModal.type === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                  actionModal.type === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {actionProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Processing...
                  </>
                ) : (
                  <>
                    {actionModal.type === 'approve' && <CheckCircle className="h-4 w-4" />}
                    {actionModal.type === 'reject' && <XCircle className="h-4 w-4" />}
                    {actionModal.type === 'mark_paid' && <Banknote className="h-4 w-4" />}
                    {actionModal.type === 'approve' && 'Approve'}
                    {actionModal.type === 'reject' && 'Reject'}
                    {actionModal.type === 'mark_paid' && 'Mark as Paid'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RefundApprovalConsole;
