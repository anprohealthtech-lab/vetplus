// src/components/Billing/InvoiceDeliveryTracker.tsx
import React, { useState } from 'react';
import { Send, CheckCircle, AlertCircle, Clock, Loader } from 'lucide-react';
import { database } from '../../utils/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface InvoiceDeliveryTrackerProps {
  invoiceId: string;
  invoiceNumber: string;
  customerPhone?: string;
  customerEmail?: string;
  onDeliveryTracked?: () => void;
}

export const InvoiceDeliveryTracker: React.FC<InvoiceDeliveryTrackerProps> = ({
  invoiceId,
  invoiceNumber,
  customerPhone,
  customerEmail,
  onDeliveryTracked
}) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'whatsapp' | 'email' | null>(null);
  const [message, setMessage] = useState('');
  const [recipientPhone, setRecipientPhone] = useState(customerPhone || '');
  const [recipientEmail, setRecipientEmail] = useState(customerEmail || '');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load current delivery status
  const loadDeliveryStatus = async () => {
    setIsLoading(true);
    const { data, error } = await database.invoices.getDeliveryStatus(invoiceId);
    if (!error && data) {
      setDeliveryStatus(data);
    }
    setIsLoading(false);
  };

  // Record WhatsApp send (manual link)
  const handleRecordWhatsAppSend = async () => {
    if (!recipientPhone) {
      setResult({ success: false, message: 'Please enter phone number' });
      return;
    }

    setIsLoading(true);
    try {
      const userId = user?.id || '';
      const { data, error } = await database.invoices.recordWhatsAppSend(invoiceId, {
        to: recipientPhone,
        caption: message || `Invoice ${invoiceNumber} is ready. Please find it attached.`,
        sentBy: userId,
        sentVia: 'manual_link'
      });

      if (error) {
        setResult({ success: false, message: `Failed to record send: ${error.message}` });
      } else {
        setResult({ success: true, message: 'WhatsApp send recorded successfully' });
        setDeliveryStatus(data);
        setSelectedMethod(null);
        setMessage('');
        setTimeout(onDeliveryTracked, 1500);
      }
    } catch (err) {
      setResult({ success: false, message: 'Error recording send' });
    } finally {
      setIsLoading(false);
    }
  };

  // Record Email send (manual link)
  const handleRecordEmailSend = async () => {
    if (!recipientEmail) {
      setResult({ success: false, message: 'Please enter email address' });
      return;
    }

    setIsLoading(true);
    try {
      const userId = user?.id || '';
      const { data, error } = await database.invoices.recordEmailSend(invoiceId, {
        to: recipientEmail,
        sentBy: userId,
        sentVia: 'manual_link'
      });

      if (error) {
        setResult({ success: false, message: `Failed to record send: ${error.message}` });
      } else {
        setResult({ success: true, message: 'Email send recorded successfully' });
        setDeliveryStatus(data);
        setSelectedMethod(null);
        setTimeout(onDeliveryTracked, 1500);
      }
    } catch (err) {
      setResult({ success: false, message: 'Error recording send' });
    } finally {
      setIsLoading(false);
    }
  };

  // Record payment reminder
  const handleRecordPaymentReminder = async () => {
    setIsLoading(true);
    try {
      const userId = user?.id || '';
      const { data, error } = await database.invoices.recordPaymentReminder(invoiceId, {
        sentBy: userId,
        sentVia: 'manual_link'
      });

      if (error) {
        setResult({ success: false, message: `Failed to record reminder: ${error.message}` });
      } else {
        setResult({ success: true, message: 'Payment reminder recorded successfully' });
        setDeliveryStatus(data);
        setTimeout(onDeliveryTracked, 1500);
      }
    } catch (err) {
      setResult({ success: false, message: 'Error recording reminder' });
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      loadDeliveryStatus();
    }
  }, [isOpen]);

  return (
    <div className="inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition"
        title="Track invoice delivery status (API or manual link)"
      >
        📤 Track Delivery
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Invoice Delivery Tracker</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Current Delivery Status */}
            {deliveryStatus && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-4">📊 Current Delivery Status</h4>
                <div className="grid grid-cols-2 gap-4">
                  {/* WhatsApp Status */}
                  <div className="flex items-start gap-3">
                    {deliveryStatus.whatsapp_sent_at ? (
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-medium text-gray-900">WhatsApp</div>
                      {deliveryStatus.whatsapp_sent_at ? (
                        <>
                          <div className="text-xs text-gray-600">
                            Sent: {new Date(deliveryStatus.whatsapp_sent_at).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            To: {deliveryStatus.whatsapp_sent_to}
                          </div>
                          <div className="text-xs text-gray-500">
                            Via: {deliveryStatus.whatsapp_sent_via || 'api'}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-gray-500">Not sent yet</div>
                      )}
                    </div>
                  </div>

                  {/* Email Status */}
                  <div className="flex items-start gap-3">
                    {deliveryStatus.email_sent_at ? (
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-medium text-gray-900">Email</div>
                      {deliveryStatus.email_sent_at ? (
                        <>
                          <div className="text-xs text-gray-600">
                            Sent: {new Date(deliveryStatus.email_sent_at).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            To: {deliveryStatus.email_sent_to}
                          </div>
                          <div className="text-xs text-gray-500">
                            Via: {deliveryStatus.email_sent_via || 'api'}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-gray-500">Not sent yet</div>
                      )}
                    </div>
                  </div>

                  {/* Payment Reminders */}
                  <div className="flex items-start gap-3 col-span-2">
                    {deliveryStatus.payment_reminder_count > 0 ? (
                      <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-medium text-gray-900">Payment Reminders</div>
                      {deliveryStatus.payment_reminder_count > 0 ? (
                        <>
                          <div className="text-xs text-gray-600">
                            Count: {deliveryStatus.payment_reminder_count}
                          </div>
                          <div className="text-xs text-gray-600">
                            Last: {new Date(deliveryStatus.last_reminder_at).toLocaleString()}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-gray-500">No reminders sent yet</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Result Message */}
            {result && (
              <div className={`mb-6 p-3 rounded-lg flex items-start gap-3 ${
                result.success 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className={result.success ? 'text-green-800 text-sm' : 'text-red-800 text-sm'}>
                  {result.message}
                </div>
              </div>
            )}

            {/* Record WhatsApp Send */}
            {selectedMethod === 'whatsapp' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-gray-900 mb-4">📱 Record WhatsApp Send (Manual Link)</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Recipient Phone Number
                    </label>
                    <input
                      type="tel"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="e.g., 9876543210"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message/Caption (Optional)
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Default: Invoice [number] is ready. Please find it attached."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRecordWhatsAppSend}
                      disabled={isLoading}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium flex items-center justify-center gap-2"
                    >
                      {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Record WhatsApp Send
                    </button>
                    <button
                      onClick={() => setSelectedMethod(null)}
                      className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Record Email Send */}
            {selectedMethod === 'email' && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-gray-900 mb-4">📧 Record Email Send (Manual Link)</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Recipient Email Address
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="e.g., customer@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRecordEmailSend}
                      disabled={isLoading}
                      className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-medium flex items-center justify-center gap-2"
                    >
                      {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Record Email Send
                    </button>
                    <button
                      onClick={() => setSelectedMethod(null)}
                      className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            {!selectedMethod && (
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900 mb-3">📋 Quick Actions</h4>
                <button
                  onClick={() => setSelectedMethod('whatsapp')}
                  disabled={isLoading || !!deliveryStatus?.whatsapp_sent_at}
                  className="w-full px-4 py-3 border-2 border-green-500 text-green-700 rounded-lg hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-between"
                >
                  <span>Record WhatsApp Send (Manual Link)</span>
                  {deliveryStatus?.whatsapp_sent_at && <CheckCircle className="h-5 w-5 text-green-600" />}
                </button>

                <button
                  onClick={() => setSelectedMethod('email')}
                  disabled={isLoading || !!deliveryStatus?.email_sent_at}
                  className="w-full px-4 py-3 border-2 border-purple-500 text-purple-700 rounded-lg hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-between"
                >
                  <span>Record Email Send (Manual Link)</span>
                  {deliveryStatus?.email_sent_at && <CheckCircle className="h-5 w-5 text-purple-600" />}
                </button>

                <button
                  onClick={handleRecordPaymentReminder}
                  disabled={isLoading}
                  className="w-full px-4 py-3 border-2 border-blue-500 text-blue-700 rounded-lg hover:bg-blue-50 font-medium flex items-center justify-between"
                >
                  <span>Record Payment Reminder</span>
                  {deliveryStatus?.payment_reminder_count > 0 && (
                    <span className="bg-blue-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                      {deliveryStatus.payment_reminder_count}
                    </span>
                  )}
                </button>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceDeliveryTracker;
