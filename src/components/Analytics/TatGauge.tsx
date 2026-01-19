import React from 'react';

interface TatGaugeProps {
  value: number; // Average TAT in hours
  target: number; // Target TAT in hours
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const TatGauge: React.FC<TatGaugeProps> = ({
  value,
  target,
  label,
  size = 'md',
}) => {
  const percentage = Math.min((value / target) * 100, 150); // Cap at 150%
  const isGood = value <= target;
  const isCritical = value > target * 1.2; // 20% over target

  const sizeClasses = {
    sm: { outer: 'w-24 h-24', text: 'text-lg', label: 'text-xs' },
    md: { outer: 'w-32 h-32', text: 'text-2xl', label: 'text-sm' },
    lg: { outer: 'w-40 h-40', text: 'text-3xl', label: 'text-base' },
  };

  const getColor = () => {
    if (isGood) return '#10B981'; // green
    if (isCritical) return '#EF4444'; // red
    return '#F59E0B'; // amber
  };

  const strokeColor = getColor();
  const circumference = 2 * Math.PI * 45; // radius of 45
  const strokeDashoffset = circumference - (Math.min(percentage, 100) / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className={`${sizeClasses[size].outer} relative`}>
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
          {/* Overflow indicator (if over 100%) */}
          {percentage > 100 && (
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#EF4444"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${((percentage - 100) / 50) * circumference} ${circumference}`}
              className="transition-all duration-500"
              opacity="0.5"
            />
          )}
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`${sizeClasses[size].text} font-bold`} style={{ color: strokeColor }}>
            {value.toFixed(1)}h
          </span>
          <span className="text-xs text-gray-500">/ {target}h target</span>
        </div>
      </div>
      {label && (
        <span className={`${sizeClasses[size].label} text-gray-600 mt-2 font-medium`}>
          {label}
        </span>
      )}
      {/* Status indicator */}
      <div className={`flex items-center gap-1 mt-1 ${sizeClasses[size].label}`}>
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: strokeColor }}
        />
        <span className="text-gray-500">
          {isGood ? 'On Track' : isCritical ? 'Critical' : 'Warning'}
        </span>
      </div>
    </div>
  );
};
