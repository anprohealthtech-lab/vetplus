// src/components/WhatsApp/MessageHistory.tsx
import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  FileText, 
  Image, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Filter,
  Phone
} from 'lucide-react';
import { WhatsAppAPI, MessageHistoryItem, MessageFilters } from '../../utils/whatsappAPI';

const MessageHistory: React.FC = () => {
  const [messages, setMessages] = useState<MessageHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<MessageFilters>({
    limit: 50
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchMessageHistory();
  }, [filters]);

  const fetchMessageHistory = async () => {
    setLoading(true);
    try {
      const history = await WhatsAppAPI.getMessageHistory(filters);
      setMessages(history);
    } catch (error) {
      console.error('Failed to fetch message history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'read':
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return 'border-green-200 bg-green-50';
      case 'read':
        return 'border-blue-200 bg-blue-50';
      case 'failed':
        return 'border-red-200 bg-red-50';
      case 'pending':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'document':
        return <FileText className="h-4 w-4 text-blue-600" />;
      case 'image':
        return <Image className="h-4 w-4 text-green-600" />;
      case 'text':
      default:
        return <MessageSquare className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return 'Today ' + date.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (days === 1) {
      return 'Yesterday ' + date.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString('en-IN');
    }
  };

  const handleFilterChange = (key: keyof MessageFilters, value: string | number) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined
    }));
  };

  const clearFilters = () => {
    setFilters({ limit: 50 });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <MessageSquare className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Message History</h2>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                showFilters 
                  ? 'border-blue-500 bg-blue-50 text-blue-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
            
            <button
              onClick={fetchMessageHistory}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="delivered">Delivered</option>
                <option value="read">Read</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message Type
              </label>
              <select
                value={filters.messageType || ''}
                onChange={(e) => handleFilterChange('messageType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Types</option>
                <option value="text">Text</option>
                <option value="document">Document</option>
                <option value="image">Image</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          
          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Showing last {filters.limit || 50} messages
            </div>
            
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Message List */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-4 animate-spin" />
            <p className="text-gray-600">Loading message history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Messages Found</h3>
            <p className="text-gray-600">
              {Object.keys(filters).length > 1 
                ? 'No messages match your current filters.' 
                : 'No WhatsApp messages have been sent yet.'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`border rounded-lg p-4 transition-colors ${getStatusColor(message.status)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="flex-shrink-0 mt-1">
                      {getMessageTypeIcon(message.message_type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {/* Recipient and Status */}
                      <div className="flex items-center space-x-2 mb-2">
                        <Phone className="h-3 w-3 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900">
                          +{message.to_number}
                        </span>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(message.status)}
                          <span className="text-xs text-gray-600 capitalize">
                            {message.status}
                          </span>
                        </div>
                      </div>
                      
                      {/* Patient/Test Info */}
                      {(message.patient_name || message.test_name) && (
                        <div className="flex items-center space-x-4 mb-2 text-sm text-gray-600">
                          {message.patient_name && (
                            <span>Patient: {message.patient_name}</span>
                          )}
                          {message.test_name && (
                            <span>Test: {message.test_name}</span>
                          )}
                        </div>
                      )}
                      
                      {/* Message Content */}
                      <div className="text-sm text-gray-900">
                        {message.message_text ? (
                          <p className="whitespace-pre-wrap">{message.message_text}</p>
                        ) : message.message_type === 'document' ? (
                          <div className="flex items-center space-x-2 text-blue-600">
                            <FileText className="h-4 w-4" />
                            <span>{message.file_name || 'Document'}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500 italic">
                            {message.message_type} message
                          </span>
                        )}
                      </div>
                      
                      {/* Timestamps */}
                      <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>Sent: {formatTimestamp(message.created_at)}</span>
                        </div>
                        
                        {message.delivered_at && (
                          <div className="flex items-center space-x-1">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span>Delivered: {formatTimestamp(message.delivered_at)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Load More */}
      {messages.length >= (filters.limit || 50) && (
        <div className="px-6 pb-6">
          <button
            onClick={() => handleFilterChange('limit', (filters.limit || 50) + 50)}
            disabled={loading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Load More Messages
          </button>
        </div>
      )}
    </div>
  );
};

export default MessageHistory;