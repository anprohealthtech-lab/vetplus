import React, { useState, useEffect } from 'react';
import {
    Bell,
    BellRing,
    MessageSquare,
    FileText,
    UserCheck,
    Clock,
    Save,
    Loader2,
    Check,
    AlertCircle,
    Settings,
    Send,
    Stethoscope
} from 'lucide-react';
import { notificationTriggerService, NotificationSettings } from '../../utils/notificationTriggerService';
import { database } from '../../utils/supabase';

interface ToggleSwitchProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    disabled?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ enabled, onChange, disabled }) => (
    <button
        type="button"
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled}
        className={`
      relative inline-flex h-6 w-11 items-center rounded-full
      transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
      ${enabled ? 'bg-blue-600' : 'bg-gray-300'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    `}
    >
        <span
            className={`
        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
        ${enabled ? 'translate-x-6' : 'translate-x-1'}
      `}
        />
    </button>
);

interface SettingRowProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    disabled?: boolean;
    children?: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({
    icon,
    title,
    description,
    enabled,
    onChange,
    disabled,
    children
}) => (
    <div className="py-4 border-b border-gray-100 last:border-b-0">
        <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
                <div className={`mt-0.5 ${enabled ? 'text-blue-600' : 'text-gray-400'}`}>
                    {icon}
                </div>
                <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900">{title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{description}</p>
                    {enabled && children && (
                        <div className="mt-3 pl-0 space-y-2">
                            {children}
                        </div>
                    )}
                </div>
            </div>
            <ToggleSwitch enabled={enabled} onChange={onChange} disabled={disabled} />
        </div>
    </div>
);

export const NotificationTriggerSettings: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [labId, setLabId] = useState<string | null>(null);

    const [settings, setSettings] = useState<Partial<NotificationSettings>>({
        auto_send_report_to_patient: false,
        auto_send_report_to_doctor: false,
        send_report_on_status: 'Completed',
        auto_send_invoice_to_patient: false,
        auto_send_registration_confirmation: false,
        include_test_details_in_registration: true,
        include_invoice_in_registration: true,
        default_patient_channel: 'whatsapp',
        send_window_start: '08:00:00',
        send_window_end: '21:00:00',
        queue_outside_window: true,
        max_messages_per_patient_per_day: 10,
    });

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        setError(null);

        try {
            const currentLabId = await database.getCurrentUserLabId();
            if (!currentLabId) {
                setError('Could not determine your lab. Please try again.');
                setLoading(false);
                return;
            }
            setLabId(currentLabId);

            const existingSettings = await notificationTriggerService.getSettings(currentLabId);
            if (existingSettings) {
                setSettings(existingSettings);
            }
        } catch (err) {
            console.error('Error loading notification settings:', err);
            setError('Failed to load notification settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!labId) return;

        setSaving(true);
        setError(null);

        try {
            const { error } = await notificationTriggerService.upsertSettings(labId, settings);

            if (error) {
                throw error;
            }

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error('Error saving notification settings:', err);
            setError('Failed to save settings. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const updateSetting = <K extends keyof NotificationSettings>(
        key: K,
        value: NotificationSettings[K]
    ) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading settings...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <BellRing className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Auto-Send Notifications</h2>
                        <p className="text-sm text-gray-500">
                            Configure automatic WhatsApp notifications for reports, invoices, and registrations
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`
            inline-flex items-center px-4 py-2 rounded-lg font-medium
            transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
            ${saving
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : saved
                                ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500'
                                : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                        }
          `}
                >
                    {saving ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                        </>
                    ) : saved ? (
                        <>
                            <Check className="h-4 w-4 mr-2" />
                            Saved!
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Settings
                        </>
                    )}
                </button>
            </div>

            {error && (
                <div className="flex items-center p-4 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                    <span className="text-sm text-red-700">{error}</span>
                </div>
            )}

            {/* Report Notifications */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center space-x-2 mb-4">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-medium text-gray-900">Report Notifications</h3>
                </div>

                <SettingRow
                    icon={<Send className="h-5 w-5" />}
                    title="Auto-send reports to patients"
                    description="Automatically send the report PDF to patients via WhatsApp when generated"
                    enabled={settings.auto_send_report_to_patient || false}
                    onChange={(v) => updateSetting('auto_send_report_to_patient', v)}
                />

                <SettingRow
                    icon={<Stethoscope className="h-5 w-5" />}
                    title="Auto-send reports to referring doctors"
                    description="Automatically notify referring doctors when patient reports are ready"
                    enabled={settings.auto_send_report_to_doctor || false}
                    onChange={(v) => updateSetting('auto_send_report_to_doctor', v)}
                />
            </div>

            {/* Invoice Notifications */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center space-x-2 mb-4">
                    <MessageSquare className="h-5 w-5 text-green-600" />
                    <h3 className="text-lg font-medium text-gray-900">Invoice Notifications</h3>
                </div>

                <SettingRow
                    icon={<FileText className="h-5 w-5" />}
                    title="Auto-send invoices to patients"
                    description="Automatically send the invoice PDF to patients when generated"
                    enabled={settings.auto_send_invoice_to_patient || false}
                    onChange={(v) => updateSetting('auto_send_invoice_to_patient', v)}
                />
            </div>

            {/* Registration Notifications */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center space-x-2 mb-4">
                    <UserCheck className="h-5 w-5 text-purple-600" />
                    <h3 className="text-lg font-medium text-gray-900">Registration Notifications</h3>
                </div>

                <SettingRow
                    icon={<Bell className="h-5 w-5" />}
                    title="Send registration confirmation"
                    description="Automatically send a confirmation message when a new order is registered"
                    enabled={settings.auto_send_registration_confirmation || false}
                    onChange={(v) => updateSetting('auto_send_registration_confirmation', v)}
                >
                    <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={settings.include_test_details_in_registration || false}
                                onChange={(e) => updateSetting('include_test_details_in_registration', e.target.checked)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-600">Include test details in message</span>
                        </label>
                    </div>
                </SettingRow>
            </div>

            {/* Timing Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center space-x-2 mb-4">
                    <Clock className="h-5 w-5 text-orange-600" />
                    <h3 className="text-lg font-medium text-gray-900">Timing & Delivery</h3>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Send Window Start
                            </label>
                            <input
                                type="time"
                                value={settings.send_window_start?.slice(0, 5) || '08:00'}
                                onChange={(e) => updateSetting('send_window_start', e.target.value + ':00')}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Send Window End
                            </label>
                            <input
                                type="time"
                                value={settings.send_window_end?.slice(0, 5) || '21:00'}
                                onChange={(e) => updateSetting('send_window_end', e.target.value + ':00')}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <p className="text-sm text-gray-500">
                        Messages outside this window will be queued and sent during the next available window.
                    </p>

                    <div className="pt-2">
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={settings.queue_outside_window || false}
                                onChange={(e) => updateSetting('queue_outside_window', e.target.checked)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-600">
                                Queue messages triggered outside window (instead of skipping)
                            </span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                    <Settings className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-medium text-blue-900">How it works</h4>
                        <ul className="text-sm text-blue-700 mt-1 space-y-1">
                            <li>• Notifications are triggered automatically when PDFs are generated</li>
                            <li>• Failed messages are automatically retried up to 3 times</li>
                            <li>• You can customize message templates in WhatsApp Templates settings</li>
                            <li>• Sent notifications are tracked on the Reports and Invoices pages</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationTriggerSettings;
