import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  Eye,
  FileImage,
  FileText,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TestTube,
  TrendingUp,
  User,
  X,
  XCircle,
  Zap
} from "lucide-react";
import AttachmentSelector from "../components/Reports/AttachmentSelector";
import {
  useAIResultIntelligence,
  type ClinicalSummaryResponse,
  type GeneratedInterpretation,
  type VerifierSummaryResponse
} from "../hooks/useAIResultIntelligence";
import { supabase, database } from "../utils/supabase";
import { generateAndSaveTrendCharts, saveClinicalSummary } from "../utils/reportExtrasService";

interface PanelRow {
  order_id: string;
  result_id: string;
  test_group_id: string | null;
  test_group_name: string | null;
  expected_analytes: number;
  entered_analytes: number;
  approved_analytes: number;
  panel_ready: boolean;
  patient_id: string;
  patient_name: string;
  order_date: string;
}

interface Analyte {
  id: string;
  result_id: string;
  parameter: string;
  value: string | null;
  unit: string;
  reference_range: string;
  flag: string | null;
  verify_status: "pending" | "approved" | "rejected" | null;
  verify_note: string | null;
  verified_by: string | null;
  verified_at: string | null;
}

interface Attachment {
  id: string;
  file_url: string;
  file_type: string;
  original_filename: string;
  created_at: string;
  level: "test" | "order";
}

interface OrderGroup {
  orderId: string;
  patientId: string;
  patientName: string;
  orderDate: string;
  panels: PanelRow[];
  stats: {
    expected: number;
    entered: number;
    approved: number;
    readyPanels: number;
  };
}

interface OrderVerificationViewProps {
  onBackToPanel?: () => void;
}

type AttachmentViewMode = "test" | "all";

type StateFilter = "all" | "pending" | "partial" | "ready";

const todayISO = () => new Date().toISOString().slice(0, 10);
const fromYesterdayISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

