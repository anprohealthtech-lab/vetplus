import React, { useState, useEffect } from 'react';
import { Search, FlaskConical, Filter, Loader } from 'lucide-react';
import { supabase } from '../../utils/supabase';

interface TestItem {
    id: string;
    name: string;
    category?: string;
    price?: number;
}

const TestsOffered: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [tests, setTests] = useState<TestItem[]>([]);
    const [loading, setLoading] = useState(true);
    const labId = 'b2b7b466-54b8-4935-ab90-b8c16643912f'; // Vetplus Diagnostics ID

    useEffect(() => {
        const fetchTests = async () => {
            setLoading(true);
            try {
                // Fetch tests for this specific lab and global tests
                const { data, error } = await supabase
                    .from('test_groups')
                    .select('id, name, category, price')
                    .eq('is_active', true)
                    .or(`lab_id.eq.${labId},lab_id.is.null`)
                    .order('name');
                
                if (error) {
                    console.error("Error fetching tests:", error);
                } else if (data) {
                    setTests(data);
                }
            } catch (err) {
                console.error("Failed to load tests", err);
            } finally {
                setLoading(false);
            }
        };

        fetchTests();
    }, []);

    const filteredTests = tests.filter(test => 
        test.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (test.category && test.category.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="py-16 bg-gray-50 min-h-[80vh]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Tests Offered</h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Explore our comprehensive catalog of pathology tests and health packages.
                    </p>
                </div>

                {/* Search Bar */}
                <div className="max-w-2xl mx-auto mb-12 relative">
                    <div className="relative shadow-md rounded-2xl bg-white overflow-hidden flex items-center p-2 border border-gray-200">
                        <Search className="h-6 w-6 text-gray-400 ml-3" />
                        <input 
                            type="text" 
                            placeholder="Search for a test (e.g., CBC, Thyroid, LFT)..." 
                            className="w-full pl-4 pr-4 py-3 outline-none text-lg text-gray-700 bg-transparent"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="p-2 text-gray-400 hover:text-gray-600">
                                <span className="sr-only">Clear</span>
                                &times;
                            </button>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                        <p className="text-gray-500">Loading catalog...</p>
                    </div>
                ) : (
                    <>
                        <div className="mb-6 flex flex-wrap gap-2">
                            <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                                <Filter className="w-4 h-4 mr-1" />
                                {filteredTests.length} Tests Found
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredTests.length > 0 ? (
                                filteredTests.map((test) => (
                                    <div key={test.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow p-6 flex flex-col items-start h-full">
                                        <div className="bg-blue-50 p-3 rounded-lg mb-4 text-blue-600">
                                            <FlaskConical className="h-6 w-6" />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">
                                            {test.name}
                                        </h3>
                                        <div className="mt-auto pt-4 flex w-full justify-between items-end">
                                            <div>
                                                {test.category && (
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">
                                                        {test.category}
                                                    </span>
                                                )}
                                                {test.price ? (
                                                    <span className="text-lg font-bold text-blue-600">₹{test.price.toLocaleString('en-IN')}</span>
                                                ) : (
                                                    <span className="text-sm font-medium text-gray-400">Price on request</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
                                    <FlaskConical className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">No tests found</h3>
                                    <p className="text-gray-500">Try adjusting your search terms.</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TestsOffered;
