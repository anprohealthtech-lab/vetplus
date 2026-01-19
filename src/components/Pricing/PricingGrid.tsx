import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Upload, 
  Download, 
  Save, 
  Loader2, 
  X, 
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { database, supabase } from '../../utils/supabase';

interface TestGroup {
  id: string;
  name: string;
  code: string;
  price: number;
  category: string;
}

interface Package {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface PriceEntry {
  id?: string;
  item_id: string;
  item_name: string;
  item_code?: string;
  item_type: 'test' | 'package';
  base_price: number;
  custom_price: number | null;
  lab_receivable?: number | null;
  cost?: number | null;
  effective_from?: string;
  notes?: string;
  is_modified: boolean;
}

interface PricingGridProps {
  entityType: 'location' | 'outsourced_lab' | 'account';
  entityId: string;
  entityName: string;
  showReceivable?: boolean; // For locations
  onSave?: () => void;
}

export const PricingGrid: React.FC<PricingGridProps> = ({
  entityType,
  entityId,
  entityName,
  showReceivable = false,
  onSave,
}) => {
  const [testGroups, setTestGroups] = useState<TestGroup[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [prices, setPrices] = useState<PriceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTestsOnly, setShowTestsOnly] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch test groups and packages
  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        const labId = await database.getCurrentUserLabId();
        if (!labId) return;

        // Fetch test groups
        const { data: tests } = await supabase
          .from('test_groups')
          .select('id, name, code, price, category')
          .eq('lab_id', labId)
          .eq('is_active', true)
          .order('name');

        // Fetch packages
        const { data: pkgs } = await supabase
          .from('packages')
          .select('id, name, price, category')
          .eq('lab_id', labId)
          .eq('is_active', true)
          .order('name');

        setTestGroups(tests || []);
        setPackages(pkgs || []);

        // Fetch existing prices
        await fetchExistingPrices(tests || [], pkgs || []);
      } catch (error) {
        console.error('Error fetching items:', error);
      } finally {
        setLoading(false);
      }
    };

    if (entityId) {
      fetchItems();
    }
  }, [entityId, entityType]);

  const fetchExistingPrices = async (tests: TestGroup[], pkgs: Package[]) => {
    try {
      let existingTestPrices: any[] = [];
      let existingPackagePrices: any[] = [];

      if (entityType === 'location') {
        const { data: testPrices } = await (database as any).locationTestPrices.getByLocation(entityId);
        existingTestPrices = testPrices || [];

        const { data: pkgPrices } = await (database as any).locationPackagePrices.getByLocation(entityId);
        existingPackagePrices = pkgPrices || [];
      } else if (entityType === 'outsourced_lab') {
        const { data: testPrices } = await (database as any).outsourcedLabPrices.getByOutsourcedLab(entityId);
        existingTestPrices = testPrices || [];
      } else if (entityType === 'account') {
        // Account test prices
        const { data: testPrices } = await supabase
          .from('account_prices')
          .select('*, test_group:test_groups(id, name, code, price)')
          .eq('account_id', entityId)
          .eq('is_active', true);
        existingTestPrices = testPrices || [];

        const { data: pkgPrices } = await (database as any).accountPackagePrices.getByAccount(entityId);
        existingPackagePrices = pkgPrices || [];
      }

      // Build price entries
      const priceMap = new Map<string, any>();

      // Map existing test prices
      existingTestPrices.forEach((p: any) => {
        const testId = p.test_group_id || p.test_group?.id;
        if (testId) {
          priceMap.set(`test_${testId}`, {
            id: p.id,
            custom_price: entityType === 'location' ? p.patient_price : (entityType === 'outsourced_lab' ? p.cost : p.price),
            lab_receivable: p.lab_receivable,
            cost: p.cost,
            effective_from: p.effective_from,
            notes: p.notes,
          });
        }
      });

      // Map existing package prices
      existingPackagePrices.forEach((p: any) => {
        const pkgId = p.package_id || p.package?.id;
        if (pkgId) {
          priceMap.set(`package_${pkgId}`, {
            id: p.id,
            custom_price: entityType === 'location' ? p.patient_price : p.price,
            lab_receivable: p.lab_receivable,
            effective_from: p.effective_from,
            notes: p.notes,
          });
        }
      });

      // Build full price list
      const allPrices: PriceEntry[] = [
        ...tests.map(t => {
          const existing = priceMap.get(`test_${t.id}`);
          return {
            item_id: t.id,
            item_name: t.name,
            item_code: t.code,
            item_type: 'test' as const,
            base_price: t.price,
            custom_price: existing?.custom_price ?? null,
            lab_receivable: existing?.lab_receivable ?? null,
            cost: existing?.cost ?? null,
            effective_from: existing?.effective_from,
            notes: existing?.notes,
            is_modified: false,
            id: existing?.id,
          };
        }),
        ...pkgs.map(p => {
          const existing = priceMap.get(`package_${p.id}`);
          return {
            item_id: p.id,
            item_name: p.name,
            item_type: 'package' as const,
            base_price: p.price,
            custom_price: existing?.custom_price ?? null,
            lab_receivable: existing?.lab_receivable ?? null,
            effective_from: existing?.effective_from,
            notes: existing?.notes,
            is_modified: false,
            id: existing?.id,
          };
        }),
      ];

      setPrices(allPrices);
    } catch (error) {
      console.error('Error fetching prices:', error);
    }
  };

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    testGroups.forEach(t => t.category && cats.add(t.category));
    packages.forEach(p => p.category && cats.add(p.category));
    return Array.from(cats).sort();
  }, [testGroups, packages]);

  // Filter prices
  const filteredPrices = useMemo(() => {
    return prices.filter(p => {
      // Type filter
      if (showTestsOnly && p.item_type === 'package') return false;
      if (!showTestsOnly && p.item_type === 'test') return false;

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!p.item_name.toLowerCase().includes(search) && 
            !(p.item_code?.toLowerCase().includes(search))) {
          return false;
        }
      }

      // Category filter
      if (filterCategory !== 'all') {
        const item = p.item_type === 'test' 
          ? testGroups.find(t => t.id === p.item_id)
          : packages.find(pkg => pkg.id === p.item_id);
        if (item && (item as any).category !== filterCategory) {
          return false;
        }
      }

      return true;
    });
  }, [prices, showTestsOnly, searchTerm, filterCategory, testGroups, packages]);

  // Group by category
  const groupedPrices = useMemo(() => {
    const groups: Record<string, PriceEntry[]> = {};
    filteredPrices.forEach(p => {
      const item = p.item_type === 'test' 
        ? testGroups.find(t => t.id === p.item_id)
        : packages.find(pkg => pkg.id === p.item_id);
      const category = (item as any)?.category || 'Other';
      if (!groups[category]) groups[category] = [];
      groups[category].push(p);
    });
    return groups;
  }, [filteredPrices, testGroups, packages]);

  // Handle price change
  const handlePriceChange = (itemId: string, field: 'custom_price' | 'lab_receivable' | 'cost', value: string) => {
    setPrices(prev => prev.map(p => {
      if (p.item_id === itemId) {
        return {
          ...p,
          [field]: value === '' ? null : parseFloat(value),
          is_modified: true,
        };
      }
      return p;
    }));
  };

  // Save all modified prices
  const handleSaveAll = async () => {
    setSaving(true);
    setSuccessMessage('');
    
    try {
      const modifiedPrices = prices.filter(p => p.is_modified);
      let successCount = 0;
      let errorCount = 0;

      for (const price of modifiedPrices) {
        try {
          if (entityType === 'location') {
            if (price.item_type === 'test' && price.custom_price !== null) {
              await (database as any).locationTestPrices.upsert({
                location_id: entityId,
                test_group_id: price.item_id,
                patient_price: price.custom_price,
                lab_receivable: price.lab_receivable,
              });
            } else if (price.item_type === 'package' && price.custom_price !== null) {
              await (database as any).locationPackagePrices.upsert({
                location_id: entityId,
                package_id: price.item_id,
                patient_price: price.custom_price,
                lab_receivable: price.lab_receivable,
              });
            }
          } else if (entityType === 'outsourced_lab') {
            if (price.cost !== null) {
              await (database as any).outsourcedLabPrices.upsert({
                outsourced_lab_id: entityId,
                test_group_id: price.item_id,
                cost: price.cost,
              });
            }
          } else if (entityType === 'account') {
            if (price.item_type === 'test' && price.custom_price !== null) {
              // Use existing account_prices table
              const { data: existing } = await supabase
                .from('account_prices')
                .select('id')
                .eq('account_id', entityId)
                .eq('test_group_id', price.item_id)
                .maybeSingle();

              if (existing) {
                await supabase
                  .from('account_prices')
                  .update({ price: price.custom_price, updated_at: new Date().toISOString() })
                  .eq('id', existing.id);
              } else {
                await supabase
                  .from('account_prices')
                  .insert({
                    account_id: entityId,
                    test_group_id: price.item_id,
                    price: price.custom_price,
                  });
              }
            } else if (price.item_type === 'package' && price.custom_price !== null) {
              await (database as any).accountPackagePrices.upsert({
                account_id: entityId,
                package_id: price.item_id,
                price: price.custom_price,
              });
            }
          }
          successCount++;
        } catch (err) {
          console.error('Error saving price:', err);
          errorCount++;
        }
      }

      // Clear modified flags
      setPrices(prev => prev.map(p => ({ ...p, is_modified: false })));
      
      setSuccessMessage(`Saved ${successCount} price${successCount !== 1 ? 's' : ''}${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      if (onSave) onSave();
    } catch (error) {
      console.error('Error saving prices:', error);
    } finally {
      setSaving(false);
    }
  };

  // Export to CSV
  const handleExport = () => {
    const headers = entityType === 'outsourced_lab'
      ? ['Code', 'Name', 'Type', 'Base Price', 'Cost']
      : showReceivable
        ? ['Code', 'Name', 'Type', 'Base Price', 'Patient Price', 'Lab Receivable']
        : ['Code', 'Name', 'Type', 'Base Price', 'Custom Price'];

    const rows = prices.map(p => {
      if (entityType === 'outsourced_lab') {
        return [p.item_code || '', p.item_name, p.item_type, p.base_price, p.cost || ''];
      } else if (showReceivable) {
        return [p.item_code || '', p.item_name, p.item_type, p.base_price, p.custom_price || '', p.lab_receivable || ''];
      } else {
        return [p.item_code || '', p.item_name, p.item_type, p.base_price, p.custom_price || ''];
      }
    });

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityName.replace(/\s+/g, '_')}_prices.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import from CSV
  const handleImport = () => {
    setImportErrors([]);
    const lines = importData.trim().split('\n');
    if (lines.length < 2) {
      setImportErrors(['CSV must have header row and at least one data row']);
      return;
    }

    const errors: string[] = [];
    const updates: { code: string; price: number; receivable?: number; cost?: number }[] = [];

    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      const code = cols[0];
      
      if (!code) {
        errors.push(`Row ${i + 1}: Missing code`);
        continue;
      }

      if (entityType === 'outsourced_lab') {
        const cost = parseFloat(cols[4]);
        if (isNaN(cost)) {
          errors.push(`Row ${i + 1}: Invalid cost`);
          continue;
        }
        updates.push({ code, price: 0, cost });
      } else if (showReceivable) {
        const price = parseFloat(cols[4]);
        const receivable = cols[5] ? parseFloat(cols[5]) : undefined;
        if (isNaN(price)) {
          errors.push(`Row ${i + 1}: Invalid patient price`);
          continue;
        }
        updates.push({ code, price, receivable });
      } else {
        const price = parseFloat(cols[4]);
        if (isNaN(price)) {
          errors.push(`Row ${i + 1}: Invalid price`);
          continue;
        }
        updates.push({ code, price });
      }
    }

    if (errors.length > 0) {
      setImportErrors(errors);
      return;
    }

    // Apply updates
    setPrices(prev => prev.map(p => {
      const update = updates.find(u => u.code === p.item_code);
      if (update) {
        return {
          ...p,
          custom_price: entityType === 'outsourced_lab' ? p.custom_price : update.price,
          cost: entityType === 'outsourced_lab' ? update.cost : p.cost,
          lab_receivable: update.receivable !== undefined ? update.receivable : p.lab_receivable,
          is_modified: true,
        };
      }
      return p;
    }));

    setShowImportModal(false);
    setImportData('');
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const hasModifiedPrices = prices.some(p => p.is_modified);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
            />
          </div>
          
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setShowTestsOnly(true)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                showTestsOnly ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tests
            </button>
            <button
              onClick={() => setShowTestsOnly(false)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                !showTestsOnly ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Packages
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {successMessage && (
            <span className="flex items-center gap-1 text-green-600 text-sm">
              <Check className="h-4 w-4" />
              {successMessage}
            </span>
          )}
          
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1 px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </button>
          
          <button
            onClick={handleExport}
            className="flex items-center gap-1 px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          
          <button
            onClick={handleSaveAll}
            disabled={!hasModifiedPrices || saving}
            className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Price Grid */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-600">
          <div className="col-span-1">Code</div>
          <div className="col-span-4">Name</div>
          <div className="col-span-2 text-right">Base Price</div>
          {entityType === 'outsourced_lab' ? (
            <div className="col-span-2 text-right">Cost (₹)</div>
          ) : (
            <>
              <div className="col-span-2 text-right">
                {entityType === 'location' ? 'Patient Price' : 'Custom Price'} (₹)
              </div>
              {showReceivable && (
                <div className="col-span-2 text-right">Lab Receivable (₹)</div>
              )}
            </>
          )}
          <div className="col-span-1"></div>
        </div>

        {/* Categories */}
        <div className="divide-y divide-gray-100">
          {Object.entries(groupedPrices).map(([category, items]) => (
            <div key={category}>
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-700">{category}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">{items.length} items</span>
                  {expandedCategories.has(category) ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Items */}
              {expandedCategories.has(category) && (
                <div className="divide-y divide-gray-50">
                  {items.map(price => (
                    <div
                      key={`${price.item_type}_${price.item_id}`}
                      className={`grid grid-cols-12 gap-2 px-4 py-2 items-center text-sm ${
                        price.is_modified ? 'bg-yellow-50' : ''
                      }`}
                    >
                      <div className="col-span-1 text-gray-500 font-mono text-xs">
                        {price.item_code || '-'}
                      </div>
                      <div className="col-span-4 text-gray-900 truncate" title={price.item_name}>
                        {price.item_name}
                      </div>
                      <div className="col-span-2 text-right text-gray-600">
                        ₹{price.base_price.toLocaleString()}
                      </div>
                      
                      {entityType === 'outsourced_lab' ? (
                        <div className="col-span-2">
                          <input
                            type="number"
                            value={price.cost ?? ''}
                            onChange={(e) => handlePriceChange(price.item_id, 'cost', e.target.value)}
                            placeholder="Enter cost"
                            className="w-full px-2 py-1 text-right border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="col-span-2">
                            <input
                              type="number"
                              value={price.custom_price ?? ''}
                              onChange={(e) => handlePriceChange(price.item_id, 'custom_price', e.target.value)}
                              placeholder={`${price.base_price}`}
                              className="w-full px-2 py-1 text-right border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          {showReceivable && (
                            <div className="col-span-2">
                              <input
                                type="number"
                                value={price.lab_receivable ?? ''}
                                onChange={(e) => handlePriceChange(price.item_id, 'lab_receivable', e.target.value)}
                                placeholder="% based"
                                className="w-full px-2 py-1 text-right border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                          )}
                        </>
                      )}
                      
                      <div className="col-span-1 text-right">
                        {price.is_modified && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            Modified
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredPrices.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No items found matching your criteria
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Import Prices from CSV</h3>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Paste CSV data below. Format: {entityType === 'outsourced_lab' 
                  ? 'Code, Name, Type, Base Price, Cost'
                  : showReceivable
                    ? 'Code, Name, Type, Base Price, Patient Price, Lab Receivable (optional)'
                    : 'Code, Name, Type, Base Price, Custom Price'
                }
              </p>
              
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="Paste CSV here..."
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500"
              />

              {importErrors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 font-medium mb-1">
                    <AlertCircle className="h-4 w-4" />
                    Import Errors
                  </div>
                  <ul className="text-sm text-red-600 list-disc list-inside">
                    {importErrors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {importErrors.length > 5 && <li>...and {importErrors.length - 5} more</li>}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingGrid;
