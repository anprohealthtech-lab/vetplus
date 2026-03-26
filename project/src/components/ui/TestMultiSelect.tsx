import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check, Package, Clock, TestTube, AlertCircle } from 'lucide-react';

interface TestOption {
  id: string;
  name: string;
  price: number;
  category?: string;
  clinicalPurpose?: string;
  sampleType?: string;
  turnaroundTime?: string;
  requiresFasting?: boolean;
}

interface TestMultiSelectProps {
  options: TestOption[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  maxHeight?: string;
}

const TestMultiSelect: React.FC<TestMultiSelectProps> = ({
  options,
  selectedIds,
  onChange,
  placeholder = "Select tests",
  searchPlaceholder = "Search tests...",
  className = "",
  disabled = false,
  loading = false,
  maxHeight = "max-h-80"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const selectRef = useRef<HTMLDivElement>(null);

  const selectedOptions = options.filter(opt => selectedIds.includes(opt.id));
  const totalAmount = selectedOptions.reduce((sum, test) => sum + test.price, 0);

  // Filter and group options by category
  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.clinicalPurpose?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedOptions = filteredOptions.reduce((groups, option) => {
    const category = option.category || 'Other';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(option);
    return groups;
  }, {} as Record<string, TestOption[]>);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset search when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const handleToggleOption = (optionId: string) => {
    const newSelected = selectedIds.includes(optionId)
      ? selectedIds.filter(id => id !== optionId)
      : [...selectedIds, optionId];
    onChange(newSelected);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const renderTestOption = (test: TestOption, isSelected: boolean) => (
    <div className="flex items-start space-x-3">
      <div className={`
        w-4 h-4 mt-0.5 border-2 rounded flex-shrink-0 flex items-center justify-center
        ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}
      `}>
        {isSelected && <Check className="h-3 w-3 text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="font-medium text-gray-900 truncate">{test.name}</div>
          <div className="ml-2 font-bold text-green-600">₹{test.price}</div>
        </div>
        {test.clinicalPurpose && (
          <div className="text-xs text-gray-600 mt-1 line-clamp-2">{test.clinicalPurpose}</div>
        )}
        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
          {test.sampleType && (
            <div className="flex items-center">
              <TestTube className="h-3 w-3 mr-1" />
              {test.sampleType}
            </div>
          )}
          {test.turnaroundTime && (
            <div className="flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              {test.turnaroundTime}
            </div>
          )}
          {test.requiresFasting && (
            <div className="flex items-center text-orange-600">
              <AlertCircle className="h-3 w-3 mr-1" />
              Fasting required
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div ref={selectRef} className={`relative ${className}`}>
      {/* Select Button */}
      <button
        type="button"
        onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className={`
          w-full px-3 py-2 text-left bg-white border border-gray-300 rounded-md shadow-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          ${disabled || loading ? 'bg-gray-50 cursor-not-allowed' : 'hover:border-gray-400 cursor-pointer'}
          ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}
        `}
      >
        <div className="flex items-center justify-between min-h-[20px]">
          {loading ? (
            <span className="text-gray-500">Loading tests...</span>
          ) : selectedIds.length > 0 ? (
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">
                  {selectedIds.length} test{selectedIds.length !== 1 ? 's' : ''} selected
                </span>
                <span className="font-bold text-green-600">₹{totalAmount}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1 truncate">
                {selectedOptions.slice(0, 2).map(test => test.name).join(', ')}
                {selectedOptions.length > 2 && ` +${selectedOptions.length - 2} more`}
              </div>
            </div>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
          
          <div className="flex items-center ml-2">
            {selectedIds.length > 0 && !disabled && (
              <X
                className="h-4 w-4 text-gray-400 hover:text-gray-600 mr-1"
                onClick={handleClearAll}
              />
            )}
            <ChevronDown
              className={`h-4 w-4 text-gray-400 transform transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
            {selectedIds.length > 0 && (
              <div className="mt-2 text-xs text-gray-600">
                {selectedIds.length} selected • Total: ₹{totalAmount}
              </div>
            )}
          </div>

          {/* Options List */}
          <div className={`${maxHeight} overflow-y-auto`}>
            {Object.keys(groupedOptions).length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">
                No tests found matching "{searchTerm}"
              </div>
            ) : (
              Object.entries(groupedOptions).map(([category, tests]) => (
                <div key={category}>
                  {/* Category Header */}
                  <div className="sticky top-0 bg-gray-50 px-3 py-2 border-b border-gray-200">
                    <div className="flex items-center">
                      <Package className="h-4 w-4 text-gray-600 mr-2" />
                      <span className="font-medium text-gray-700">{category}</span>
                      <span className="ml-2 text-xs text-gray-500">({tests.length})</span>
                    </div>
                  </div>
                  
                  {/* Tests in Category */}
                  {tests.map((test) => (
                    <button
                      key={test.id}
                      type="button"
                      onClick={() => handleToggleOption(test.id)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      {renderTestOption(test, selectedIds.includes(test.id))}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestMultiSelect;