const OrderVerificationView: React.FC<OrderVerificationViewProps> = ({ onBackToPanel }) => {
  const [from, setFrom] = useState(fromYesterdayISO());
  const [to, setTo] = useState(todayISO());
  const [q, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [panels, setPanels] = useState<PanelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowsByResult, setRowsByResult] = useState<Record<string, Analyte[]>>({});
  const [openOrders, setOpenOrders] = useState<Record<string, boolean>>({});
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [attachmentsByOrder, setAttachmentsByOrder] = useState<Record<string, Attachment[]>>({});
  const [attachmentViewMode, setAttachmentViewMode] = useState<AttachmentViewMode>("test");
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [showAttachmentSelector, setShowAttachmentSelector] = useState(false);
  const [selectedOrderForAttachments, setSelectedOrderForAttachments] = useState<string | null>(null);
  const [includeTrendsInReport, setIncludeTrendsInReport] = useState<Record<string, boolean>>({});
  const [includeSummaryInReport, setIncludeSummaryInReport] = useState<Record<string, boolean>>({});
  const [savingReportExtras, setSavingReportExtras] = useState<Record<string, boolean>>({});
  const [currentLabId, setCurrentLabId] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<Record<string, any[]>>({});
  const [showTrendModal, setShowTrendModal] = useState(false);
  const [selectedAnalyteTrend, setSelectedAnalyteTrend] = useState<{ parameter: string; patientId: string } | null>(null);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [aiVerifierSummary, setAiVerifierSummary] = useState<Record<string, VerifierSummaryResponse>>({});
  const [aiClinicalSummary, setAiClinicalSummary] = useState<Record<string, ClinicalSummaryResponse>>({});
  const [aiGeneratedInterpretations, setAiGeneratedInterpretations] = useState<Record<string, GeneratedInterpretation[]>>({});
  const [showAiSummaryModal, setShowAiSummaryModal] = useState(false);
  const [aiSummaryTarget, setAiSummaryTarget] = useState<{ type: "verifier" | "clinical"; resultId?: string; orderId?: string } | null>(null);
  const [showInterpretationsModal, setShowInterpretationsModal] = useState(false);
  const [interpretationsTargetResultId, setInterpretationsTargetResultId] = useState<string | null>(null);

  const aiIntelligence = useAIResultIntelligence();

  useEffect(() => {
    const fetchLabId = async () => {
      const labId = await database.getCurrentUserLabId();
      setCurrentLabId(labId);
    };
    fetchLabId();
  }, []);

  const loadPanels = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("v_result_panel_status")
      .select("*")
      .gte("order_date", from)
      .lte("order_date", to)
      .order("order_date", { ascending: false });

    if (error) {
      setError(error.message);
      setPanels([]);
    } else {
      setPanels((data || []) as PanelRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPanels();
  }, [from, to]);

  const groupByOrder = useMemo(() => {
    const filtered = panels.filter(row => {
      const matchesSearch = q
        ? (row.patient_name || "").toLowerCase().includes(q.toLowerCase()) ||
          (row.test_group_name || "").toLowerCase().includes(q.toLowerCase()) ||
          row.order_id.toLowerCase().includes(q.toLowerCase())
        : true;

      if (!matchesSearch) return false;

      if (stateFilter === "ready") return row.panel_ready;
      if (stateFilter === "pending") return !row.panel_ready && row.approved_analytes === 0;
      if (stateFilter === "partial") return !row.panel_ready && row.approved_analytes > 0;
      return true;
    });

    const bucket: Record<string, OrderGroup> = {};

    filtered.forEach(row => {
      if (!bucket[row.order_id]) {
        bucket[row.order_id] = {
          orderId: row.order_id,
          patientId: row.patient_id,
          patientName: row.patient_name,
          orderDate: row.order_date,
          panels: [],
          stats: {
            expected: 0,
            entered: 0,
            approved: 0,
            readyPanels: 0
          }
        };
      }

      bucket[row.order_id].panels.push(row);
      bucket[row.order_id].stats.expected += row.expected_analytes;
      bucket[row.order_id].stats.entered += row.entered_analytes;
      bucket[row.order_id].stats.approved += row.approved_analytes;
      if (row.panel_ready) bucket[row.order_id].stats.readyPanels += 1;
    });

    return Object.values(bucket).sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }, [panels, q, stateFilter]);

  const stats = useMemo(() => {
    const totalOrders = groupByOrder.length;
    const readyOrders = groupByOrder.filter(order => order.stats.readyPanels === order.panels.length).length;
    const pendingOrders = groupByOrder.filter(order => order.stats.approved === 0).length;
    const partialOrders = totalOrders - readyOrders - pendingOrders;
    return { totalOrders, readyOrders, pendingOrders, partialOrders };
  }, [groupByOrder]);

  const ensureAnalytesLoaded = async (resultId: string) => {
    if (rowsByResult[resultId]) return;

    const { data, error } = await supabase
      .from("result_values")
      .select(
        "id,result_id,parameter,value,unit,reference_range,flag,verify_status,verify_note,verified_by,verified_at"
      )
      .eq("result_id", resultId)
      .order("parameter", { ascending: true });

    if (!error && data) {
      setRowsByResult(prev => ({ ...prev, [resultId]: data as unknown as Analyte[] }));
      return;
    }

    if (error && `${error.message}`.includes("verify_status")) {
      const fallback = await supabase
        .from("result_values")
        .select("id,result_id,parameter,value,unit,reference_range,flag")
        .eq("result_id", resultId)
        .order("parameter", { ascending: true });

      if (!fallback.error && fallback.data) {
        const mapped = (fallback.data || []).map((row: any) => ({
          id: row.id,
          result_id: row.result_id,
          parameter: row.parameter,
          value: row.value,
          unit: row.unit,
          reference_range: row.reference_range,
          flag: row.flag,
          verify_status: "pending",
          verify_note: null,
          verified_by: null,
          verified_at: null
        }));
        setRowsByResult(prev => ({ ...prev, [resultId]: mapped }));
      }
    }
  };

  const loadAttachments = async (orderId: string) => {
    if (attachmentsByOrder[orderId]) return;
    try {
      const { data, error } = await supabase
        .from("attachments")
        .select("id,file_url,file_type,original_filename,created_at,order_test_id")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const attachments: Attachment[] = (data || []).map(att => ({
        id: att.id,
        file_url: att.file_url,
        file_type: att.file_type,
        original_filename: att.original_filename,
        created_at: att.created_at,
        level: att.order_test_id ? "test" : "order"
      }));

      setAttachmentsByOrder(prev => ({ ...prev, [orderId]: attachments }));
    } catch (err) {
      console.error("Failed to load attachments", err);
    }
  };

  const loadTrendData = async (patientId: string, parameter: string) => {
    const cacheKey = `${patientId}-${parameter}`;
    if (trendData[cacheKey]) {
      setSelectedAnalyteTrend({ patientId, parameter });
      setShowTrendModal(true);
      return;
    }

    setLoadingTrend(true);
    try {
      const { data, error } = await supabase
        .from("v_report_template_context")
        .select("order_date, analytes")
        .eq("patient_id", patientId)
        .order("order_date", { ascending: false })
        .limit(10);

      if (error) throw error;

      const extracted = (data || []).flatMap((row: any) => {
        const analytes = row.analytes || [];
        return analytes
          .filter((a: any) => a.parameter === parameter)
          .map((a: any) => ({
            order_date: row.order_date,
            test_name: a.parameter,
            value: a.value,
            unit: a.unit,
            reference_range: a.reference_range,
            flag: a.flag
          }));
      });

      setTrendData(prev => ({ ...prev, [cacheKey]: extracted }));
      setSelectedAnalyteTrend({ patientId, parameter });
      setShowTrendModal(true);
    } catch (err) {
      console.error("Failed to load trend data", err);
      alert("Failed to load trend data");
    } finally {
      setLoadingTrend(false);
    }
  };

  const toggleOrder = async (orderId: string) => {
    setOpenOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
    if (!attachmentsByOrder[orderId]) await loadAttachments(orderId);
  };

  const togglePanel = async (resultId: string) => {
    setOpenPanels(prev => ({ ...prev, [resultId]: !prev[resultId] }));
    if (!rowsByResult[resultId]) await ensureAnalytesLoaded(resultId);
  };

  const setBusyFor = (key: string, val: boolean) => setBusy(prev => ({ ...prev, [key]: val }));

  const approveAnalyte = async (analyteId: string) => {
    setBusyFor(analyteId, true);
    const { error } = await supabase
      .from("result_values")
      .update({ verify_status: "approved", verified_at: new Date().toISOString() })
      .eq("id", analyteId);
    setBusyFor(analyteId, false);

    if (!error) {
      setRowsByResult(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(resultId => {
          next[resultId] = next[resultId].map(analyte => (analyte.id === analyteId ? { ...analyte, verify_status: "approved" } : analyte));
        });
        return next;
      });
      await loadPanels();
    }
  };

  const rejectAnalyte = async (analyteId: string) => {
    const note = prompt("Add a note (optional)", "") ?? null;
    setBusyFor(analyteId, true);
    const { error } = await supabase
      .from("result_values")
      .update({
        verify_status: "rejected",
        verify_note: note && note.length ? note : null,
        verified_at: new Date().toISOString()
      })
      .eq("id", analyteId);
    setBusyFor(analyteId, false);

    if (!error) {
      setRowsByResult(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(resultId => {
          next[resultId] = next[resultId].map(analyte => (analyte.id === analyteId ? { ...analyte, verify_status: "rejected", verify_note: note } : analyte));
        });
        return next;
      });
      await loadPanels();
    }
  };

  const approvePanel = async (panel: PanelRow, analytes: Analyte[]) => {
    if (!analytes.length) return;
    const ids = analytes.map(a => a.id);
    setBusyFor(panel.result_id, true);
    setSavingReportExtras(prev => ({ ...prev, [panel.order_id]: true }));

    try {
      const { error } = await supabase
        .from("result_values")
        .update({ verify_status: "approved", verified_at: new Date().toISOString() })
        .in("id", ids);

      if (error) throw error;

      setRowsByResult(prev => ({
        ...prev,
        [panel.result_id]: (prev[panel.result_id] || []).map(analyte => ({ ...analyte, verify_status: "approved" }))
      }));

      if (includeTrendsInReport[panel.order_id]) {
        const flagged = analytes.filter(a => a.flag && ["H", "L", "C", "Critical"].includes(a.flag));
        if (flagged.length) {
          await generateAndSaveTrendCharts(
            panel.result_id,
            panel.order_id,
            panel.patient_id,
            flagged.map(a => ({ name: a.parameter, flag: a.flag })),
            true
          );
        }
      }

      if (includeSummaryInReport[panel.order_id] && aiClinicalSummary[panel.order_id]) {
        const summary = aiClinicalSummary[panel.order_id];
        await saveClinicalSummary(panel.result_id, {
          text: summary.clinical_interpretation || summary.executive_summary || "",
          recommendation: summary.suggested_followup?.join("\n"),
          generated_at: new Date().toISOString(),
          generated_by: "ai"
        });
      }

      await supabase.rpc("finalize_panel", { p_result_id: panel.result_id });
      await loadPanels();
    } catch (err) {
      console.error("Failed to approve panel", err);
    } finally {
      setBusyFor(panel.result_id, false);
      setSavingReportExtras(prev => ({ ...prev, [panel.order_id]: false }));
    }
  };

  const approveEntireOrder = async (order: OrderGroup) => {
    setBulkProcessing(true);
    for (const panel of order.panels) {
      await ensureAnalytesLoaded(panel.result_id);
      const analytes = rowsByResult[panel.result_id] || [];
      await approvePanel(panel, analytes);
    }
    setBulkProcessing(false);
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const bulkApproveOrders = async () => {
    if (selectedOrders.size === 0) return;
    setBulkProcessing(true);
    for (const orderId of selectedOrders) {
      const order = groupByOrder.find(o => o.orderId === orderId);
      if (order) await approveEntireOrder(order);
    }
    setSelectedOrders(new Set());
    setBulkProcessing(false);
  };

  const handleGenerateClinicalSummary = async (order: OrderGroup) => {
    try {
      const testGroups = await Promise.all(
        order.panels.map(async panel => {
          await ensureAnalytesLoaded(panel.result_id);
          const analytes = rowsByResult[panel.result_id] || [];
          return {
            name: panel.test_group_name || "Unnamed Panel",
            category: "panel",
            result_values: analytes.map(a => ({
              analyte_name: a.parameter,
              value: a.value || "",
              unit: a.unit,
              reference_range: a.reference_range,
              flag: (a.flag as "H" | "L" | "C" | null) || null,
              interpretation: a.verify_note
            }))
          };
        })
      );

      const summary = await aiIntelligence.getClinicalSummary(testGroups, {
        age: undefined,
        gender: undefined,
        clinical_notes: undefined
      });

      setAiClinicalSummary(prev => ({ ...prev, [order.orderId]: summary }));
      setAiSummaryTarget({ type: "clinical", orderId: order.orderId });
      setShowAiSummaryModal(true);
    } catch (err) {
      console.error("Failed to generate clinical summary", err);
      alert("Failed to generate clinical summary");
    }
  };

  const handleVerifierSummary = async (panel: PanelRow, analytes: Analyte[]) => {
    try {
      const summary = await aiIntelligence.getVerifierSummary(
        {
          test_group_name: panel.test_group_name || "",
          test_group_code: panel.test_group_id || ""
        },
        analytes.map(analyte => ({
          analyte_name: analyte.parameter,
          value: String(analyte.value || ""),
          unit: analyte.unit,
          reference_range: analyte.reference_range,
          flag: (analyte.flag as "H" | "L" | "C" | null) || null,
          interpretation: analyte.verify_note
        }))
      );

      setAiVerifierSummary(prev => ({ ...prev, [panel.result_id]: summary }));
      setAiSummaryTarget({ type: "verifier", resultId: panel.result_id });
      setShowAiSummaryModal(true);
    } catch (err) {
      console.error("Failed to get verifier summary", err);
      alert("Failed to generate verifier summary");
    }
  };

  const handleInterpretations = async (panel: PanelRow, analytes: Analyte[]) => {
    try {
      const labId = currentLabId;
      if (!labId) {
        alert("Lab context missing");
        return;
      }

      const response = await aiIntelligence.generateMissingInterpretations(
        analytes.map(a => ({
          id: a.id,
          name: a.parameter,
          unit: a.unit,
          reference_range: a.reference_range,
          interpretation_low: null,
          interpretation_normal: null,
          interpretation_high: null
        })),
        {
          test_group_name: panel.test_group_name || "",
          test_group_code: panel.test_group_id || ""
        }
      );

      setAiGeneratedInterpretations(prev => ({ ...prev, [panel.result_id]: response.interpretations }));
      setInterpretationsTargetResultId(panel.result_id);
      setShowInterpretationsModal(true);
    } catch (err) {
      console.error("Failed to generate interpretations", err);
      alert("Failed to generate interpretations");
    }
  };

  const setDateRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setTo(end.toISOString().split("T")[0]);
    setFrom(start.toISOString().split("T")[0]);
  };

  const AttachmentViewer: React.FC<{ orderId: string }> = ({ orderId }) => {
    const attachments = attachmentsByOrder[orderId] || [];
    if (!attachments.length) {
      return (
        <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>No attachments found for this order</span>
          </div>
        </div>
      );
    }

    const testAttachments = attachments.filter(att => att.level === "test");
    const orderAttachments = attachments.filter(att => att.level !== "test");

    const shouldShowTestOnly = attachmentViewMode === "test";
    const toRender = shouldShowTestOnly ? testAttachments : attachments;

    return (
      <div className="space-y-2">
        {toRender.map(att => (
          <div key={att.id} className="border rounded bg-white/50">
            <div className="flex items-center justify-between p-2">
              <div className="flex items-center space-x-2">
                <FileText className={`h-4 w-4 ${att.level === "test" ? "text-blue-600" : "text-gray-500"}`} />
                <div>
                  <p className="text-sm font-medium">{att.original_filename}</p>
                  <p className="text-xs text-gray-500">
                    {att.level === "test" ? "Test" : "Order"} level • {new Date(att.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <a
                href={att.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                <Eye className="h-4 w-4" />
              </a>
            </div>
          </div>
        ))}
        {shouldShowTestOnly && !testAttachments.length && orderAttachments.length > 0 && (
          <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
            Switch to "All" view to see {orderAttachments.length} order-level attachment{orderAttachments.length > 1 ? "s" : ""}
          </div>
        )}
      </div>
    );
  };

  const TrendModal: React.FC = () => {
    if (!showTrendModal || !selectedAnalyteTrend) return null;

    const cacheKey = `${selectedAnalyteTrend.patientId}-${selectedAnalyteTrend.parameter}`;
    const trends = trendData[cacheKey] || [];

    return ReactDOM.createPortal(
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <TrendingUp className="h-6 w-6 text-white" />
              <h3 className="text-xl font-bold text-white">Trend: {selectedAnalyteTrend.parameter}</h3>
            </div>
            <button
              onClick={() => setShowTrendModal(false)}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
            {trends.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No historical data available</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600">Most recent {trends.length} readings</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Date</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Value</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Unit</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Reference</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {trends.map((trend, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-3 text-sm text-gray-800">{new Date(trend.order_date).toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">{trend.value ?? "—"}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{trend.unit}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{trend.reference_range}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{trend.flag || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const percentage = (approved: number, expected: number) => {
    if (!expected) return 0;
    return Math.round((approved / expected) * 100);
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Order Verification Console</h1>
              <p className="text-lg text-gray-600">Review and approve results grouped by order with AI assistance</p>
              <div className="flex items-center space-x-4 mt-3">
                <button
                  onClick={() => setDateRange(0)}
                  className="px-3 py-1.5 text-sm rounded-full border border-gray-200 text-gray-600 hover:border-blue-400"
                >
                  Today
                </button>
                <button
                  onClick={() => setDateRange(7)}
                  className="px-3 py-1.5 text-sm rounded-full border border-gray-200 text-gray-600 hover:border-blue-400"
                >
                  7 days
                </button>
                <button
                  onClick={() => setDateRange(30)}
                  className="px-3 py-1.5 text-sm rounded-full border border-gray-200 text-gray-600 hover:border-blue-400"
                >
                  30 days
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={loadPanels}
                className="inline-flex items-center px-5 py-2.5 bg-white border-2 border-gray-200 rounded-xl hover:border-gray-400"
              >
                <RefreshCcw className={`h-5 w-5 mr-2 ${loading ? "animate-spin text-blue-600" : "text-gray-600"}`} />
                Refresh
              </button>
              {onBackToPanel && (
                <button
                  onClick={onBackToPanel}
                  className="inline-flex items-center px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                >
                  Return to Panel View
                </button>
              )}
              {selectedOrders.size > 0 && (
                <button
                  onClick={bulkApproveOrders}
                  disabled={bulkProcessing}
                  className="inline-flex items-center px-5 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50"
                >
                  {bulkProcessing ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                  Approve Selected
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-6">
            <div className="text-3xl font-bold text-blue-600">{stats.totalOrders}</div>
            <div className="text-sm text-blue-700">Total Orders</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl p-6">
            <div className="text-3xl font-bold text-green-600">{stats.readyOrders}</div>
            <div className="text-sm text-green-700">Fully Verified</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-orange-100 rounded-xl p-6">
            <div className="text-3xl font-bold text-amber-600">{stats.partialOrders}</div>
            <div className="text-sm text-amber-700">Partially Verified</div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-rose-100 rounded-xl p-6">
            <div className="text-3xl font-bold text-red-600">{stats.pendingOrders}</div>
            <div className="text-sm text-red-700">Pending Review</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              <label className="flex flex-col text-sm text-gray-600">
                From
                <input
                  type="date"
                  value={from}
                  onChange={e => setFrom(e.target.value)}
                  className="mt-1 px-4 py-3 border-2 border-gray-200 rounded-xl"
                />
              </label>
              <label className="flex flex-col text-sm text-gray-600">
                To
                <input
                  type="date"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  className="mt-1 px-4 py-3 border-2 border-gray-200 rounded-xl"
                />
              </label>
            </div>
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search patients, tests, or order IDs..."
                className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-xl"
              />
            </div>
            <div className="flex items-center space-x-3">
              {(["all", "ready", "partial", "pending"] as StateFilter[]).map(filter => (
                <button
                  key={filter}
                  onClick={() => setStateFilter(filter)}
                  className={`px-3 py-2 rounded-xl border-2 text-sm font-semibold ${stateFilter === filter ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500"}`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
              <div>
                <h4 className="text-lg font-semibold text-red-800">Failed to load orders</h4>
                <p className="text-red-600">{error}</p>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="space-y-6">
            {[...Array(3)].map((_, idx) => (
              <div key={idx} className="bg-white rounded-2xl border border-gray-200 p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {!loading && groupByOrder.length === 0 && (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
              <TestTube className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">No Orders Found</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto text-lg">
              No orders match your filters for the selected date range.
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => {
                  setQ("");
                  setStateFilter("all");
                  setDateRange(7);
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
              >
                Reset Filters
              </button>
              <button
                onClick={loadPanels}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:border-gray-400"
              >
                Refresh Data
              </button>
            </div>
          </div>
        )}

        {!loading && groupByOrder.length > 0 && (
          <div className="space-y-6">
            {groupByOrder.map(order => {
              const orderApprovedPct = percentage(order.stats.approved, order.stats.expected);
              const allReady = order.stats.readyPanels === order.panels.length;

              return (
                <div key={order.orderId} className="border-2 rounded-2xl bg-white shadow-sm">
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                      <div className="flex items-start space-x-4">
                        <input
                          type="checkbox"
                          checked={selectedOrders.has(order.orderId)}
                          onChange={() => toggleOrderSelection(order.orderId)}
                          className="w-5 h-5 mt-1 rounded border-2 border-gray-300 text-blue-600"
                        />
                        <div>
                          <div className="flex items-center space-x-3">
                            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl">
                              <User className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-2xl font-bold text-gray-900">{order.patientName}</h3>
                              <p className="text-sm text-gray-500">Order #{order.orderId}</p>
                              <p className="text-sm text-gray-500">{new Date(order.orderDate).toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center space-x-3">
                            {allReady ? (
                              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
                                <ShieldCheck className="h-4 w-4 mr-2" /> Fully Verified
                              </span>
                            ) : order.stats.approved > 0 ? (
                              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-sm font-semibold">
                                <AlertTriangle className="h-4 w-4 mr-2" /> Partial ({order.stats.approved}/{order.stats.expected})
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-sm font-semibold">
                                <AlertCircle className="h-4 w-4 mr-2" /> Pending
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-3">
                        <div className="text-sm text-gray-500">Progress</div>
                        <div className="flex items-center space-x-3">
                          <div className="w-48 bg-gray-100 rounded-full h-3">
                            <div className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600" style={{ width: `${orderApprovedPct}%` }} />
                          </div>
                          <span className="text-gray-700 font-semibold">{orderApprovedPct}%</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => toggleOrder(order.orderId)}
                            className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
                          >
                            {openOrders[order.orderId] ? "Hide Panels" : "Show Panels"}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedOrderForAttachments(order.orderId);
                              setShowAttachmentSelector(true);
                            }}
                            className="inline-flex items-center px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
                          >
                            <FileImage className="h-4 w-4 mr-2" /> Manage Attachments
                          </button>
                          <button
                            onClick={() => handleGenerateClinicalSummary(order)}
                            className="inline-flex items-center px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 text-white"
                          >
                            <Stethoscope className="h-4 w-4 mr-2" /> Clinical Summary
                          </button>
                          <button
                            onClick={() => approveEntireOrder(order)}
                            disabled={bulkProcessing}
                            className="inline-flex items-center px-4 py-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white disabled:opacity-50"
                          >
                            {bulkProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />} Approve Order
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {openOrders[order.orderId] && (
                    <div className="p-6 space-y-6 bg-gray-50">
                      {order.panels.map(panel => {
                        const analytes = rowsByResult[panel.result_id] || [];
                        const isPanelOpen = openPanels[panel.result_id];

                        return (
                          <div key={panel.result_id} className="bg-white rounded-2xl shadow-sm border border-gray-200">
                            <div className="p-6 border-b border-gray-100">
                              <div className="flex flex-col md:flex-row md:items-center justify-between">
                                <div>
                                  <h4 className="text-xl font-semibold text-gray-900">{panel.test_group_name}</h4>
                                  <p className="text-sm text-gray-500">{panel.expected_analytes} analytes</p>
                                </div>
                                <div className="flex flex-wrap gap-3 mt-4 md:mt-0">
                                  <button
                                    onClick={() => togglePanel(panel.result_id)}
                                    className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
                                  >
                                    {isPanelOpen ? "Hide Analytes" : "Show Analytes"}
                                  </button>
                                  <button
                                    onClick={async () => {
                                      await ensureAnalytesLoaded(panel.result_id);
                                      const analytesData = rowsByResult[panel.result_id] || [];
                                      await handleInterpretations(panel, analytesData);
                                    }}
                                    disabled={aiIntelligence.loading}
                                    className="inline-flex items-center px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white disabled:opacity-50"
                                  >
                                    {aiIntelligence.loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />} AI Interpretations
                                  </button>
                                  <button
                                    onClick={async () => {
                                      await ensureAnalytesLoaded(panel.result_id);
                                      const analytesData = rowsByResult[panel.result_id] || [];
                                      await handleVerifierSummary(panel, analytesData);
                                    }}
                                    disabled={aiIntelligence.loading}
                                    className="inline-flex items-center px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white disabled:opacity-50"
                                  >
                                    {aiIntelligence.loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />} AI Summary
                                  </button>
                                  <button
                                    onClick={async () => {
                                      await ensureAnalytesLoaded(panel.result_id);
                                      const analytesData = rowsByResult[panel.result_id] || [];
                                      await approvePanel(panel, analytesData);
                                    }}
                                    disabled={busy[panel.result_id]}
                                    className="inline-flex items-center px-4 py-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white disabled:opacity-50"
                                  >
                                    {busy[panel.result_id] ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckSquare className="h-4 w-4 mr-2" />} Approve Panel
                                  </button>
                                </div>
                              </div>
                            </div>

                            {isPanelOpen && (
                              <div className="p-6">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                  <table className="min-w-full">
                                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                                      <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Analyte</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Value</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Unit</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Reference</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Flag</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {analytes.map(analyte => (
                                        <tr key={analyte.id} className="hover:bg-blue-50">
                                          <td className="px-4 py-4">
                                            <div className="font-semibold text-gray-900">{analyte.parameter}</div>
                                            <button
                                              className="inline-flex items-center text-blue-600 hover:text-blue-800 text-xs"
                                              onClick={() => loadTrendData(order.patientId, analyte.parameter)}
                                              disabled={loadingTrend && selectedAnalyteTrend?.parameter === analyte.parameter}
                                            >
                                              {loadingTrend && selectedAnalyteTrend?.parameter === analyte.parameter ? (
                                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                              ) : (
                                                <TrendingUp className="h-3 w-3 mr-1" />
                                              )}
                                              Trend
                                            </button>
                                          </td>
                                          <td className="px-4 py-4 text-lg font-bold text-gray-900">{analyte.value ?? "—"}</td>
                                          <td className="px-4 py-4 text-gray-700">{analyte.unit}</td>
                                          <td className="px-4 py-4 text-sm text-gray-600">{analyte.reference_range}</td>
                                          <td className="px-4 py-4">
                                            {analyte.flag && (
                                              <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                                                {analyte.flag}
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-4 py-4">
                                            {analyte.verify_status === "approved" ? (
                                              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                                                <CheckCircle2 className="h-4 w-4 mr-1" /> Approved
                                              </span>
                                            ) : (
                                              <div className="flex items-center space-x-2">
                                                <button
                                                  onClick={() => approveAnalyte(analyte.id)}
                                                  disabled={busy[analyte.id]}
                                                  className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs"
                                                >
                                                  Approve
                                                </button>
                                                <button
                                                  onClick={() => rejectAnalyte(analyte.id)}
                                                  disabled={busy[analyte.id]}
                                                  className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs"
                                                >
                                                  Reject
                                                </button>
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                          <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                            <FileText className="h-5 w-5 mr-2 text-blue-600" /> Attachments
                          </h4>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setAttachmentViewMode("test")}
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${attachmentViewMode === "test" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}
                            >
                              Test Only
                            </button>
                            <button
                              onClick={() => setAttachmentViewMode("all")}
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${attachmentViewMode === "all" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}
                            >
                              All
                            </button>
                          </div>
                        </div>
                        <div className="p-6">
                          <AttachmentViewer orderId={order.orderId} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TrendModal />

      {showAttachmentSelector && selectedOrderForAttachments && (
        <AttachmentSelector
          orderId={selectedOrderForAttachments}
          onClose={() => {
            setShowAttachmentSelector(false);
            setSelectedOrderForAttachments(null);
          }}
          onSave={() => {
            if (selectedOrderForAttachments) {
              setAttachmentsByOrder(prev => {
                const updated = { ...prev };
                delete updated[selectedOrderForAttachments];
                return updated;
              });
              loadAttachments(selectedOrderForAttachments);
            }
          }}
        />
      )}

      {showAiSummaryModal && aiSummaryTarget && (
        <AISummaryModal
          target={aiSummaryTarget}
          summaries={{
            verifier: aiVerifierSummary,
            clinical: aiClinicalSummary
          }}
          onClose={() => {
            setShowAiSummaryModal(false);
            setAiSummaryTarget(null);
          }}
        />
      )}

      {showInterpretationsModal && interpretationsTargetResultId && (
        <AIInterpretationsModal
          interpretations={aiGeneratedInterpretations[interpretationsTargetResultId] || []}
          labId={currentLabId}
          onClose={() => {
            setShowInterpretationsModal(false);
            setInterpretationsTargetResultId(null);
          }}
        />
      )}
    </div>
  );
};

const TrendModal: React.FC = () => {
  const [state, setState] = useState<{
    visible: boolean;
    trends: any[];
    title: string;
  }>({ visible: false, trends: [], title: "" });
  return null;
};

interface AISummaryModalProps {
  target: { type: "verifier" | "clinical"; resultId?: string; orderId?: string };
  summaries: {
    verifier: Record<string, VerifierSummaryResponse>;
    clinical: Record<string, ClinicalSummaryResponse>;
  };
  onClose: () => void;
}

const AISummaryModal: React.FC<AISummaryModalProps> = ({ target, summaries, onClose }) => {
  const isVerifier = target.type === "verifier";
  const summary = isVerifier
    ? target.resultId
      ? summaries.verifier[target.resultId]
      : null
    : target.orderId
    ? summaries.clinical[target.orderId]
    : null;

  if (!summary) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isVerifier ? <ClipboardList className="h-6 w-6 text-white" /> : <Stethoscope className="h-6 w-6 text-white" />}
            <h3 className="text-xl font-bold text-white">
              {isVerifier ? "AI Verifier Summary" : "Clinical Summary"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {isVerifier && "overall_assessment" in summary ? (
            <div className="space-y-6">
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                <h4 className="text-lg font-semibold text-purple-900">Overall Assessment</h4>
                <p className="text-purple-800">{summary.overall_assessment}</p>
              </div>
              {summary.abnormal_findings.length > 0 && (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                  <h4 className="text-lg font-semibold text-amber-900">Abnormal Findings</h4>
                  <ul className="list-disc list-inside text-amber-800">
                    {summary.abnormal_findings.map((finding, idx) => (
                      <li key={idx}>{finding}</li>
                    ))}
                  </ul>
                </div>
              )}
              {summary.critical_alerts.length > 0 && (
                <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                  <h4 className="text-lg font-semibold text-red-900">Critical Alerts</h4>
                  <ul className="list-disc list-inside text-red-800">
                    {summary.critical_alerts.map((alert, idx) => (
                      <li key={idx}>{alert}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <h4 className="text-lg font-semibold text-blue-900">Executive Summary</h4>
                <p className="text-blue-800">{summary.executive_summary}</p>
              </div>
              {summary.significant_findings.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Finding</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Clinical Significance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {summary.significant_findings.map((finding, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-3 text-sm text-gray-800">{finding.finding}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{finding.clinical_significance}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {summary.suggested_followup.length > 0 && (
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <h4 className="text-lg font-semibold text-green-900">Suggested Follow-up</h4>
                  <ul className="list-disc list-inside text-green-800">
                    {summary.suggested_followup.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">Use this intelligence as a guide before final approval.</p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

interface AIInterpretationsModalProps {
  interpretations: GeneratedInterpretation[];
  labId: string | null;
  onClose: () => void;
}

const AIInterpretationsModal: React.FC<AIInterpretationsModalProps> = ({ interpretations, labId, onClose }) => {
  const [saving, setSaving] = useState(false);
  const aiIntelligence = useAIResultIntelligence();

  if (!interpretations.length) return null;

  const handleSave = async () => {
    if (!labId) {
      alert("Lab context unavailable");
      return;
    }

    setSaving(true);
    try {
      const result = await aiIntelligence.saveInterpretationsToDb(labId, interpretations);
      alert(`Saved ${result.success.length} interpretations${result.failed.length ? `, ${result.failed.length} failed` : ""}`);
      onClose();
    } catch (err) {
      console.error("Failed to save interpretations", err);
      alert("Failed to save interpretations");
    } finally {
      setSaving(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Zap className="h-6 w-6 text-white" />
            <h3 className="text-xl font-bold text-white">AI Interpretations</h3>
            <span className="bg-white bg-opacity-20 px-2 py-1 rounded-full text-sm text-white">
              {interpretations.length} analytes
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
          <div className="space-y-4">
            {interpretations.map((interp, idx) => (
              <div key={idx} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <div className="text-lg font-semibold text-gray-900 mb-2">{interp.analyte_name}</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-700">
                  <div>
                    <p className="font-semibold text-gray-600">Low</p>
                    <p>{interp.interpretation_low}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-600">Normal</p>
                    <p>{interp.interpretation_normal}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-600">High</p>
                    <p>{interp.interpretation_high}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">Review interpretations before saving to your lab knowledge base.</p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <CheckCircle2 className="h-5 w-5 mr-2" />} Save to Lab
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default OrderVerificationView;
