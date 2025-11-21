import React from 'react';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface OrderStatusDisplayProps {
  order: any;
  showDetails?: boolean;
  compact?: boolean;
}

export const OrderStatusDisplay: React.FC<OrderStatusDisplayProps> = ({ 
  order, 
  showDetails = true,
  compact = false 
}) => {
  // Ensure consistent status
  const getConsistentStatus = () => {
    if (!order) return 'Unknown';
    
    if (order.sample_collected_at && 
        (order.status === 'Pending Collection' || order.status === 'Order Created')) {
      return 'In Progress';
    }
    
    if (!order.sample_collected_at && order.status === 'In Progress') {
      return 'Pending Collection';
    }
    
    return order.status;
  };

  const status = getConsistentStatus();
  
  const getStatusConfig = () => {
    switch (status) {
      case 'Order Created':
        return { 
          color: 'bg-gray-100 text-gray-700', 
          icon: <Clock className="w-4 h-4" />,
          message: 'Order created, pending sample collection'
        };
      case 'Pending Collection':
        return { 
          color: 'bg-yellow-100 text-yellow-700',
          icon: <AlertCircle className="w-4 h-4" />,
          message: 'Awaiting sample collection'
        };
      case 'In Progress':
        return { 
          color: 'bg-blue-100 text-blue-700',
          icon: <Clock className="w-4 h-4" />,
          message: order.sample_collected_at ? 
            `Sample collected on ${new Date(order.sample_collected_at).toLocaleString()}` :
            'Processing'
        };
      case 'Pending Approval':
        return { 
          color: 'bg-orange-100 text-orange-700',
          icon: <AlertCircle className="w-4 h-4" />,
          message: 'Results ready for approval'
        };
      case 'Completed':
        return { 
          color: 'bg-green-100 text-green-700',
          icon: <CheckCircle className="w-4 h-4" />,
          message: 'Report ready'
        };
      case 'Delivered':
        return { 
          color: 'bg-purple-100 text-purple-700',
          icon: <CheckCircle className="w-4 h-4" />,
          message: 'Report delivered'
        };
      default:
        return { 
          color: 'bg-gray-100 text-gray-700',
          icon: <Clock className="w-4 h-4" />,
          message: status
        };
    }
  };

  const config = getStatusConfig();

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${config.color}`}>
        {config.icon}
        {status}
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <div className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg ${config.color}`}>
        {config.icon}
        <span>{status}</span>
      </div>
      
      {showDetails && (
        <div className="text-sm text-gray-600 space-y-1">
          <p>{config.message}</p>
          
          {order.sample_collected_by && (
            <p>Collected by: <span className="font-medium">{order.sample_collected_by}</span></p>
          )}
          
          {order.sample_id && (
            <p>Sample ID: <span className="font-mono text-xs">{order.sample_id}</span></p>
          )}
        </div>
      )}
    </div>
  );
};
