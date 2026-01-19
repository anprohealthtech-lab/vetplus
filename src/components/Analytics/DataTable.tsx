import React from 'react';
import { ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';

interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T, index: number) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  title?: string;
  maxHeight?: string;
  onRowClick?: (row: T, index: number) => void;
  emptyMessage?: string;
  isLoading?: boolean;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  title,
  maxHeight = '400px',
  onRowClick,
  emptyMessage = 'No data available',
  isLoading = false,
  sortColumn,
  sortDirection,
  onSort,
}: DataTableProps<T>) {
  const getValue = (row: T, key: string) => {
    const keys = key.split('.');
    let value: any = row;
    for (const k of keys) {
      value = value?.[k];
    }
    return value;
  };

  const renderSortIcon = (column: Column<T>) => {
    if (!column.sortable || !onSort) return null;
    
    const isActive = sortColumn === column.key;
    
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSort(column.key as string);
        }}
        className="ml-1 inline-flex"
      >
        {isActive ? (
          sortDirection === 'asc' ? (
            <ChevronUp className="h-4 w-4 text-blue-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-blue-600" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 text-gray-400" />
        )}
      </button>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {title && (
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        </div>
      )}
      
      <div style={{ maxHeight, overflow: 'auto' }}>
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key as string}
                  className={`px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap ${
                    col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                  style={{ width: col.width }}
                >
                  <div className="flex items-center">
                    {col.header}
                    {renderSortIcon(col)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-500">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={`hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick?.(row, rowIndex)}
                >
                  {columns.map((col) => {
                    const value = getValue(row, col.key as string);
                    return (
                      <td
                        key={col.key as string}
                        className={`px-4 py-3 text-sm ${
                          col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {col.render ? col.render(value, row, rowIndex) : value ?? '-'}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
          Showing {data.length} {data.length === 1 ? 'row' : 'rows'}
        </div>
      )}
    </div>
  );
}
