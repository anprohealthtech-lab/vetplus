import React, { useEffect, useState, useCallback } from 'react';
import { database } from '../utils/supabase';
import {
  FileText,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Eye,
  Download,
  Calendar,
  Search,
  Filter,
  Link as LinkIcon,
  X,
  TrendingUp,
  Clock,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import type { OutsourcedReport, OrderMatchSuggestion } from '../types';

type StatusFilter = 'all' | 'pending_processing' | 'processed' | 'verified';
type MatchFilter = 'all' | 'matched' | 'unmatched';

const OutsourcedReportsConsoleEnhanced: React.FC = () => {
  const [reports, setReports] = useState<OutsourcedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<OutsourcedReport | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchSuggestions, setMatchSuggestions] = useState<OrderMatchSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);

  useEffect(() => {
    fetchReports();
  }, [statusFilter, matchFilter, dateRange]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    
    const filters: any = {};
    if (statusFilter !== 'all') filters.status = statusFilter;
    if (matchFilter !== 'all') filters.matched = matchFilter;
    if (dateRange) filters.dateRange = dateRange;

    const { data, error } = await database.outsourcedReports.getAll(filters);

    if (error) {
      console.error('Error fetching reports:', error);
      alert('Failed to load reports');
    } else {
      setReports(data || []);
    }
    setLoading(false);
  }, [statusFilter, matchFilter, dateRange]);

  const handleSmartMatch = async (report: OutsourcedReport) => {
    setSelectedReport(report);
    setShowMatchModal(true);
    setLoadingSuggestions(true);

    const { data, error } = await database.outsourcedReports.suggestMatches(report.id, 5);

    if (error) {
      console.error('Error getting match suggestions:', error);
      alert('Failed to load match suggestions');
      setMatchSuggestions([]);
    } else {
      setMatchSuggestions(data || []);
    }
    setLoadingSuggestions(false);
  };

  const handleLinkToOrder = async (orderId: string, patientId: string, confidence: number) => {
    if (!selectedReport) return;

    const confirmed = window.confirm(
      `Link this outsourced report to the selected order?\n\nConfidence: ${(confidence * 100).toFixed(0)}%`
    );

    if (!confirmed) return;

    const { error } = await database.outsourcedReports.linkToOrder(
      selectedReport.id,
      orderId,
      patientId,
      confidence
    );

    if (error) {
      console.error('Error linking report:', error);
      alert('Failed to link report to order');
    } else {
      alert('Report successfully linked to order!');
      setShowMatchModal(false);
      fetchReports();
    }
  };

  const handleViewReport = (report: OutsourcedReport) => {
    setSelectedReport(report);
    setShowModal(true);
  };

  const filteredReports = reports.filter(report => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    return (
      report.sender_email?.toLowerCase().includes(search) ||
      report.subject?.toLowerCase().includes(search) ||
      report.file_name?.toLowerCase().includes(search) ||
      report.ai_extracted_data?.patient_name?.toLowerCase().includes(search)
    );
  });

  const StatusBadge = ({ status }: { status: string }) => {
    const styles = {
      pending_processing: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      processing: 'bg-blue-100 text-blue-800 border-blue-300',
      processed: 'bg-green-100 text-green-800 border-green-300',
      verified: 'bg-purple-100 text-purple-800 border-purple-300',
      failed: 'bg-red-100 text-red-800 border-red-300'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${styles[status as keyof typeof styles]}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  const ConfidenceBadge = ({ confidence }: { confidence: number }) => {
    const percent = (confidence * 100).toFixed(0);
    const color = confidence >= 0.8 ? 'green' : confidence >= 0.5 ? 'yellow' : 'red';
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${color}-100 text-${color}-800`}>
        {percent}% match
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading reports...</span>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-8 h-8" />
          Outsourced Reports Console
        </h1>
        <p className="text-gray-600 mt-1">
          Manage and match incoming reports from external laboratories
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[250px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by email, subject, patient name..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="pending_processing">Pending Processing</option>
              <option value="processed">Processed</option>
              <option value="verified">Verified</option>
            </select>
          </div>

          {/* Match Filter */}
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Match Status
            </label>
            <select
              value={matchFilter}
              onChange={(e) => setMatchFilter(e.target.value as MatchFilter)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Reports</option>
              <option value="matched">Matched to Order</option>
              <option value="unmatched">Unmatched</option>
            </select>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchReports}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Reports</p>
              <p className="text-2xl font-bold text-gray-900">{reports.length}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Processing</p>
              <p className="text-2xl font-bold text-yellow-600">
                {reports.filter(r => r.status === 'pending_processing').length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Unmatched</p>
              <p className="text-2xl font-bold text-orange-600">
                {reports.filter(r => !r.order_id).length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Verified</p>
              <p className="text-2xl font-bold text-green-600">
                {reports.filter(r => r.status === 'verified').length}
              </p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {filteredReports.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No reports found</p>
            <p className="text-gray-400 text-sm mt-2">
              {searchTerm ? 'Try adjusting your search or filters' : 'Reports will appear here when received'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Received
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    From / Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient / Test
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Match
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                        {new Date(report.received_at).toLocaleDateString()}
                        <br />
                        <span className="text-xs text-gray-500">
                          {new Date(report.received_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start">
                        <Mail className="w-4 h-4 mr-2 text-gray-400 mt-1" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {report.sender_email}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {report.subject || 'No subject'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p className="font-medium text-gray-900">
                          {report.ai_extracted_data?.patient_name || 'Not extracted'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {report.ai_extracted_data?.test_name || 'No test info'}
                        </p>
                        {report.ai_confidence && (
                          <p className="text-xs text-blue-600 mt-1">
                            AI: {(report.ai_confidence * 100).toFixed(0)}% confidence
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={report.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {report.order_id ? (
                        <div className="flex items-center text-sm text-green-600">
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Matched
                          {report.match_confidence && (
                            <span className="ml-2 text-xs">
                              ({(report.match_confidence * 100).toFixed(0)}%)
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center text-sm text-orange-600">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          Unmatched
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewReport(report)}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                          title="View Report"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <a
                          href={report.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-600 hover:text-gray-800 transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        {!report.order_id && report.status === 'processed' && (
                          <button
                            onClick={() => handleSmartMatch(report)}
                            className="text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-1"
                            title="Smart Match"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span className="text-xs">Match</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Modal */}
      {showModal && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Report Details</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6">
              {/* Report metadata */}
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">From</p>
                  <p className="text-lg font-medium">{selectedReport.sender_email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Received</p>
                  <p className="text-lg font-medium">
                    {new Date(selectedReport.received_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={selectedReport.status} />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600">File</p>
                  <p className="text-sm font-medium">{selectedReport.file_name}</p>
                </div>
              </div>

              {/* AI Extracted Data */}
              {selectedReport.ai_extracted_data && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-900 mb-3">AI Extracted Data</h3>
                  <pre className="text-sm text-blue-800 whitespace-pre-wrap">
                    {JSON.stringify(selectedReport.ai_extracted_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* PDF Viewer */}
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <iframe
                  src={selectedReport.file_url}
                  className="w-full h-[600px]"
                  title="Report Preview"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              {!selectedReport.order_id && selectedReport.status === 'processed' && (
                <button
                  onClick={() => {
                    setShowModal(false);
                    handleSmartMatch(selectedReport);
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Smart Match to Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Match Modal */}
      {showMatchModal && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-600" />
                Smart Match Suggestions
              </h2>
              <button
                onClick={() => setShowMatchModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {loadingSuggestions ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600 mr-2" />
                  <span className="text-gray-600">Analyzing and finding matches...</span>
                </div>
              ) : matchSuggestions.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg">No matching orders found</p>
                  <p className="text-gray-400 text-sm mt-2">
                    Try manually linking this report to an order
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-600 mb-4">
                    Found {matchSuggestions.length} potential matches for patient:{' '}
                    <span className="font-semibold">
                      {selectedReport.ai_extracted_data?.patient_name || 'Unknown'}
                    </span>
                  </p>

                  {matchSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.order_id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {suggestion.patient_name}
                            </h3>
                            <ConfidenceBadge confidence={suggestion.confidence} />
                          </div>
                          <p className="text-sm text-gray-600">
                            Order #{suggestion.order_number || suggestion.order_id.slice(0, 8)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Date: {new Date(suggestion.order_date).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleLinkToOrder(
                            suggestion.order_id,
                            suggestion.patient_id,
                            suggestion.confidence
                          )}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                        >
                          <LinkIcon className="w-4 h-4" />
                          Link
                        </button>
                      </div>

                      <div className="bg-gray-50 rounded p-3 mb-2">
                        <p className="text-xs font-semibold text-gray-700 mb-1">Match Reasons:</p>
                        <ul className="text-xs text-gray-600 space-y-1">
                          {suggestion.match_reasons.map((reason, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <CheckCircle2 className="w-3 h-3 text-green-600" />
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {suggestion.test_names && suggestion.test_names.length > 0 && (
                        <div className="text-xs text-gray-600">
                          <span className="font-semibold">Tests: </span>
                          {suggestion.test_names.slice(0, 3).join(', ')}
                          {suggestion.test_names.length > 3 && ` +${suggestion.test_names.length - 3} more`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowMatchModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutsourcedReportsConsoleEnhanced;
