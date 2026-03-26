import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface DonutChartProps {
  data: Array<{
    name: string;
    value: number;
    color?: string;
  }>;
  title?: string;
  centerLabel?: string;
  centerValue?: string | number;
  height?: number;
  showLegend?: boolean;
  formatValue?: (value: number) => string;
}

const DEFAULT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  title,
  centerLabel,
  centerValue,
  height = 300,
  showLegend = true,
  formatValue = (v) => v.toLocaleString('en-IN'),
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const percentage = ((item.value / total) * 100).toFixed(1);
      return (
        <div className="bg-white shadow-lg rounded-lg p-3 border border-gray-200">
          <p className="font-medium text-gray-800">{item.name}</p>
          <p className="text-sm text-gray-600">
            {formatValue(item.value)} ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = () => {
    return (
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {data.map((entry, index) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length] }}
            />
            <span className="text-xs text-gray-600">{entry.name}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {title && (
        <h3 className="text-sm font-semibold text-gray-800 mb-3">{title}</h3>
      )}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="80%"
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginTop: title ? '20px' : 0 }}>
            <div className="text-center">
              {centerValue && (
                <p className="text-2xl font-bold text-gray-800">
                  {typeof centerValue === 'number' ? formatValue(centerValue) : centerValue}
                </p>
              )}
              {centerLabel && (
                <p className="text-xs text-gray-500">{centerLabel}</p>
              )}
            </div>
          </div>
        )}
      </div>
      {showLegend && renderLegend()}
    </div>
  );
};
