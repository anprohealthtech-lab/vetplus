import React, { useState, useEffect } from 'react';
import { X, Search, Calendar, User, Loader, Package, FlaskConical, Info } from 'lucide-react';
import { supabase } from '../../utils/supabase';

interface WebsiteBookingModalProps {
    labId: string;
    onClose: () => void;
    onSuccess: () => void;
}

interface CatalogItem {
    id: string;
    name: string;
    price: number;
    type: 'test' | 'package';
    category?: string;
    includedTests?: string[];
}

const WebsiteBookingModal: React.FC<WebsiteBookingModalProps> = ({ labId, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<CatalogItem[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedItems, setSelectedItems] = useState<CatalogItem[]>([]);

    const [patient, setPatient] = useState({
        name: '',
        age: '',
        gender: 'Male',
        phone: '',
        email: '',
        address: ''
    });

    const [scheduledDate, setScheduledDate] = useState('');

    useEffect(() => {
        if (searchTerm.length < 2) {
            setSearchResults([]);
            return;
        }

        const doSearch = async () => {
            setSearching(true);
            try {
                const term = `%${searchTerm}%`;

                const [testsResult, packagesResult] = await Promise.all([
                    supabase
                        .from('test_groups')
                        .select('id, name, price, category, code')
                        .eq('is_active', true)
                        .or(`lab_id.eq.${labId},lab_id.is.null`)
                        .ilike('name', term)
                        .limit(8),
                    supabase
                        .from('packages')
                        .select(`
                            id, name, price, category,
                            package_test_groups(
                                test_groups(id, name)
                            )
                        `)
                        .eq('is_active', true)
                        .eq('lab_id', labId)
                        .ilike('name', term)
                        .limit(4)
                ]);

                const tests: CatalogItem[] = (testsResult.data || []).map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    price: t.price || 0,
                    type: 'test',
                    category: t.category,
                }));

                const packages: CatalogItem[] = (packagesResult.data || []).map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    price: p.price || 0,
                    type: 'package',
                    category: p.category,
                    includedTests: (p.package_test_groups || [])
                        .map((ptg: any) => ptg.test_groups?.name)
                        .filter(Boolean),
                }));

                setSearchResults([...packages, ...tests]);
            } finally {
                setSearching(false);
            }
        };

        const debounce = setTimeout(doSearch, 300);
        return () => clearTimeout(debounce);
    }, [searchTerm, labId]);

    const handleAdd = (item: CatalogItem) => {
        if (!selectedItems.find(s => s.id === item.id)) {
            setSelectedItems(prev => [...prev, item]);
        }
        setSearchTerm('');
        setSearchResults([]);
    };

    const handleRemove = (id: string) => {
        setSelectedItems(prev => prev.filter(s => s.id !== id));
    };

    const totalAmount = selectedItems.reduce((sum, item) => sum + (item.price || 0), 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedItems.length === 0) return;
        setLoading(true);

        try {
            const { error } = await supabase.from('bookings').insert([{
                lab_id: labId,
                status: 'pending',
                booking_source: 'public_website',
                account_id: null,
                patient_info: {
                    name: patient.name,
                    age: patient.age,
                    gender: patient.gender,
                    phone: patient.phone,
                    email: patient.email || undefined,
                    address: patient.address || undefined
                },
                test_details: selectedItems.map(item => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    type: item.type,
                })),
                scheduled_at: scheduledDate ? new Date(scheduledDate).toISOString() : null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }]);

            if (error) throw error;

            onSuccess();
        } catch (err: any) {
            console.error('Error creating home collection booking:', err);
            alert('Failed to submit booking: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-blue-50 rounded-t-xl">
                    <h2 className="text-xl font-bold text-blue-900">Book Home Collection</h2>
                    <button onClick={onClose} className="p-2 hover:bg-blue-100 rounded-full text-blue-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <User className="w-4 h-4" /> Pet & Owner Details
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Pet Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={patient.name}
                                    onChange={e => setPatient({ ...patient, name: e.target.value })}
                                    className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none border-gray-300"
                                    placeholder="Pet's Name"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Owner's Phone *</label>
                                <input
                                    type="tel"
                                    required
                                    value={patient.phone}
                                    onChange={e => setPatient({ ...patient, phone: e.target.value })}
                                    className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none border-gray-300"
                                    placeholder="Mobile Number"
                                />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Pet's Age *</label>
                                    <input
                                        type="number"
                                        required
                                        value={patient.age}
                                        onChange={e => setPatient({ ...patient, age: e.target.value })}
                                        className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none border-gray-300"
                                        placeholder="Age (Years/Months)"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Pet's Gender</label>
                                    <select
                                        value={patient.gender}
                                        onChange={e => setPatient({ ...patient, gender: e.target.value })}
                                        className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none border-gray-300"
                                    >
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Owner's Email (optional)</label>
                                <input
                                    type="email"
                                    value={patient.email}
                                    onChange={e => setPatient({ ...patient, email: e.target.value })}
                                    className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none border-gray-300"
                                    placeholder="Email address"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Collection Address *</label>
                                <textarea
                                    required
                                    rows={2}
                                    value={patient.address}
                                    onChange={e => setPatient({ ...patient, address: e.target.value })}
                                    className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none border-gray-300"
                                    placeholder="Full home address for sample collection"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Preferred Schedule
                        </h3>
                        <input
                            type="datetime-local"
                            required
                            value={scheduledDate}
                            onChange={e => setScheduledDate(e.target.value)}
                            className="w-full md:w-1/2 border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none border-gray-300"
                        />
                    </div>

                    <div className="space-y-3 pt-4 border-t border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Search className="w-4 h-4" /> Add Tests or Packages
                        </h3>

                        <div className="flex items-start gap-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                            <span>Search for tests to get an estimated cost. Final prices may be adjusted at the time of collection.</span>
                        </div>

                        <div className="relative">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full border rounded-lg p-2.5 pl-9 pr-9 focus:ring-2 focus:ring-blue-500 outline-none border-gray-300"
                                    placeholder="Search tests..."
                                />
                                {searching && (
                                    <Loader className="absolute right-3 top-3 w-4 h-4 text-gray-400 animate-spin" />
                                )}
                            </div>

                            {searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 mt-1 rounded-lg shadow-lg max-h-64 overflow-y-auto z-10">
                                    {searchResults.map(item => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => handleAdd(item)}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        {item.type === 'package' ? (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 flex-shrink-0">
                                                                <Package className="w-2.5 h-2.5" /> PKG
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 flex-shrink-0">
                                                                <FlaskConical className="w-2.5 h-2.5" /> TEST
                                                            </span>
                                                        )}
                                                        <span className="font-medium text-gray-800 text-sm truncate">{item.name}</span>
                                                    </div>
                                                </div>
                                                <span className="text-sm font-semibold text-gray-700 flex-shrink-0">
                                                    ₹{item.price.toLocaleString('en-IN')}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {selectedItems.length > 0 && (
                            <div className="space-y-2 mt-2">
                                {selectedItems.map(item => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <span className="text-sm font-semibold text-gray-700">
                                                ₹{item.price.toLocaleString('en-IN')}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemove(item.id)}
                                                className="text-red-400 hover:text-red-600"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                <div className="flex justify-between items-center px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                                    <span className="text-sm font-medium text-blue-700">Estimated Total</span>
                                    <span className="text-sm font-bold text-blue-800">
                                        ₹{totalAmount.toLocaleString('en-IN')}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </form>

                <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || selectedItems.length === 0 || !patient.name || !patient.phone || !patient.age || !patient.address || !scheduledDate}
                        className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading && <Loader className="w-4 h-4 animate-spin" />}
                        Confirm Booking
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WebsiteBookingModal;
