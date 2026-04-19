// PatientPortalSettings.tsx
// Drop this component into any lab settings page.
// Requires: supabase client, lab_id, SUPABASE_URL env for edge function calls.
// Edge functions needed: create-patient-portal-user, bulk-create-patient-portal-users

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../utils/supabase';
import { WhatsAppAPI } from '../../utils/whatsappAPI';
import {
  Smartphone, Users, CheckCircle, AlertCircle,
  Download, RefreshCw, Loader2, PhoneOff, KeyRound, Copy, Check,
  Send, MessageSquare
} from 'lucide-react';

interface PortalStats {
  total: number;
  activated: number;
  noPhone: number;
  pending: number;
}

interface BulkResult {
  patient_id: string;
  name: string;
  phone: string;
  pin?: string;
  error?: string;
}

// Activated patient loaded from database (PIN may not be available in plaintext)
interface ActivatedPatient {
  id: string;
  name: string;
  phone: string;
  portal_access_enabled: boolean;
  // PIN is only available if just created in this session
  pin?: string;
}

interface PatientPortalSettingsProps {
  labId: string;
}

const PatientPortalSettings: React.FC<PatientPortalSettingsProps> = ({ labId }) => {
  const [stats, setStats] = useState<PortalStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const [bulkSummary, setBulkSummary] = useState<{ total: number; created: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Persistent activated patients table (always visible, survives tab switches)
  const [activatedPatients, setActivatedPatients] = useState<ActivatedPatient[]>([]);
  const [activatedLoading, setActivatedLoading] = useState(false);

  // WhatsApp sending state: map of patient_id -> status
  const [waSending, setWaSending] = useState<Record<string, 'sending' | 'sent' | 'failed'>>({});
  const [waMessage, setWaMessage] = useState<Record<string, string>>({});

  useEffect(() => {
    if (labId) {
      loadStats();
      loadActivatedPatients();
    }
  }, [labId]);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const { data: all } = await supabase
        .from('patients')
        .select('id, phone, portal_access_enabled', { count: 'exact' })
        .eq('lab_id', labId)
        .eq('is_active', true);

      if (!all) return;

      const total = all.length;
      const activated = all.filter((p) => p.portal_access_enabled).length;
      const noPhone = all.filter((p) => !p.phone).length;
      const pending = total - activated - noPhone;

      setStats({ total, activated, noPhone, pending: Math.max(pending, 0) });
    } catch (err) {
      console.error('PatientPortalSettings: loadStats error', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Load all activated patients from DB (persists across tab navigation)
  const loadActivatedPatients = useCallback(async () => {
    setActivatedLoading(true);
    try {
      const { data, error: dbError } = await supabase
        .from('patients')
        .select('id, name, phone, portal_access_enabled')
        .eq('lab_id', labId)
        .eq('is_active', true)
        .eq('portal_access_enabled', true)
        .order('name', { ascending: true });

      if (dbError) throw dbError;

      setActivatedPatients((data || []).map((p) => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        portal_access_enabled: p.portal_access_enabled,
      })));
    } catch (err) {
      console.error('PatientPortalSettings: loadActivatedPatients error', err);
    } finally {
      setActivatedLoading(false);
    }
  }, [labId]);

  // Merge fresh PINs from bulk results into activatedPatients
  useEffect(() => {
    if (!bulkResults) return;
    const pinMap: Record<string, string> = {};
    bulkResults.forEach((r) => { if (r.pin) pinMap[r.patient_id] = r.pin; });
    if (Object.keys(pinMap).length === 0) return;

    setActivatedPatients((prev) =>
      prev.map((p) => pinMap[p.id] ? { ...p, pin: pinMap[p.id] } : p)
    );
    // Also add newly activated patients that weren't in the list yet
    setActivatedPatients((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const newPatients = bulkResults
        .filter((r) => r.pin && !existingIds.has(r.patient_id))
        .map((r) => ({
          id: r.patient_id,
          name: r.name,
          phone: r.phone,
          portal_access_enabled: true,
          pin: r.pin,
        }));
      return newPatients.length > 0 ? [...prev, ...newPatients] : prev;
    });
  }, [bulkResults]);

  const callBulkFunction = async (forceReset: boolean) => {
    setBulkLoading(true);
    setBulkResults(null);
    setBulkSummary(null);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = (supabase as any).supabaseUrl as string;

      const res = await fetch(`${supabaseUrl}/functions/v1/bulk-create-patient-portal-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': (supabase as any).supabaseKey as string,
        },
        body: JSON.stringify({ lab_id: labId, force_reset: forceReset }),
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Bulk operation failed');

      const results: BulkResult[] = json.results || [];
      setBulkResults(results);
      setBulkSummary({ total: json.total, created: json.created, failed: json.failed });
      await loadStats();
      await loadActivatedPatients();

      // Auto-download CSV immediately so PINs are not lost
      const successRows = results.filter((r) => r.pin);
      if (successRows.length > 0) {
        const csvContent = [
          'Patient Name,Phone,PIN',
          ...successRows.map((r) => `"${r.name}","${r.phone}","${r.pin}"`),
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `patient_portal_pins_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkCreate = async () => {
    if (!window.confirm(
      `This will generate portal access for all active patients who have a phone number and don't already have access.\n\nA CSV with PINs will auto-download. Continue?`
    )) return;
    await callBulkFunction(false);
  };

  const handleResetAll = async () => {
    if (!window.confirm(
      `This will reset PINs for ALL ${stats?.activated ?? ''} activated patients.\n\nAll existing PINs will stop working immediately.\nA new CSV will auto-download with the new PINs.\n\nContinue?`
    )) return;
    await callBulkFunction(true);
  };

  const reDownloadCSV = () => {
    if (!bulkResults) return;
    const successRows = bulkResults.filter((r) => r.pin);
    const csvContent = [
      'Patient Name,Phone,PIN',
      ...successRows.map((r) => `"${r.name}","${r.phone}","${r.pin}"`),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient_portal_pins_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyPin = (patientId: string, pin: string) => {
    navigator.clipboard.writeText(pin);
    setCopiedId(patientId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Send PIN (or portal login info) via WhatsApp
  const sendPinViaWhatsApp = async (patient: ActivatedPatient) => {
    if (!patient.phone) return;

    setWaSending((prev) => ({ ...prev, [patient.id]: 'sending' }));
    setWaMessage((prev) => ({ ...prev, [patient.id]: '' }));

    let message: string;
    if (patient.pin) {
      // Fresh PIN available — send it directly
      message = `Hi ${patient.name}, your Patient Portal PIN is *${patient.pin}*.\n\nLog in at *${window.location.origin}/patient/login* using your mobile number and this PIN to view your reports.\n\nThank you!`;
    } else {
      // PIN not available in plaintext (already hashed in DB) — send login link only
      message = `Hi ${patient.name}, your Patient Portal access is active.\n\nLog in at *${window.location.origin}/patient/login* using your registered mobile number and your PIN to view your reports.\n\nIf you've forgotten your PIN, please contact us.`;
    }

    try {
      const result = await WhatsAppAPI.sendTextMessage(patient.phone, message);
      if (result.success) {
        setWaSending((prev) => ({ ...prev, [patient.id]: 'sent' }));
        setWaMessage((prev) => ({ ...prev, [patient.id]: 'Sent!' }));
      } else {
        setWaSending((prev) => ({ ...prev, [patient.id]: 'failed' }));
        setWaMessage((prev) => ({ ...prev, [patient.id]: result.message || 'Failed' }));
      }
    } catch (err) {
      setWaSending((prev) => ({ ...prev, [patient.id]: 'failed' }));
      setWaMessage((prev) => ({ ...prev, [patient.id]: 'Error sending' }));
    }

    // Clear status after 5 seconds
    setTimeout(() => {
      setWaSending((prev) => { const n = { ...prev }; delete n[patient.id]; return n; });
      setWaMessage((prev) => { const n = { ...prev }; delete n[patient.id]; return n; });
    }, 5000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-teal-600" />
            Patient Portal Access
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Generate PINs for patients to access their reports online. PINs are shared via WhatsApp/SMS by your staff.
          </p>
        </div>
        <button
          onClick={() => { loadStats(); loadActivatedPatients(); }}
          disabled={statsLoading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${statsLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Patients', value: stats.total, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: <Users className="h-5 w-5 text-gray-500" /> },
            { label: 'Portal Activated', value: stats.activated, color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200', icon: <CheckCircle className="h-5 w-5 text-teal-500" /> },
            { label: 'Pending Access', value: stats.pending, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: <Smartphone className="h-5 w-5 text-orange-500" /> },
            { label: 'No Phone Number', value: stats.noPhone, color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: <PhoneOff className="h-5 w-5 text-red-400" /> },
          ].map(({ label, value, color, bg, icon }) => (
            <div key={label} className={`rounded-xl border p-4 ${bg}`}>
              <div className="flex items-center justify-between mb-1">{icon}</div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Progress bar */}
      {stats && stats.total > 0 && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Portal adoption</span>
            <span>{Math.round((stats.activated / stats.total) * 100)}% activated</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((stats.activated / stats.total) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Bulk Action */}
      <div className="border border-dashed border-teal-300 bg-teal-50/50 rounded-xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-teal-800 flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Generate Access for All Patients
            </h3>
            <ul className="text-xs text-teal-700 mt-2 space-y-1">
              <li>• Skips patients already activated (safe to re-run)</li>
              <li>• Skips patients without a phone number</li>
              <li>• CSV auto-downloads immediately with all PINs</li>
            </ul>
          </div>
          <button
            onClick={handleBulkCreate}
            disabled={bulkLoading || (stats?.pending === 0)}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:bg-teal-300 disabled:cursor-not-allowed transition-colors"
          >
            {bulkLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Generating...</>
            ) : (
              <><Smartphone className="h-4 w-4" />Generate Access</>
            )}
          </button>
        </div>

        {/* Reset All PINs — shown when all patients are already activated */}
        {stats && stats.activated > 0 && (
          <div className="flex items-center justify-between pt-3 border-t border-teal-200">
            <div>
              <p className="text-xs font-medium text-orange-700">Reset All PINs</p>
              <p className="text-xs text-orange-600">Generates new PINs for all {stats.activated} activated patients. Old PINs stop working immediately. CSV auto-downloads.</p>
            </div>
            <button
              onClick={handleResetAll}
              disabled={bulkLoading}
              className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-orange-100 text-orange-700 border border-orange-300 text-xs font-medium rounded-lg hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset All PINs
            </button>
          </div>
        )}
      </div>

      {/* Bulk Results — shown after a bulk operation */}
      {bulkSummary && (
        <div className="space-y-2">
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <span className="flex items-center gap-1.5 text-teal-700 font-medium">
              <CheckCircle className="h-4 w-4" />
              {bulkSummary.created} created
            </span>
            {bulkSummary.failed > 0 && (
              <span className="flex items-center gap-1.5 text-red-600">
                <AlertCircle className="h-4 w-4" />
                {bulkSummary.failed} failed
              </span>
            )}
            <span className="text-gray-500">(of {bulkSummary.total} processed)</span>
            {bulkResults && bulkResults.some((r) => r.pin) && (
              <button
                onClick={reDownloadCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors ml-auto"
              >
                <Download className="h-4 w-4" />
                Download PINs CSV
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── PERSISTENT ACTIVATED PATIENTS TABLE ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Users className="h-4 w-4 text-teal-600" />
            All Activated Patients
            {activatedPatients.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs font-medium bg-teal-100 text-teal-700 rounded-full">
                {activatedPatients.length}
              </span>
            )}
          </h3>
          <button
            onClick={loadActivatedPatients}
            disabled={activatedLoading}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-teal-600 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${activatedLoading ? 'animate-spin' : ''}`} />
            Reload
          </button>
        </div>

        {activatedLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading patients...
          </div>
        ) : activatedPatients.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <Smartphone className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            No patients have portal access yet. Click "Generate Access" above to get started.
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Patient</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">PIN</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">WhatsApp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activatedPatients.map((p) => {
                    const waSendStatus = waSending[p.id];
                    const waMsg = waMessage[p.id];
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{p.name}</td>
                        <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{p.phone}</td>
                        <td className="px-4 py-2.5">
                          {p.pin ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-teal-700 tracking-widest">{p.pin}</span>
                              <button
                                onClick={() => copyPin(p.id, p.pin!)}
                                className="text-gray-400 hover:text-teal-600 transition-colors"
                                title="Copy PIN"
                              >
                                {copiedId === p.id
                                  ? <Check className="h-3.5 w-3.5 text-teal-500" />
                                  : <Copy className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Hidden (reset to reveal)</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                            <CheckCircle className="h-3 w-3" />
                            Active
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {waMsg ? (
                            <span className={`text-xs font-medium ${waSendStatus === 'sent' ? 'text-teal-600' : 'text-red-500'}`}>
                              {waMsg}
                            </span>
                          ) : (
                            <button
                              onClick={() => sendPinViaWhatsApp(p)}
                              disabled={!p.phone || waSendStatus === 'sending'}
                              title={p.pin ? 'Send PIN via WhatsApp' : 'Send portal login link via WhatsApp'}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {waSendStatus === 'sending' ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <MessageSquare className="h-3.5 w-3.5" />
                              )}
                              {p.pin ? 'Send PIN' : 'Send Link'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500">
          Share each patient's PIN via WhatsApp or SMS. Patients log in at{' '}
          <span className="font-mono text-gray-700">/patient/login</span> using their registered mobile number + PIN.
          {' '}PINs are only visible immediately after generation — download the CSV to keep a record.
        </p>
      </div>
    </div>
  );
};

export default PatientPortalSettings;
