// src/components/WhatsApp/QueueManagement.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Trash2, Clock, AlertCircle, CheckCircle, Loader, FileText, Bell } from 'lucide-react';
import { supabase, database } from '../../utils/supabase';

interface PdfQueueItem {
    id: string;
    order_id: string;
    lab_id: string;
    status: string;
    error_message?: string;
    created_at: string;
    updated_at: string;
}

interface NotificationQueueItem {
    id: string;
    lab_id: string;
    recipient_type: string;
    recipient_phone: string;
    recipient_name?: string;
    trigger_type: string;
    status: string;
    last_error?: string;
    retry_count: number;
    created_at: string;
    updated_at: string;
}

const QueueManagement: React.FC = () => {
    const [pdfQueue, setPdfQueue] = useState<PdfQueueItem[]>([]);
    const [notificationQueue, setNotificationQueue] = useState<NotificationQueueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [labId, setLabId] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'pdf' | 'notification'; id: string } | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchQueues = useCallback(async () => {
        if (!labId) return;

        setLoading(true);
        try {
            // Fetch PDF Queue
            const { data: pdfData, error: pdfError } = await supabase
                .from('pdf_generation_queue')
                .select('*')
                .eq('lab_id', labId)
                .order('updated_at', { ascending: false })
                .limit(50);

            if (pdfError) console.error('Error fetching PDF queue:', pdfError);
            else setPdfQueue(pdfData || []);

            // Fetch Notification Queue
            const { data: notifData, error: notifError } = await supabase
                .from('notification_queue')
                .select('*')
                .eq('lab_id', labId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (notifError) console.error('Error fetching notification queue:', notifError);
            else setNotificationQueue(notifData || []);
        } catch (err) {
            console.error('Error fetching queues:', err);
        } finally {
            setLoading(false);
        }
    }, [labId]);

    useEffect(() => {
        database.getCurrentUserLabId().then(id => setLabId(id));
    }, []);

    useEffect(() => {
        if (labId) fetchQueues();
    }, [labId, fetchQueues]);

    const handleDelete = async () => {
        if (!deleteConfirm) return;

        setDeleting(true);
        try {
            const table = deleteConfirm.type === 'pdf' ? 'pdf_generation_queue' : 'notification_queue';
            const { error } = await supabase
                .from(table)
                .delete()
                .eq('id', deleteConfirm.id);

            if (error) throw error;

            // Refresh the list
            await fetchQueues();
            setDeleteConfirm(null);
        } catch (err) {
            console.error('Error deleting:', err);
            alert('Failed to delete. Please try again.');
        } finally {
            setDeleting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pending: 'bg-yellow-100 text-yellow-800',
            processing: 'bg-blue-100 text-blue-800',
            completed: 'bg-green-100 text-green-800',
            failed: 'bg-red-100 text-red-800',
            sent: 'bg-green-100 text-green-800',
        };

        const icons: Record<string, React.ReactNode> = {
            pending: <Clock className="w-3 h-3" />,
            processing: <Loader className="w-3 h-3 animate-spin" />,
            completed: <CheckCircle className="w-3 h-3" />,
            failed: <AlertCircle className="w-3 h-3" />,
            sent: <CheckCircle className="w-3 h-3" />,
        };

        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
                {icons[status]}
                {status}
            </span>
        );
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return date.toLocaleDateString();
    };

    const canDelete = (status: string) => {
        return ['pending', 'processing', 'failed'].includes(status);
    };

    if (loading && !pdfQueue.length && !notificationQueue.length) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* PDF Queue Section */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <h3 className="font-semibold text-gray-900">PDF Generation Queue</h3>
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                            {pdfQueue.length}
                        </span>
                    </div>
                    <button
                        onClick={fetchQueues}
                        disabled={loading}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {pdfQueue.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>No PDF jobs in queue</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                                <tr>
                                    <th className="px-4 py-2 text-left">Order ID</th>
                                    <th className="px-4 py-2 text-left">Status</th>
                                    <th className="px-4 py-2 text-left">Updated</th>
                                    <th className="px-4 py-2 text-left">Error</th>
                                    <th className="px-4 py-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {pdfQueue.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm font-mono text-gray-900">
                                            {item.order_id.slice(0, 8)}...
                                        </td>
                                        <td className="px-4 py-3">
                                            {getStatusBadge(item.status)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            {formatTime(item.updated_at)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-red-600 max-w-xs truncate">
                                            {item.error_message || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {canDelete(item.status) && (
                                                <button
                                                    onClick={() => setDeleteConfirm({ type: 'pdf', id: item.id })}
                                                    className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Notification Queue Section */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                    <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-green-600" />
                        <h3 className="font-semibold text-gray-900">Notification Queue</h3>
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                            {notificationQueue.length}
                        </span>
                    </div>
                    <button
                        onClick={fetchQueues}
                        disabled={loading}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {notificationQueue.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>No notifications in queue</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                                <tr>
                                    <th className="px-4 py-2 text-left">Recipient</th>
                                    <th className="px-4 py-2 text-left">Type</th>
                                    <th className="px-4 py-2 text-left">Status</th>
                                    <th className="px-4 py-2 text-left">Created</th>
                                    <th className="px-4 py-2 text-left">Error</th>
                                    <th className="px-4 py-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {notificationQueue.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm">
                                            <div className="font-medium text-gray-900">{item.recipient_name || 'Unknown'}</div>
                                            <div className="text-gray-500 text-xs">{item.recipient_phone}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-1 rounded ${item.recipient_type === 'patient' ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800'
                                                }`}>
                                                {item.recipient_type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {getStatusBadge(item.status)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            {formatTime(item.created_at)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-red-600 max-w-xs truncate">
                                            {item.last_error || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {canDelete(item.status) && (
                                                <button
                                                    onClick={() => setDeleteConfirm({ type: 'notification', id: item.id })}
                                                    className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-red-100 p-2 rounded-full">
                                <Trash2 className="w-5 h-5 text-red-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900">Delete Queue Entry</h3>
                        </div>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete this {deleteConfirm.type === 'pdf' ? 'PDF job' : 'notification'}?
                            This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                disabled={deleting}
                                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                            >
                                {deleting && <Loader className="w-4 h-4 animate-spin" />}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QueueManagement;
