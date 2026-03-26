import React from 'react';
import { Clock as ClockIcon, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

const workflowData = [
  {
    status: 'Sample Collection',
    count: 12,
    color: 'blue',
    icon: ClockIcon,
  },
  {
    status: 'In Progress',
    count: 28,
    color: 'orange',
    icon: AlertTriangle,
  },
  {
    status: 'Pending Approval',
    count: 8,
    color: 'yellow',
    icon: ClockIcon,
  },
  {
    status: 'Completed',
    count: 45,
    color: 'green',
    icon: CheckCircle,
  },
];

const colorMap = {
  blue: 'bg-blue-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
  green: 'bg-green-500',
};

const WorkflowStatus: React.FC = () => {
  const total = workflowData.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Workflow Status</h3>
      
      <div className="space-y-4">
        {workflowData.map((item, index) => {
          const percentage = (item.count / total) * 100;
          
          return (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <item.icon className={`h-4 w-4 text-${item.color}-500`} />
                  <span className="text-sm font-medium text-gray-700">{item.status}</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{item.count}</span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`${colorMap[item.color as keyof typeof colorMap]} h-2 rounded-full transition-all duration-300`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Total Orders</span>
          <span className="text-lg font-bold text-gray-900">{total}</span>
        </div>
      </div>
    </div>
  );
};

export default WorkflowStatus;