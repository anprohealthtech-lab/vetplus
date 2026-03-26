/**
 * Thermal Print Button Component
 * 
 * Provides a button to print invoices on thermal printers (58mm/80mm).
 * Uses browser print dialog - requires thermal printer drivers installed.
 */

import React, { useState } from 'react';
import { Printer, Receipt, Loader } from 'lucide-react';
import { printThermalInvoice } from '../../utils/thermalInvoiceService';

interface ThermalPrintButtonProps {
    invoiceId: string;
    format?: 'thermal_80mm' | 'thermal_58mm';
    size?: 'sm' | 'md' | 'lg';
    variant?: 'primary' | 'secondary' | 'icon';
    label?: string;
    showIcon?: boolean;
    onSuccess?: () => void;
    onError?: (error: Error) => void;
}

export const ThermalPrintButton: React.FC<ThermalPrintButtonProps> = ({
    invoiceId,
    format = 'thermal_80mm',
    size = 'md',
    variant = 'secondary',
    label,
    showIcon = true,
    onSuccess,
    onError
}) => {
    const [isPrinting, setIsPrinting] = useState(false);

    const handlePrint = async () => {
        setIsPrinting(true);
        try {
            await printThermalInvoice(invoiceId, format);
            onSuccess?.();
        } catch (error) {
            console.error('Thermal print failed:', error);
            onError?.(error as Error);
            alert(`Failed to print thermal invoice: ${(error as Error).message}`);
        } finally {
            setIsPrinting(false);
        }
    };

    // Size classes
    const sizeClasses = {
        sm: 'px-2 py-1 text-xs',
        md: 'px-3 py-2 text-sm',
        lg: 'px-4 py-3 text-base'
    };

    // Variant classes
    const variantClasses = {
        primary: 'bg-green-600 hover:bg-green-700 text-white',
        secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300',
        icon: 'p-2 bg-transparent hover:bg-gray-100 text-gray-600 border border-gray-300'
    };

    // Default label based on format
    const defaultLabel = format === 'thermal_80mm' ? 'Print 80mm' : 'Print 58mm';
    const displayLabel = label !== undefined ? label : defaultLabel;

    // Icon based on format
    const Icon = format === 'thermal_58mm' ? Receipt : Printer;

    if (variant === 'icon') {
        return (
            <button
                onClick={handlePrint}
                disabled={isPrinting}
                className={`
          rounded-lg transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantClasses[variant]}
        `}
                title={displayLabel}
            >
                {isPrinting ? (
                    <Loader className="h-4 w-4 animate-spin" />
                ) : (
                    <Icon className="h-4 w-4" />
                )}
            </button>
        );
    }

    return (
        <button
            onClick={handlePrint}
            disabled={isPrinting}
            className={`
        inline-flex items-center gap-2 rounded-lg font-medium
        transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${variantClasses[variant]}
      `}
        >
            {isPrinting ? (
                <>
                    <Loader className="h-4 w-4 animate-spin" />
                    <span>Printing...</span>
                </>
            ) : (
                <>
                    {showIcon && <Icon className="h-4 w-4" />}
                    <span>{displayLabel}</span>
                </>
            )}
        </button>
    );
};

/**
 * Thermal Format Selector with Print
 * Shows both 58mm and 80mm options
 */
interface ThermalPrintMenuProps {
    invoiceId: string;
    onSuccess?: () => void;
    onError?: (error: Error) => void;
}

export const ThermalPrintMenu: React.FC<ThermalPrintMenuProps> = ({
    invoiceId,
    onSuccess,
    onError
}) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium
          bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300
          rounded-lg transition-colors"
            >
                <Receipt className="h-4 w-4" />
                <span>Thermal Print</span>
                <svg
                    className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown Menu */}
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                        <div className="py-1">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    printThermalInvoice(invoiceId, 'thermal_80mm')
                                        .then(() => onSuccess?.())
                                        .catch(error => {
                                            console.error('80mm print failed:', error);
                                            onError?.(error);
                                            alert(`Print failed: ${error.message}`);
                                        });
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                            >
                                <Printer className="h-4 w-4 text-gray-600" />
                                <div>
                                    <div className="font-medium">80mm Receipt</div>
                                    <div className="text-xs text-gray-500">Standard thermal</div>
                                </div>
                            </button>

                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    printThermalInvoice(invoiceId, 'thermal_58mm')
                                        .then(() => onSuccess?.())
                                        .catch(error => {
                                            console.error('58mm print failed:', error);
                                            onError?.(error);
                                            alert(`Print failed: ${error.message}`);
                                        });
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                            >
                                <Receipt className="h-4 w-4 text-gray-600" />
                                <div>
                                    <div className="font-medium">58mm Receipt</div>
                                    <div className="text-xs text-gray-500">Compact thermal</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ThermalPrintButton;
