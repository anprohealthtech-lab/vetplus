/**
 * PatientSummaryModal - A modal for displaying and managing patient-friendly summaries
 * Supports multiple Indian languages with medical terms in English
 */

import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import {
    AlertTriangle,
    CheckCircle2,
    Copy,
    Edit,
    Loader2,
    MessageSquare,
    Save,
    User,
    X,
    Heart
} from 'lucide-react';
import {
    type PatientSummaryResponse,
    type SupportedLanguage,
    LANGUAGE_DISPLAY_NAMES
} from '../../hooks/useAIResultIntelligence';

interface PatientSummaryModalProps {
    orderId: string;
    patientName?: string;
    referringDoctor?: string;
    summary: PatientSummaryResponse | null;
    isGenerating: boolean;
    onClose: () => void;
    onRegenerate?: (language: SupportedLanguage) => void;
    onSave?: (orderId: string, summary: PatientSummaryResponse) => Promise<void>;
    onSendWhatsApp?: (orderId: string, summary: PatientSummaryResponse) => void;
    onIncludeInPdf?: (orderId: string, include: boolean) => void;
}

const PatientSummaryModal: React.FC<PatientSummaryModalProps> = ({
    orderId,
    patientName,
    referringDoctor,
    summary,
    isGenerating,
    onClose,
    onRegenerate,
    onSave,
    onSendWhatsApp,
    onIncludeInPdf
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedSummary, setEditedSummary] = useState<PatientSummaryResponse | null>(summary);
    const [saving, setSaving] = useState(false);
    const [includeInPdf, setIncludeInPdf] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(summary?.language as SupportedLanguage || 'english');
    const [copied, setCopied] = useState(false);

    // Update editedSummary when summary prop changes
    React.useEffect(() => {
        if (summary) {
            setEditedSummary({ ...summary });
            setSelectedLanguage(summary.language as SupportedLanguage || 'english');
        }
    }, [summary]);

    if (isGenerating) {
        return ReactDOM.createPortal(
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 text-center">
                    <Loader2 className="h-12 w-12 text-pink-600 animate-spin mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Generating Patient Summary</h3>
                    <p className="text-gray-600">
                        Creating a patient-friendly summary in {LANGUAGE_DISPLAY_NAMES[selectedLanguage]}...
                    </p>
                    <p className="text-sm text-gray-500 mt-2">Medical terms will be kept in English for clarity.</p>
                </div>
            </div>,
            document.body
        );
    }

    if (!summary || !editedSummary) {
        return null;
    }

    const handleSave = async () => {
        if (!editedSummary || !onSave) return;
        setSaving(true);
        try {
            await onSave(orderId, editedSummary);
            setIsEditing(false);
            alert('Patient summary saved successfully!');
        } catch (error) {
            console.error('Failed to save patient summary:', error);
            alert('Failed to save patient summary');
        } finally {
            setSaving(false);
        }
    };

    const handleCopyToClipboard = () => {
        const text = formatSummaryForWhatsApp(editedSummary);
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSendWhatsApp = () => {
        if (onSendWhatsApp && editedSummary) {
            onSendWhatsApp(orderId, editedSummary);
        }
    };

    const handleIncludeInPdf = (include: boolean) => {
        setIncludeInPdf(include);
        if (onIncludeInPdf) {
            onIncludeInPdf(orderId, include);
        }
    };

    // Format summary for WhatsApp
    const formatSummaryForWhatsApp = (s: PatientSummaryResponse): string => {
        let text = `🏥 *Your Health Report Summary*\n\n`;
        text += `📋 *Health Status:*\n${s.health_status}\n\n`;

        if (s.normal_findings_summary) {
            text += `✅ *Normal Findings:*\n${s.normal_findings_summary}\n\n`;
        }

        if (s.abnormal_findings && s.abnormal_findings.length > 0) {
            text += `⚠️ *Findings Requiring Attention:*\n`;
            s.abnormal_findings.forEach(f => {
                const statusEmoji = f.status === 'high' ? '📈' : f.status === 'low' ? '📉' : '⚠️';
                text += `${statusEmoji} *${f.test_name}:* ${f.value}\n   ${f.explanation}\n`;
            });
            text += '\n';
        }

        if (s.needs_consultation && s.consultation_message) {
            text += `👨‍⚕️ *Recommendation:*\n${s.consultation_message}\n\n`;
        }

        if (s.health_tips && s.health_tips.length > 0) {
            text += `💡 *Health Tips:*\n`;
            s.health_tips.forEach((tip, i) => {
                text += `${i + 1}. ${tip}\n`;
            });
        }

        return text;
    };

    const displaySummary = isEditing ? editedSummary : summary;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-pink-600 to-rose-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <User className="h-6 w-6 text-white" />
                        <div>
                            <h3 className="text-xl font-bold text-white">Patient Summary</h3>
                            {patientName && (
                                <p className="text-sm text-pink-200">For: {patientName}</p>
                            )}
                        </div>
                        <span className="ml-2 px-2 py-1 bg-white bg-opacity-20 text-white text-xs rounded-full font-medium">
                            {LANGUAGE_DISPLAY_NAMES[selectedLanguage]}
                        </span>
                    </div>
                    <div className="flex items-center space-x-2">
                        {/* Language selector for regenerate */}
                        {onRegenerate && (
                            <select
                                value={selectedLanguage}
                                onChange={(e) => {
                                    const lang = e.target.value as SupportedLanguage;
                                    setSelectedLanguage(lang);
                                    onRegenerate(lang);
                                }}
                                className="bg-white bg-opacity-20 text-white text-sm rounded-lg px-3 py-1.5 border border-white border-opacity-30 focus:outline-none"
                            >
                                {Object.entries(LANGUAGE_DISPLAY_NAMES).map(([key, label]) => (
                                    <option key={key} value={key} className="text-gray-900">{label}</option>
                                ))}
                            </select>
                        )}
                        <button
                            onClick={onClose}
                            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-280px)]">
                    <div className="space-y-6">
                        {/* Health Status */}
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                            <div className="flex items-center space-x-2 mb-2">
                                <Heart className="h-5 w-5 text-green-600" />
                                <h4 className="text-lg font-semibold text-green-900">Health Status</h4>
                            </div>
                            {isEditing ? (
                                <textarea
                                    value={editedSummary.health_status}
                                    onChange={(e) => setEditedSummary({ ...editedSummary, health_status: e.target.value })}
                                    className="w-full p-3 border border-green-300 rounded-lg text-green-800 bg-white min-h-[80px]"
                                />
                            ) : (
                                <p className="text-green-800">{displaySummary.health_status}</p>
                            )}
                        </div>

                        {/* Normal Findings */}
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                            <div className="flex items-center space-x-2 mb-2">
                                <CheckCircle2 className="h-5 w-5 text-blue-600" />
                                <h4 className="text-lg font-semibold text-blue-900">Normal Findings</h4>
                            </div>
                            {isEditing ? (
                                <textarea
                                    value={editedSummary.normal_findings_summary}
                                    onChange={(e) => setEditedSummary({ ...editedSummary, normal_findings_summary: e.target.value })}
                                    className="w-full p-3 border border-blue-300 rounded-lg text-blue-800 bg-white min-h-[60px]"
                                />
                            ) : (
                                <p className="text-blue-800">{displaySummary.normal_findings_summary}</p>
                            )}
                        </div>

                        {/* Abnormal Findings */}
                        {displaySummary.abnormal_findings && displaySummary.abnormal_findings.length > 0 && (
                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center space-x-2">
                                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                                        <h4 className="text-lg font-semibold text-amber-900">Findings Requiring Attention</h4>
                                    </div>
                                    {isEditing && (
                                        <button
                                            onClick={() => {
                                                const newFinding = {
                                                    test_name: 'New Finding',
                                                    value: '',
                                                    status: 'abnormal' as const,
                                                    explanation: ''
                                                };
                                                setEditedSummary({
                                                    ...editedSummary,
                                                    abnormal_findings: [...(editedSummary.abnormal_findings || []), newFinding]
                                                });
                                            }}
                                            className="text-sm px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                                        >
                                            + Add Finding
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    {(isEditing ? editedSummary.abnormal_findings : displaySummary.abnormal_findings)?.map((finding, idx) => (
                                        <div key={idx} className="bg-white rounded-lg p-3 border border-amber-200">
                                            {isEditing ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <input
                                                            type="text"
                                                            value={finding.test_name || ''}
                                                            onChange={(e) => {
                                                                const updated = [...(editedSummary.abnormal_findings || [])];
                                                                updated[idx] = { ...updated[idx], test_name: e.target.value };
                                                                setEditedSummary({ ...editedSummary, abnormal_findings: updated });
                                                            }}
                                                            className="flex-1 px-2 py-1 border border-amber-300 rounded font-semibold text-amber-900"
                                                            placeholder="Test Name"
                                                        />
                                                        <select
                                                            value={finding.status || 'abnormal'}
                                                            onChange={(e) => {
                                                                const updated = [...(editedSummary.abnormal_findings || [])];
                                                                updated[idx] = { ...updated[idx], status: e.target.value as 'high' | 'low' | 'abnormal' };
                                                                setEditedSummary({ ...editedSummary, abnormal_findings: updated });
                                                            }}
                                                            className="px-2 py-1 border border-amber-300 rounded text-sm"
                                                        >
                                                            <option value="high">↑ High</option>
                                                            <option value="low">↓ Low</option>
                                                            <option value="abnormal">Abnormal</option>
                                                        </select>
                                                        <button
                                                            onClick={() => {
                                                                const updated = (editedSummary.abnormal_findings || []).filter((_, i) => i !== idx);
                                                                setEditedSummary({ ...editedSummary, abnormal_findings: updated });
                                                            }}
                                                            className="text-red-500 hover:text-red-700 p-1"
                                                            title="Remove finding"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={finding.value || ''}
                                                        onChange={(e) => {
                                                            const updated = [...(editedSummary.abnormal_findings || [])];
                                                            updated[idx] = { ...updated[idx], value: e.target.value };
                                                            setEditedSummary({ ...editedSummary, abnormal_findings: updated });
                                                        }}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-600"
                                                        placeholder="Value (e.g., 2 Index)"
                                                    />
                                                    <textarea
                                                        value={finding.explanation || ''}
                                                        onChange={(e) => {
                                                            const updated = [...(editedSummary.abnormal_findings || [])];
                                                            updated[idx] = { ...updated[idx], explanation: e.target.value };
                                                            setEditedSummary({ ...editedSummary, abnormal_findings: updated });
                                                        }}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-amber-800 min-h-[60px]"
                                                        placeholder="Explanation for patient"
                                                    />
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-semibold text-amber-900">{finding.test_name}</span>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${finding.status === 'high' ? 'bg-red-100 text-red-700' :
                                                            finding.status === 'low' ? 'bg-blue-100 text-blue-700' :
                                                                'bg-amber-100 text-amber-700'
                                                            }`}>
                                                            {finding.status === 'high' ? '↑ High' : finding.status === 'low' ? '↓ Low' : 'Abnormal'}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-600 mb-1">Value: {finding.value}</p>
                                                    <p className="text-sm text-amber-800">{finding.explanation}</p>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Consultation Recommendation */}
                        {displaySummary.needs_consultation && displaySummary.consultation_message && (
                            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                                <div className="flex items-center space-x-2 mb-2">
                                    <User className="h-5 w-5 text-purple-600" />
                                    <h4 className="text-lg font-semibold text-purple-900">
                                        Doctor Consultation
                                        {referringDoctor && <span className="font-normal text-purple-700"> - {referringDoctor}</span>}
                                    </h4>
                                </div>
                                {isEditing ? (
                                    <textarea
                                        value={editedSummary.consultation_message}
                                        onChange={(e) => setEditedSummary({ ...editedSummary, consultation_message: e.target.value })}
                                        className="w-full p-3 border border-purple-300 rounded-lg text-purple-800 bg-white min-h-[60px]"
                                    />
                                ) : (
                                    <p className="text-purple-800">{displaySummary.consultation_message}</p>
                                )}
                            </div>
                        )}

                        {/* Health Tips */}
                        {displaySummary.health_tips && displaySummary.health_tips.length > 0 && (
                            <div className="bg-teal-50 rounded-xl p-4 border border-teal-200">
                                <div className="flex items-center space-x-2 mb-3">
                                    <Heart className="h-5 w-5 text-teal-600" />
                                    <h4 className="text-lg font-semibold text-teal-900">Health Tips</h4>
                                </div>
                                <ul className="space-y-2">
                                    {displaySummary.health_tips.map((tip, idx) => (
                                        <li key={idx} className="flex items-start space-x-2">
                                            <span className="text-teal-600 font-semibold">{idx + 1}.</span>
                                            <span className="text-teal-800">{tip}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t bg-gray-50 px-6 py-4">
                    <div className="space-y-4">
                        {/* Options */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={includeInPdf}
                                    onChange={(e) => handleIncludeInPdf(e.target.checked)}
                                    className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
                                />
                                <span className="text-sm text-gray-700">Include in PDF report</span>
                            </label>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {!isEditing ? (
                                    <>
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="inline-flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                        >
                                            <Edit className="h-4 w-4 mr-2" />
                                            Edit
                                        </button>
                                        <button
                                            onClick={handleCopyToClipboard}
                                            className="inline-flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                        >
                                            {copied ? <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" /> : <Copy className="h-4 w-4 mr-2" />}
                                            {copied ? 'Copied!' : 'Copy'}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => {
                                                setIsEditing(false);
                                                setEditedSummary(summary ? { ...summary } : null);
                                            }}
                                            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
                                        >
                                            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                            Save
                                        </button>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={onClose}
                                    disabled={saving}
                                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Close
                                </button>
                                {onSendWhatsApp && !isEditing && (
                                    <button
                                        onClick={handleSendWhatsApp}
                                        className="inline-flex items-center px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700"
                                    >
                                        <MessageSquare className="h-5 w-5 mr-2" />
                                        Send WhatsApp
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PatientSummaryModal;
