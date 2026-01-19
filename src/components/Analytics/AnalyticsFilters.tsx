import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Building2, Filter, X, RefreshCw } from 'lucide-react';
import { database } from '../../utils/supabase';

interface FiltersState {
  dateRange: {
    from: Date;
    to: Date;
  };
  locationId: string | null;
  department: string | null;
  accountId: string | null;
}

interface AnalyticsFiltersProps {
  labId: string;
  filters: FiltersState;
  onFiltersChange: (filters: FiltersState) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

const PRESET_RANGES = [
  { label: 'Today', days: 0 },
  { label: 'Yesterday', days: 1 },
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'This Month', days: -1 }, // Special case
  { label: 'Last Month', days: -2 }, // Special case
];

const DEPARTMENTS = [
  'Hematology',
  'Biochemistry',
  'Microbiology',
  'Pathology',
  'Immunology',
  'Serology',
  'Radiology',
  'Cytology',
];

export const AnalyticsFilters: React.FC<AnalyticsFiltersProps> = ({
  labId,
  filters,
  onFiltersChange,
  onRefresh,
  isLoading = false,
}) => {
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    loadFilterOptions();
  }, [labId]);

  const loadFilterOptions = async () => {
    // Load locations
    const { data: locs } = await database.locations.getAll();
    if (locs) {
      setLocations(locs.map((l: any) => ({ id: l.id, name: l.name })));
    }

    // Load accounts
    try {
      const { data: accs } = await (database as any).accounts?.getAll?.() || { data: null };
      if (accs) {
        setAccounts(accs.map((a: any) => ({ id: a.id, name: a.name })));
      }
    } catch (err) {
      console.warn('Could not load accounts:', err);
    }
  };

  const applyPreset = (preset: typeof PRESET_RANGES[number]) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let from: Date;
    let to = new Date(today);

    if (preset.days === 0) {
      // Today
      from = new Date(today);
      from.setHours(0, 0, 0, 0);
    } else if (preset.days === 1) {
      // Yesterday
      from = new Date(today);
      from.setDate(from.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to = new Date(from);
      to.setHours(23, 59, 59, 999);
    } else if (preset.days === -1) {
      // This Month
      from = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (preset.days === -2) {
      // Last Month
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      to = new Date(today.getFullYear(), today.getMonth(), 0);
    } else {
      // Last N days
      from = new Date(today);
      from.setDate(from.getDate() - preset.days);
      from.setHours(0, 0, 0, 0);
    }

    onFiltersChange({
      ...filters,
      dateRange: { from, to },
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const clearFilters = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const from = new Date(today);
    from.setDate(from.getDate() - 7);
    from.setHours(0, 0, 0, 0);

    onFiltersChange({
      dateRange: { from, to: today },
      locationId: null,
      department: null,
      accountId: null,
    });
  };

  const hasActiveFilters = filters.locationId || filters.department || filters.accountId;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      {/* Date Range Row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="h-4 w-4" />
          <span className="font-medium">Date Range:</span>
        </div>
        
        {/* Preset buttons */}
        <div className="flex flex-wrap gap-2">
          {PRESET_RANGES.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom date inputs */}
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="date"
            value={filters.dateRange.from.toISOString().split('T')[0]}
            onChange={(e) => {
              const from = new Date(e.target.value);
              onFiltersChange({
                ...filters,
                dateRange: { ...filters.dateRange, from },
              });
            }}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={filters.dateRange.to.toISOString().split('T')[0]}
            onChange={(e) => {
              const to = new Date(e.target.value);
              onFiltersChange({
                ...filters,
                dateRange: { ...filters.dateRange, to },
              });
            }}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Filter Toggle & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
        >
          <Filter className="h-4 w-4" />
          <span>{showAdvanced ? 'Hide Filters' : 'More Filters'}</span>
          {hasActiveFilters && (
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
          {/* Location Filter */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <MapPin className="h-4 w-4" />
              Location
            </label>
            <select
              value={filters.locationId || ''}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  locationId: e.target.value || null,
                })
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Building2 className="h-4 w-4" />
              Department
            </label>
            <select
              value={filters.department || ''}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  department: e.target.value || null,
                })
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Departments</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Account Filter (B2B) */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Building2 className="h-4 w-4" />
              Account (B2B)
            </label>
            <select
              value={filters.accountId || ''}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  accountId: e.target.value || null,
                })
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Accounts</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Active filters summary */}
      <div className="text-xs text-gray-500 mt-3">
        Showing data from <span className="font-medium">{formatDate(filters.dateRange.from)}</span> to{' '}
        <span className="font-medium">{formatDate(filters.dateRange.to)}</span>
        {filters.locationId && (
          <span className="ml-2 text-blue-600">
            • {locations.find((l) => l.id === filters.locationId)?.name || 'Selected Location'}
          </span>
        )}
        {filters.department && (
          <span className="ml-2 text-green-600">• {filters.department}</span>
        )}
        {filters.accountId && (
          <span className="ml-2 text-purple-600">
            • {accounts.find((a) => a.id === filters.accountId)?.name || 'Selected Account'}
          </span>
        )}
      </div>
    </div>
  );
};
