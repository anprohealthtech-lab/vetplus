import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Search, Percent, DollarSign, CreditCard } from 'lucide-react';
import { supabase } from '../../config/supabase';
import { createOrderWithPayment, calculateDiscount, calculateFinalAmount } from '../../services/orderService';
import { toast } from 'react-hot-toast';

interface Patient {
    id: string;
    name: string;
    display_id: string;
    phone: string;
}

interface TestGroup {
    id: string;
    name: string;
    price: number;
}

interface DashboardOrderFormProps {
    onClose: () => void;
    onOrderCreated: () => void;
}

export default function DashboardOrderForm({ onClose, onOrderCreated }: DashboardOrderFormProps) {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [tests, setTests] = useState<TestGroup[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [selectedTests, setSelectedTests] = useState<TestGroup[]>([]);
    const [searchTest, setSearchTest] = useState('');

    // Discount fields
    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
    const [discountValue, setDiscountValue] = useState<number>(0);

    // Payment fields
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'online'>('cash');
    const [amountPaid, setAmountPaid] = useState<number>(0);
    const [paymentNotes, setPaymentNotes] = useState('');

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchPatients();
        fetchTests();
    }, []);

    const fetchPatients = async () => {
        const { data, error } = await supabase
            .from('patients')
            .select('id, name, display_id, phone')
            .order('created_at', { ascending: false })
            .limit(50);

        if (!error && data) {
            setPatients(data);
        }
    };

    const fetchTests = async () => {
        const { data, error } = await supabase
            .from('test_groups')
            .select('id, name, price')
            .eq('is_active', true)
            .order('name');

        if (!error && data) {
            setTests(data);
        }
    };

    const filteredTests = tests.filter(
        (test) =>
            test.name.toLowerCase().includes(searchTest.toLowerCase()) &&
            !selectedTests.find((t) => t.id === test.id)
    );

    const addTest = (test: TestGroup) => {
        setSelectedTests([...selectedTests, test]);
        setSearchTest('');
    };

    const removeTest = (testId: string) => {
        setSelectedTests(selectedTests.filter((t) => t.id !== testId));
    };

    // Calculations
    const subtotal = selectedTests.reduce((sum, test) => sum + test.price, 0);
    const discountAmount = calculateDiscount(subtotal, discountType, discountValue);
    const finalAmount = calculateFinalAmount(subtotal, discountType, discountValue);
    const balanceDue = finalAmount - amountPaid;

    const handleSubmit = async () => {
        if (!selectedPatient) {
            toast.error('Please select a patient');
            return;
        }

        if (selectedTests.length === 0) {
            toast.error('Please select at least one test');
            return;
        }

        if (amountPaid > finalAmount) {
            toast.error('Amount paid cannot exceed final amount');
            return;
        }

        setLoading(true);

        try {
            const result = await createOrderWithPayment({
                patient_id: selectedPatient.id,
                test_ids: selectedTests.map((t) => t.id),
                discount_type: discountValue > 0 ? discountType : undefined,
                discount_value: discountValue > 0 ? discountValue : undefined,
                payment_method: amountPaid > 0 ? paymentMethod : undefined,
                amount_paid: amountPaid > 0 ? amountPaid : undefined,
                notes: paymentNotes || undefined,
            });

            toast.success(
                `Order created! ${balanceDue > 0 ? `Balance: ₹${balanceDue.toFixed(2)}` : 'Fully paid'}`
            );

            onOrderCreated();
            onClose();
        } catch (error: any) {
            console.error('Order creation error:', error);
            toast.error(error.message || 'Failed to create order');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700">
                    <h2 className="text-xl font-semibold text-white">Create New Order</h2>
                    <button
                        onClick={onClose}
                        className="text-white hover:bg-blue-800 rounded p-1 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Patient Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Patient *
                        </label>
                        <select
                            value={selectedPatient?.id || ''}
                            onChange={(e) => {
                                const patient = patients.find((p) => p.id === e.target.value);
                                setSelectedPatient(patient || null);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Choose a patient...</option>
                            {patients.map((patient) => (
                                <option key={patient.id} value={patient.id}>
                                    {patient.name} ({patient.display_id}) - {patient.phone}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Test Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tests *
                        </label>

                        {/* Selected Tests */}
                        {selectedTests.length > 0 && (
                            <div className="mb-3 space-y-2">
                                {selectedTests.map((test) => (
                                    <div
                                        key={test.id}
                                        className="flex items-center justify-between p-3 bg-blue-50 rounded-md"
                                    >
                                        <div>
                                            <span className="font-medium text-gray-900">{test.name}</span>
                                            <span className="ml-3 text-blue-600">₹{test.price}</span>
                                        </div>
                                        <button
                                            onClick={() => removeTest(test.id)}
                                            className="text-red-600 hover:bg-red-100 rounded p-1 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add Test Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                value={searchTest}
                                onChange={(e) => setSearchTest(e.target.value)}
                                placeholder="Search and add tests..."
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            />

                            {/* Test Dropdown */}
                            {searchTest && filteredTests.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    {filteredTests.map((test) => (
                                        <button
                                            key={test.id}
                                            onClick={() => addTest(test)}
                                            className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors flex justify-between items-center"
                                        >
                                            <span>{test.name}</span>
                                            <span className="text-blue-600 font-medium">₹{test.price}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Subtotal */}
                        <div className="mt-3 p-3 bg-gray-50 rounded-md flex justify-between items-center">
                            <span className="font-medium text-gray-700">Subtotal</span>
                            <span className="text-lg font-semibold text-gray-900">₹{subtotal.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Discount Section */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Discount (Optional)
                        </label>
                        <div className="flex gap-3">
                            {/* Discount Type */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setDiscountType('percentage')}
                                    className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${discountType === 'percentage'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    <Percent className="w-4 h-4" />
                                    %
                                </button>
                                <button
                                    onClick={() => setDiscountType('fixed')}
                                    className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${discountType === 'fixed'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    <DollarSign className="w-4 h-4" />
                                    ₹
                                </button>
                            </div>

                            {/* Discount Value */}
                            <input
                                type="number"
                                min="0"
                                max={discountType === 'percentage' ? 100 : subtotal}
                                value={discountValue}
                                onChange={(e) => setDiscountValue(Number(e.target.value))}
                                placeholder="Enter discount"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Discount Amount Display */}
                        {discountAmount > 0 && (
                            <div className="mt-2 p-2 bg-green-50 rounded text-green-700 text-sm">
                                Discount: -₹{discountAmount.toFixed(2)}
                            </div>
                        )}
                    </div>

                    {/* Final Amount */}
                    <div className="p-4 bg-blue-50 rounded-lg">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-lg font-semibold text-gray-900">Final Amount</span>
                            <span className="text-2xl font-bold text-blue-600">₹{finalAmount.toFixed(2)}</span>
                        </div>

                        {/* Payment Section */}
                        <div className="space-y-3 pt-3 border-t border-blue-200">
                            <div className="flex gap-3">
                                {/* Payment Method */}
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="cash">Cash</option>
                                    <option value="card">Card</option>
                                    <option value="upi">UPI</option>
                                    <option value="online">Online</option>
                                </select>

                                {/* Amount Paid */}
                                <input
                                    type="number"
                                    min="0"
                                    max={finalAmount}
                                    value={amountPaid}
                                    onChange={(e) => setAmountPaid(Number(e.target.value))}
                                    placeholder="Amount collected"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Payment Notes */}
                            <input
                                type="text"
                                value={paymentNotes}
                                onChange={(e) => setPaymentNotes(e.target.value)}
                                placeholder="Payment notes (optional)"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                            />

                            {/* Balance Due */}
                            {balanceDue !== 0 && (
                                <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                                    <span className="text-sm font-medium text-gray-700">
                                        {balanceDue > 0 ? 'Balance Due' : 'Change'}
                                    </span>
                                    <span className={`text-lg font-semibold ${balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        ₹{Math.abs(balanceDue).toFixed(2)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !selectedPatient || selectedTests.length === 0}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <Plus className="w-4 h-4" />
                                Create Order
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
