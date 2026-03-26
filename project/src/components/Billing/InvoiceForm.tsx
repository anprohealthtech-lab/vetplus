import React, { useState, useEffect } from 'react';
import { X, User, Calendar, DollarSign, Plus, Minus, Trash2, Calculator } from 'lucide-react';
import { database } from '../../utils/supabase';

interface InvoiceFormProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
}

interface Patient {
  id: string;
  name: string;
}

interface Order {
  id: string;
  total_amount: number;
  order_date: string;
  status: string;
  tests: string[];
  order_tests?: Array<{ test_name: string }>;
}

interface InvoiceItem {
  test_name: string;
  price: number;
  quantity: number;
  total: number;
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({ onClose, onSubmit }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    patientId: '',
    orderId: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 15 days from now
    paymentMethod: '',
    notes: '',
    items: [] as InvoiceItem[],
    discount: 0,
    taxRate: 18, // 18% GST
  });

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Load patients on component mount
  useEffect(() => {
    fetchPatients();
  }, []);

  // Load orders when patient is selected
  useEffect(() => {
    if (formData.patientId) {
      fetchOrders(formData.patientId);
    } else {
      setOrders([]);
    }
  }, [formData.patientId]);

  // Load order details when order is selected
  useEffect(() => {
    if (formData.orderId) {
      fetchOrderDetails(formData.orderId);
    } else {
      // Clear items if no order is selected
      setFormData(prev => ({
        ...prev,
        items: []
      }));
    }
  }, [formData.orderId]);

  const fetchPatients = async () => {
    setLoadingPatients(true);
    setError(null);
    
    try {
      const { data, error } = await database.patients.getAll();
      
      if (error) {
        setError(error.message);
        console.error('Error loading patients:', error);
      } else {
        setPatients(data || []);
      }
    } catch (err) {
      setError('Failed to load patients');
      console.error('Error:', err);
    } finally {
      setLoadingPatients(false);
    }
  };

  const fetchOrders = async (patientId: string) => {
    setLoadingOrders(true);
    setError(null);
    
    try {
      const { data, error } = await database.orders.getAll();
      
      if (error) {
        setError(error.message);
        console.error('Error loading orders:', error);
      } else {
        // Filter orders for the selected patient
        const patientOrders = (data || []).filter(order => order.patient_id === patientId);
        setOrders(patientOrders);
      }
    } catch (err) {
      setError('Failed to load orders');
      console.error('Error:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchOrderDetails = async (orderId: string) => {
    try {
      const { data, error } = await database.orders.getById(orderId);
      
      if (error) {
        setError(error.message);
        console.error('Error loading order details:', error);
        return;
      }
      
      if (data) {
        // Create invoice items from order tests
        const items: InvoiceItem[] = [];
        
        // Check if order_tests exists and has items
        if (data.order_tests && data.order_tests.length > 0) {
          // Use order_tests for test names
          data.order_tests.forEach((test: any) => {
            items.push({
              test_name: test.test_name,
              price: 500, // Default price if not available
              quantity: 1,
              total: 500
            });
          });
        } else if (data.tests && data.tests.length > 0) {
          // Fallback to tests array if order_tests is not available
          data.tests.forEach((testName: string) => {
            items.push({
              test_name: testName,
              price: 500, // Default price if not available
              quantity: 1,
              total: 500
            });
          });
        }
        
        // Update form data with items
        setFormData(prev => ({
          ...prev,
          items
        }));
      }
    } catch (err) {
      setError('Failed to load order details');
      console.error('Error:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'patientId') {
      const patient = patients.find(p => p.id === value);
      setSelectedPatient(patient || null);
      
      // Reset order selection when patient changes
      setFormData(prev => ({
        ...prev,
        [name]: value,
        orderId: '',
        items: []
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      
      if (field === 'price' || field === 'quantity') {
        const numValue = parseFloat(value) || 0;
        newItems[index][field] = numValue;
        
        // Recalculate total for this item
        newItems[index].total = newItems[index].price * newItems[index].quantity;
      } else {
        newItems[index][field] = value;
      }
      
      return {
        ...prev,
        items: newItems
      };
    });
  };

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          test_name: '',
          price: 0,
          quantity: 1,
          total: 0
        }
      ]
    }));
  };

  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => sum + item.total, 0);
  };

  const calculateTax = () => {
    return (calculateSubtotal() - formData.discount) * (formData.taxRate / 100);
  };

  const calculateTotal = () => {
    return calculateSubtotal() - formData.discount + calculateTax();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.patientId || formData.items.length === 0) {
      setError('Please select a patient and add at least one item');
      return;
    }
    
    const subtotal = calculateSubtotal();
    const tax = calculateTax();
    const total = calculateTotal();
    
    // Prepare data for Supabase (snake_case)
    const invoiceData = {
      patient_id: formData.patientId,
      order_id: formData.orderId || null,
      patient_name: selectedPatient?.name || '',
      subtotal,
      discount: formData.discount,
      tax,
      total,
      status: 'Draft',
      invoice_date: formData.invoiceDate,
      due_date: formData.dueDate,
      payment_method: formData.paymentMethod || null,
      notes: formData.notes || null,
      invoice_items: formData.items.map(item => ({
        test_name: item.test_name,
        price: item.price,
        quantity: item.quantity,
        total: item.total
      }))
    };
    
    onSubmit(invoiceData);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create New Invoice</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 p-1 rounded"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-red-700">{error}</div>
              <button 
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 text-sm mt-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Patient & Order Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <User className="h-5 w-5 mr-2" />
              Patient & Order Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Patient *
                </label>
                {loadingPatients ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                    Loading patients...
                  </div>
                ) : (
                  <select
                    name="patientId"
                    required
                    value={formData.patientId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a patient</option>
                    {patients.map(patient => (
                      <option key={patient.id} value={patient.id}>
                        {patient.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Order (Optional)
                </label>
                {loadingOrders ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                    Loading orders...
                  </div>
                ) : (
                  <select
                    name="orderId"
                    value={formData.orderId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">No order (manual invoice)</option>
                    {orders.map(order => (
                      <option key={order.id} value={order.id}>
                        {order.id} - ₹{order.total_amount} ({new Date(order.order_date).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Invoice Details
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Date *
                </label>
                <input
                  type="date"
                  name="invoiceDate"
                  required
                  value={formData.invoiceDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date *
                </label>
                <input
                  type="date"
                  name="dueDate"
                  required
                  value={formData.dueDate}
                  onChange={handleChange}
                  min={formData.invoiceDate}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Payment Method</option>
                  <option value="Cash">Cash</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Debit Card">Debit Card</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Insurance">Insurance</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                rows={2}
                value={formData.notes}
                onChange={handleChange}
                placeholder="Any additional notes or payment instructions..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Invoice Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Invoice Items
              </h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Test/Service
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Price (₹)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Total (₹)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {formData.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                        No items added. Select an order or add items manually.
                      </td>
                    </tr>
                  ) : (
                    formData.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.test_name}
                            onChange={(e) => handleItemChange(index, 'test_name', e.target.value)}
                            placeholder="Test or service name"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-2 font-medium">
                          ₹{item.total.toFixed(2)}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Invoice Summary */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Subtotal:</span>
                <span className="font-medium">₹{calculateSubtotal().toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <span className="text-gray-700 mr-2">Discount:</span>
                  <input
                    type="number"
                    min="0"
                    name="discount"
                    value={formData.discount}
                    onChange={handleChange}
                    className="w-24 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <span className="font-medium">₹{formData.discount.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <span className="text-gray-700 mr-2">Tax Rate:</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    name="taxRate"
                    value={formData.taxRate}
                    onChange={handleChange}
                    className="w-16 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="ml-1">%</span>
                </div>
                <span className="font-medium">₹{calculateTax().toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center pt-2 border-t border-gray-300 font-bold">
                <span>Total:</span>
                <span>₹{calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Create Invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InvoiceForm;