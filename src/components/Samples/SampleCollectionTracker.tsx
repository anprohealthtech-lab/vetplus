// components/Samples/SampleCollectionTracker.tsx
// Track and manage sample collection status for an order

import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Clock, Loader, Printer } from 'lucide-react';
import { getSamplesForOrder, collectSample, Sample } from '../../services/sampleService';
import { SampleTypeIndicator } from '../Common/SampleTypeIndicator';
import { useAuth } from '../../contexts/AuthContext';
import { SampleLabelPrinter } from './SampleLabelPrinter';

interface SampleCollectionTrackerProps {
    orderId: string;
    onSampleCollected?: (sample: Sample) => void;
    showTitle?: boolean;
    collectedById?: string;
}

export const SampleCollectionTracker: React.FC<SampleCollectionTrackerProps> = ({
    orderId,
    onSampleCollected,
    showTitle = true,
    collectedById
}) => {
    const { user } = useAuth();
    const [samples, setSamples] = useState<Sample[]>([]);
    const [loading, setLoading] = useState(true);
    const [collectingId, setCollectingId] = useState<string | null>(null);
    const [printingSampleId, setPrintingSampleId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchSamples();
    }, [orderId]);

    const fetchSamples = async () => {
        try {
            setLoading(true);
            const data = await getSamplesForOrder(orderId);
            setSamples(data);
        } catch (err) {
            console.error('Error fetching samples:', err);
            setError('Failed to load samples');
        } finally {
            setLoading(false);
        }
    };

    const handleCollect = async (sampleId: string) => {
        const collectorId = collectedById || user?.id;

        if (!collectorId) {
            alert('User not authenticated');
            return;
        }

        try {
            setCollectingId(sampleId);
            setError(null);

            await collectSample(sampleId, collectorId);

            // Refresh samples
            await fetchSamples();

            // Notify parent
            const collectedSample = samples.find(s => s.id === sampleId);
            if (collectedSample && onSampleCollected) {
                onSampleCollected({ ...collectedSample, status: 'collected' });
            }
        } catch (err: any) {
            console.error('Error collecting sample:', err);
            setError(err.message || 'Failed to mark sample as collected');
        } finally {
            setCollectingId(null);
        }
    };

    const getStatusBadge = (status: Sample['status']) => {
        switch (status) {
            case 'created':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                        <Clock className="h-3 w-3" />
                        Pending
                    </span>
                );
            case 'collected':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                        <CheckCircle className="h-3 w-3" />
                        Collected
                    </span>
                );
            case 'received':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                        <CheckCircle className="h-3 w-3" />
                        Received
                    </span>
                );
            case 'processing':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                        <Loader className="h-3 w-3 animate-spin" />
                        Processing
                    </span>
                );
            case 'rejected':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                        <AlertCircle className="h-3 w-3" />
                        Rejected
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                        {status}
                    </span>
                );
        }
    };

    const allCollected = samples.length > 0 && samples.every(s =>
        ['collected', 'received', 'processing', 'processed'].includes(s.status)
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader className="h-6 w-6 text-blue-600 animate-spin" />
                <span className="ml-2 text-sm text-gray-600">Loading samples...</span>
            </div>
        );
    }

    if (samples.length === 0) {
        return (
            <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600">No samples required for this order</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {showTitle && (
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">
                        Sample Collection ({samples.filter(s => s.status === 'collected').length}/{samples.length})
                    </h3>
                    {allCollected && (
                        <span className="text-xs font-medium text-green-600">
                            ✓ All samples collected
                        </span>
                    )}
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="space-y-2">
                {samples.map((sample) => (
                    <div key={sample.id} className="flex flex-col gap-1">
                        <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                            {/* Sample Type Indicator */}
                            <div className="flex-shrink-0">
                                <SampleTypeIndicator
                                    sampleType={sample.sample_type}
                                    size="md"
                                    showLabel={false}
                                />
                            </div>

                            {/* Sample Info */}
                            <div className="flex-1 min-w-0">
                                <div className="font-mono font-bold text-sm text-gray-900 truncate">
                                    {sample.id}
                                </div>
                                <div className="text-xs text-gray-600">
                                    {sample.sample_type} • {sample.container_type}
                                </div>
                            </div>

                            {/* Status Badge */}
                            <div className="flex-shrink-0">
                                {getStatusBadge(sample.status)}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex-shrink-0 flex items-center gap-2">
                                {/* Print Label Button */}
                                <button
                                    onClick={() => setPrintingSampleId(printingSampleId === sample.id ? null : sample.id)}
                                    className={`p-1.5 rounded-lg transition-colors ${printingSampleId === sample.id
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'text-gray-500 hover:bg-gray-100'
                                        }`}
                                    title="Print Label"
                                >
                                    <Printer className="h-4 w-4" />
                                </button>

                                {sample.status === 'created' ? (
                                    <button
                                        onClick={() => handleCollect(sample.id)}
                                        disabled={collectingId === sample.id}
                                        className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {collectingId === sample.id ? (
                                            <span className="flex items-center gap-1">
                                                <Loader className="h-3 w-3 animate-spin" />
                                                Collecting...
                                            </span>
                                        ) : (
                                            'Mark Collected'
                                        )}
                                    </button>
                                ) : (
                                    <span className="text-xs text-gray-400 font-medium px-2">
                                        {new Date(sample.collected_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Label Printer Expansion */}
                        {printingSampleId === sample.id && (
                            <div className="pl-4 pr-1 pb-2 animate-in slide-in-from-top-2 duration-200">
                                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                    <SampleLabelPrinter sample={sample} />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Collection Instructions */}
            {
                !allCollected && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs text-blue-800">
                            💡 <strong>Tip:</strong> Collect samples in the order shown. Each sample type requires a different container.
                        </p>
                    </div>
                )
            }
        </div >
    );
};

export default SampleCollectionTracker;
