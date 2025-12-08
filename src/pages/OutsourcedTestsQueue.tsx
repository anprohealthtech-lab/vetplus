import React, { useEffect, useState, useCallback } from 'react';
import { database, supabase } from '../utils/supabase';
import {
  TestTube,
  Truck,
  Package,
  Clock,
  Send,
  Loader2,
  Download,
  AlertCircle,
  CheckCircle,
  Barcode,
  MapPin,
  Calendar,
  X,
  CheckSquare,
  Square
} from 'lucide-react';
import type { OutsourcedTestQueueItem } from '../types';

type TabFilter = 'pending_send' | 'sent' | 'awaiting_report' | 'overdue';

const OutsourcedTestsQueue: React.FC = () => {
  const [queueItems, setQueueItems] = useState<OutsourcedTestQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabFilter>('pending_send');
  const [selectedLab, setSelectedLab] = useState<string>('all');
  const [labsList, setLabsList] = useState<Array<{ id: string; name: string }>>([]);
  const [currentLabId, setCurrentLabId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);

  useEffect(() => {
    fetchCurrentLab();
    fetchQueue();
    fetchOutsourcedLabs();
  }, [activeTab, selectedLab, fromDate, toDate]);

  const fetchCurrentLab = async () => {
    const lab_id = await database.getCurrentUserLabId();
    setCurrentLabId(lab_id);
  };

  const fetchOutsourcedLabs = async () => {
    try {
      // Get current user's lab_id to filter relevant outsourced labs
      const lab_id = await database.getCurrentUserLabId();
      if (!lab_id) {
        console.error('No lab context found');
        return;
      }

      // Query outsourced_labs that are active and available to this lab
      const { data, error } = await supabase
        .from('outsourced_labs')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (!error && data) {
        setLabsList(data);
      }
    } catch (err) {
      console.error('Error fetching outsourced labs:', err);
    }
  };

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setSelectedItems(new Set()); // Clear selection on refresh

    const filters: any = {};
    if (selectedLab !== 'all') filters.outsourcedLabId = selectedLab;
    if (activeTab !== 'overdue') filters.status = activeTab;
    if (fromDate) filters.fromDate = fromDate;
    if (toDate) filters.toDate = toDate;

    const { data, error } = await database.outsourcedReports.getPendingTests(filters);

    if (error) {
      console.error('Error fetching queue:', error);
      alert('Failed to load queue');
      setQueueItems([]);
    } else {
      let items = data || [];

      // Filter overdue items if on overdue tab
      if (activeTab === 'overdue') {
        const now = new Date();
        items = items.filter(item => {
          if (!item.outsourced_tat_estimate) return false;
          return new Date(item.outsourced_tat_estimate) < now;
        });
      }

      setQueueItems(items);
    }
    setLoading(false);
  }, [activeTab, selectedLab]);

  const toggleSelectAll = () => {
    if (selectedItems.size === queueItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(queueItems.map(item => item.result_id)));
    }
  };

  const toggleSelectItem = (resultId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(resultId)) {
      newSelection.delete(resultId);
    } else {
      newSelection.add(resultId);
    }
    setSelectedItems(newSelection);
  };

  const handleBulkDispatch = async () => {
    if (selectedItems.size === 0) {
      alert('Please select tests to dispatch');
      return;
    }

    const confirmed = window.confirm(`Dispatch ${selectedItems.size} test(s)?`);
    if (!confirmed) return;

    setDispatching(true);
    let successCount = 0;
    let failCount = 0;

    for (const resultId of Array.from(selectedItems)) {
      try {
        // Generate tracking barcode
        const { data: barcodeData, error: barcodeError } = await database.outsourcedReports.generateTrackingBarcode(resultId);
        
        if (barcodeError) throw barcodeError;

        // Update BOTH logistics status AND outsourced status
        const { error } = await database.outsourcedReports.updateLogisticsStatus(
          resultId,
          'in_transit',
          'Dispatched to outsourced lab',
          'sent' // ✅ Update outsourced_status to 'sent'
        );

        if (error) throw error;
        successCount++;
      } catch (error) {
        console.error('Error dispatching:', error);
        failCount++;
      }
    }

    setDispatching(false);
    setSelectedItems(new Set());
    
    if (failCount === 0) {
      alert(`Successfully dispatched ${successCount} test(s)!`);
    } else {
      alert(`Dispatched ${successCount} test(s). Failed: ${failCount}`);
    }
    
    fetchQueue();
  };

  const handleCancelDispatch = async (resultId: string) => {
    const confirmed = window.confirm('Cancel dispatch for this test?');
    if (!confirmed) return;

    try {
      const { error } = await database.outsourcedReports.updateLogisticsStatus(
        resultId,
        'pending_dispatch',
        'Dispatch cancelled',
        'pending_send' // Reset to pending_send
      );

      if (error) throw error;
      alert('Dispatch cancelled successfully');
      fetchQueue();
    } catch (error) {
      console.error('Error cancelling dispatch:', error);
      alert('Failed to cancel dispatch');
    }
  };

  const handleMarkAsReceived = async (resultId: string) => {
    const confirmed = window.confirm('Mark as received by external lab? (Optional - for tracking purposes only)');
    if (!confirmed) return;

    try {
      const { error } = await database.outsourcedReports.updateLogisticsStatus(
        resultId,
        'delivered_to_lab',
        'Sample received by external lab - manually confirmed',
        'awaiting_report' // Explicitly set to awaiting_report
      );

      if (error) throw error;
      alert('Logistics status updated to "Received by Lab"');
      fetchQueue();
    } catch (error) {
      console.error('Error marking as received:', error);
      alert('Failed to update status');
    }
  };

  const handleUpdateLogistics = async (resultId: string, newStatus: string, statusLabel: string) => {
    const confirmed = window.confirm(`Update logistics status to "${statusLabel}"?`);
    if (!confirmed) return;

    try {
      const { error } = await database.outsourcedReports.updateLogisticsStatus(
        resultId,
        newStatus,
        `Logistics status updated to ${statusLabel}`
      );

      if (error) throw error;
      alert(`Logistics updated to "${statusLabel}"`);
      fetchQueue();
    } catch (error) {
      console.error('Error updating logistics:', error);
      alert('Failed to update logistics status');
    }
  };

  const handlePrintRequisition = async (item: OutsourcedTestQueueItem) => {
    // Generate requisition PDF
    const requisitionHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { margin: 0; color: #2563eb; }
          .section { margin-bottom: 25px; }
          .section h2 { background: #f3f4f6; padding: 10px; margin-bottom: 15px; }
          .info-grid { display: grid; grid-template-columns: 150px 1fr; gap: 10px; }
          .info-label { font-weight: bold; }
          .barcode { text-align: center; margin: 30px 0; }
          .barcode-text { font-size: 24px; font-family: monospace; letter-spacing: 3px; }
          .footer { margin-top: 50px; border-top: 1px solid #ccc; padding-top: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Outsourced Test Requisition</h1>
          <p>Please process the following test and return results</p>
        </div>

        <div class="section">
          <h2>Patient Information</h2>
          <div class="info-grid">
            <span class="info-label">Patient Name:</span>
            <span>${item.patient_name}</span>
            <span class="info-label">Patient ID:</span>
            <span>${item.patient_id}</span>
          </div>
        </div>

        <div class="section">
          <h2>Test Details</h2>
          <div class="info-grid">
            <span class="info-label">Test Name:</span>
            <span>${item.test_name}</span>
            <span class="info-label">Order Number:</span>
            <span>${item.order_number || 'N/A'}</span>
            <span class="info-label">Order Date:</span>
            <span>${new Date().toLocaleDateString()}</span>
            <span class="info-label">Expected TAT:</span>
            <span>${item.outsourced_tat_estimate ? new Date(item.outsourced_tat_estimate).toLocaleDateString() : 'N/A'}</span>
          </div>
        </div>

        ${item.tracking_barcode ? `
          <div class="barcode">
            <p style="font-weight: bold; margin-bottom: 10px;">Tracking Number</p>
            <div class="barcode-text">${item.tracking_barcode}</div>
            <p style="font-size: 12px; color: #666; margin-top: 10px;">Please reference this tracking number in your report</p>
          </div>
        ` : ''}

        <div class="section">
          <h2>Special Instructions</h2>
          <p>${item.logistics_notes || 'No special instructions'}</p>
        </div>

        <div class="footer">
          <p>Generated on ${new Date().toLocaleString()}</p>
          <p>For queries, please contact the sending laboratory</p>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([requisitionHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const TabButton = ({ value, label, count }: { value: TabFilter; label: string; count: number }) => (
    <button
      onClick={() => setActiveTab(value)}
      className={`px-4 py-2 font-medium rounded-lg transition-colors ${
        activeTab === value
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
          activeTab === value ? 'bg-blue-700' : 'bg-gray-300'
        }`}>
          {count}
        </span>
      )}
    </button>
  );

  const getDaysUntilTAT = (tatDate?: string): number => {
    if (!tatDate) return 0;
    const diff = new Date(tatDate).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading queue...</span>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <TestTube className="w-8 h-8" />
          Outsourced Tests Queue
        </h1>
        <p className="text-gray-600 mt-1">
          Manage tests sent to external laboratories
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Lab Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Lab
            </label>
            <select
              value={selectedLab}
              onChange={(e) => setSelectedLab(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Labs</option>
              {labsList.map(lab => (
                <option key={lab.id} value={lab.id}>{lab.name}</option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div className="min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* To Date */}
          <div className="min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={() => {
              setFromDate('');
              setToDate('');
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Clear Dates
          </button>

          <button
            onClick={fetchQueue}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedItems.size > 0 && activeTab === 'pending_send' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-900">
                {selectedItems.size} test(s) selected
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedItems(new Set())}
                className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors border border-gray-300"
              >
                Clear Selection
              </button>
              <button
                onClick={handleBulkDispatch}
                disabled={dispatching}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {dispatching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Dispatching...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Dispatch Selected
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <TabButton
          value="pending_send"
          label="Pending Dispatch"
          count={queueItems.filter(i => i.outsourced_status === 'pending_send').length}
        />
        <TabButton
          value="sent"
          label="In Transit"
          count={queueItems.filter(i => i.outsourced_status === 'sent').length}
        />
        <TabButton
          value="awaiting_report"
          label="Awaiting Report"
          count={queueItems.filter(i => 
            i.outsourced_status === 'awaiting_report' || i.outsourced_status === 'sent'
          ).length}
        />
        <TabButton
          value="overdue"
          label="Overdue"
          count={queueItems.filter(i => {
            if (!i.outsourced_tat_estimate) return false;
            return new Date(i.outsourced_tat_estimate) < new Date();
          }).length}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Outsourced</p>
              <p className="text-2xl font-bold text-gray-900">{queueItems.length}</p>
            </div>
            <TestTube className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Dispatch</p>
              <p className="text-2xl font-bold text-yellow-600">
                {queueItems.filter(i => i.outsourced_status === 'pending_send').length}
              </p>
            </div>
            <Package className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">In Transit</p>
              <p className="text-2xl font-bold text-blue-600">
                {queueItems.filter(i => i.outsourced_status === 'sent').length}
              </p>
            </div>
            <Truck className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Awaiting Report</p>
              <p className="text-2xl font-bold text-purple-600">
                {queueItems.filter(i => 
                  i.outsourced_status === 'awaiting_report' || i.outsourced_status === 'sent'
                ).length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-red-600">
                {queueItems.filter(i => {
                  if (!i.outsourced_tat_estimate) return false;
                  return new Date(i.outsourced_tat_estimate) < new Date();
                }).length}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Queue List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {queueItems.length === 0 ? (
          <div className="p-12 text-center">
            <TestTube className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No tests in queue</p>
            <p className="text-gray-400 text-sm mt-2">
              Tests will appear here when marked for outsourcing
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {activeTab === 'pending_send' && (
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={toggleSelectAll}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        {selectedItems.size === queueItems.length && queueItems.length > 0 ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order / Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Test
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Outsourced To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    TAT
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {queueItems.map((item) => {
                  const daysUntilTAT = getDaysUntilTAT(item.outsourced_tat_estimate);
                  const isOverdue = daysUntilTAT < 0;

                  return (
                    <tr key={item.result_id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''} ${
                      selectedItems.has(item.result_id) ? 'bg-blue-50' : ''
                    }`}>
                      {activeTab === 'pending_send' && (
                        <td className="px-4 py-4">
                          <button
                            onClick={() => toggleSelectItem(item.result_id)}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            {selectedItems.has(item.result_id) ? (
                              <CheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Order #{item.order_number || item.order_id.slice(0, 8)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {item.patient_name}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">{item.test_name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center text-sm text-gray-900">
                          <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                          {item.outsourced_lab_name || 'Unknown Lab'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            item.outsourced_status === 'pending_send' ? 'bg-yellow-100 text-yellow-800' :
                            item.outsourced_status === 'sent' ? 'bg-blue-100 text-blue-800' :
                            item.outsourced_status === 'awaiting_report' ? 'bg-purple-100 text-purple-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {item.outsourced_status?.replace('_', ' ').toUpperCase()}
                          </span>
                          
                          {/* Logistics Status */}
                          {item.outsourced_logistics_status && (
                            <span className="text-xs text-gray-600 flex items-center gap-1">
                              <Truck className="w-3 h-3" />
                              {item.outsourced_logistics_status.replace(/_/g, ' ')}
                            </span>
                          )}
                          
                          {/* Tracking Barcode */}
                          {item.tracking_barcode && (
                            <div className="flex items-center text-xs text-gray-600">
                              <Barcode className="w-3 h-3 mr-1" />
                              {item.tracking_barcode}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.outsourced_tat_estimate ? (
                          <div className={`text-sm ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {isOverdue ? (
                                <span>{Math.abs(daysUntilTAT)} days overdue</span>
                              ) : (
                                <span>{daysUntilTAT} days remaining</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              Due: {new Date(item.outsourced_tat_estimate).toLocaleDateString()}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No TAT set</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePrintRequisition(item)}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="Print Requisition"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          
                          {/* In Transit - Show optional Mark as Received and Cancel */}
                          {item.outsourced_status === 'sent' && activeTab === 'sent' && (
                            <>
                              <button
                                onClick={() => handleMarkAsReceived(item.result_id)}
                                className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded hover:bg-green-200 flex items-center gap-1"
                                title="Optional: Track when received by lab"
                              >
                                <CheckCircle className="w-3 h-3" />
                                Mark Received
                              </button>
                              <button
                                onClick={() => handleCancelDispatch(item.result_id)}
                                className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200 flex items-center gap-1"
                                title="Cancel Dispatch"
                              >
                                <X className="w-3 h-3" />
                                Cancel
                              </button>
                            </>
                          )}

                          {/* Awaiting Report tab - Show logistics dropdown for all */}
                          {activeTab === 'awaiting_report' && (
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  const [status, label] = e.target.value.split('|');
                                  handleUpdateLogistics(item.result_id, status, label);
                                  e.target.value = ''; // Reset dropdown
                                }
                              }}
                              className="px-2 py-1 text-xs border border-gray-300 rounded hover:border-gray-400 focus:ring-2 focus:ring-blue-500"
                              title="Update logistics status (optional)"
                            >
                              <option value="">Update Status...</option>
                              <option value="delivered_to_lab|Received by Lab">✅ Received by Lab</option>
                              <option value="report_awaited|Report Awaited">📋 Report Awaited</option>
                            </select>
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
    </div>
  );
};

export default OutsourcedTestsQueue;
