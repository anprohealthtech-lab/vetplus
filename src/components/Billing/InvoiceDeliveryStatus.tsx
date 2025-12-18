// src/components/Billing/InvoiceDeliveryStatus.tsx
import React from 'react';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface InvoiceDeliveryStatusProps {
  whatsappSentAt?: string | null;
  emailSentAt?: string | null;
  paymentReminderCount?: number;
  compact?: boolean;
  className?: string;
}

export const InvoiceDeliveryStatus: React.FC<InvoiceDeliveryStatusProps> = ({
  whatsappSentAt,
  emailSentAt,
  paymentReminderCount = 0,
  compact = true,
  className = ''
}) => {
  if (compact) {
    // Compact icon-only version for list/table views
    return (
      <div className={`flex items-center space-x-1 ${className}`}>
        {/* Invoice Sent */}
        {(whatsappSentAt || emailSentAt) && (
          <span
            className="px-1.5 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 border border-green-200"
            title={`Sent: ${whatsappSentAt ? new Date(whatsappSentAt).toLocaleString() : new Date(emailSentAt!).toLocaleString()}`}
          >
            {whatsappSentAt ? '📱' : '📧'}
          </span>
        )}

        {/* Payment Reminders */}
        {paymentReminderCount > 0 && (
          <span
            className="px-1.5 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700 border border-blue-200"
            title={`${paymentReminderCount} reminder(s) sent`}
          >
            🔔 {paymentReminderCount}
          </span>
        )}

        {/* Not sent indicator */}
        {!whatsappSentAt && !emailSentAt && paymentReminderCount === 0 && (
          <span
            className="px-1.5 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600 border border-gray-200"
            title="Invoice not yet sent to customer"
          >
            ⏳
          </span>
        )}
      </div>
    );
  }

  // Full badge version for detail views
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Invoice Sent */}
      <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-200">
        {whatsappSentAt || emailSentAt ? (
          <>
            <CheckCircle className="h-4 w-4 text-green-600" />
            <div className="text-sm">
              <div className="font-medium text-gray-900">
                {whatsappSentAt ? '📱 Sent via WhatsApp' : '📧 Sent via Email'}
              </div>
              <div className="text-xs text-gray-600">
                {new Date(whatsappSentAt || emailSentAt!).toLocaleString()}
              </div>
            </div>
          </>
        ) : (
          <>
            <Clock className="h-4 w-4 text-gray-400" />
            <div className="text-sm text-gray-600">Not sent yet</div>
          </>
        )}
      </div>

      {/* Payment Reminders */}
      {paymentReminderCount > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200">
          <CheckCircle className="h-4 w-4 text-blue-600" />
          <div className="text-sm">
            <div className="font-medium text-gray-900">
              🔔 {paymentReminderCount} Payment Reminder{paymentReminderCount !== 1 ? 's' : ''}
            </div>
            <div className="text-xs text-gray-600">Sent to customer</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceDeliveryStatus;
