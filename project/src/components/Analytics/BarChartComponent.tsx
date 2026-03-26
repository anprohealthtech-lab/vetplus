import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';

interface BarSeries {
  key: string;
  name: string;
  color: string;
  stackId?: string;
}

interface BarChartComponentProps {
  data: Array<Record<string, any>>;
  xAxisKey: string;
  series: BarSeries[];
  title?: string;
  height?: number;
  formatYAxis?: (value: number) => string;
  formatTooltip?: (value: number) => string;
  showGrid?: boolean;
  showLegend?: boolean;
  layout?: 'vertical' | 'horizontal';
  barSize?: number;
}

export const BarChartComponent: React.FC<BarChartComponentProps> = ({
  data,
  xAxisKey,
  series,
  title,
  height = 300,
  formatYAxis = (v) => v.toLocaleString('en-IN'),
  formatTooltip = (v) => v.toLocaleString('en-IN'),
  showGrid = true,
  showLegend = true,
  layout = 'horizontal',
  barSize = 20,
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
          <BarChart 
            data={data} 
            layout={layout}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            {showGrid && (
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            )}
            {layout === 'horizontal' ? (
              <>
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
              </>
            ) : (
              <>
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickFormatter={formatYAxis}
                />
                <YAxis
                  dataKey={xAxisKey}
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  width={100}
                />
              </>
            )}
            <Tooltip content={<CustomTooltip />} />
            {showLegend && series.length > 1 && <Legend />}
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                fill={s.color}
                radius={[4, 4, 0, 0]}
                barSize={barSize}
                stackId={s.stackId}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
