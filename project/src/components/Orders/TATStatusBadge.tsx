import React from 'react';
import { Clock, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

interface TATStatusBadgeProps {
    hoursUntilBreach: number | null;
    isBreached: boolean | null;
    tatHours: number | null;
    compact?: boolean;
}

export const TATStatusBadge: React.FC<TATStatusBadgeProps> = ({
    hoursUntilBreach,
    isBreached,
    tatHours,
    compact = false
}) => {
    if (tatHours === null || tatHours === undefined) {
        return null; // Not applicable
    }

    // Determine status
    let status: 'breached' | 'warning' | 'good' | 'neutral' = 'neutral';

    if (isBreached) {
        status = 'breached';
    } else if (hoursUntilBreach !== null) {
        if (hoursUntilBreach < 0) {
            status = 'breached'; // Should match isBreached, safety check
        } else if (hoursUntilBreach < Math.min(2, tatHours * 0.2)) {
            status = 'warning'; // Less than 2 hours or 20% of TAT remaining
        } else {
            status = 'good';
        }
    }

    const getConfig = () => {
        switch (status) {
            case 'breached':
                return {
                    bg: 'bg-red-100',
                    text: 'text-red-800',
                    border: 'border-red-200',
                    icon: <AlertCircle className="w-3 h-3" />,
                    label: 'Breached'
                };
            case 'warning':
                return {
                    bg: 'bg-orange-100',
                    text: 'text-orange-800',
                    border: 'border-orange-200',
                    icon: <AlertTriangle className="w-3 h-3" />,
                    label: 'Warning'
                };
            case 'good':
                return {
                    bg: 'bg-green-50',
                    text: 'text-green-700',
                    border: 'border-green-200',
                    icon: <Clock className="w-3 h-3" />,
                    label: 'On Track'
                };
            default:
                return {
                    bg: 'bg-gray-100',
                    text: 'text-gray-600',
                    border: 'border-gray-200',
                    icon: <Clock className="w-3 h-3" />,
                    label: 'Pending'
                };
        }
    };

    const config = getConfig();

    // Format remaining time
    const formatTime = (hours: number): string => {
        if (hours < 0) return `${Math.abs(Math.round(hours))}h overdue`;
        if (hours < 1) return `${Math.round(hours * 60)}m left`;
        return `${Math.round(hours)}h left`;
    };

    if (compact) {
        return (
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${config.bg} ${config.text} ${config.border}`} title={`TAT: ${tatHours}h`}>
                {config.icon}
                <span>{status === 'breached' || status === 'warning' ? (hoursUntilBreach !== null ? formatTime(hoursUntilBreach) : config.label) : config.label}</span>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}>
            {config.icon}
            <span>
                {status === 'breached'
                    ? `Breached (${hoursUntilBreach !== null ? formatTime(hoursUntilBreach) : ''})`
                    : hoursUntilBreach !== null
                        ? `${formatTime(hoursUntilBreach)}`
                        : `${tatHours}h TAT`}
            </span>
        </div>
    );
};
