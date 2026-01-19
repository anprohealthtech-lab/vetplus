import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface DataSeries {
  key: string;
  name: string;
  color: string;
  type?: 'area' | 'line';
}

interface AreaLineChartProps {
  data: Array<Record<string, any>>;
  xAxisKey: string;
  series: DataSeries[];
  title?: string;
  height?: number;
  formatYAxis?: (value: number) => string;
  formatTooltip?: (value: number) => string;
  showGrid?: boolean;
  showLegend?: boolean;
}

export const AreaLineChart: React.FC<AreaLineChartProps> = ({
  data,
  xAxisKey,
  series,
  title,
  height = 300,
  formatYAxis = (v) => `₹${(v / 1000).toFixed(0)}K`,
  formatTooltip = (v) => `₹${v.toLocaleString('en-IN')}`,
  showGrid = true,
  showLegend = true,
}) => {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white shadow-lg rounded-lg p-3 border border-gray-200">
          <p className="font-medium text-gray-800 mb-2">{label}</p>
          {payload.map((item: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-gray-600">{item.name}:</span>
              <span className="font-medium">{formatTooltip(item.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {title && (
        <h3 className="text-sm font-semibold text-gray-800 mb-4">{title}</h3>
      )}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            {showGrid && (
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            )}
            <XAxis
              dataKey={xAxisKey}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={formatYAxis}
            />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.1}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
