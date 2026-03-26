import React from 'react';
import { Clock as ClockIcon, User, TestTube, FileText, CheckCircle } from 'lucide-react';

const activities = [
  {
    id: 1,
    type: 'patient_registered',
    message: 'New patient registered: Priya Sharma',
    time: '5 minutes ago',
    icon: User,
    color: 'blue',
  },
  {
    id: 2,
    type: 'test_completed',
    message: 'Blood test completed for Patient ID: PT001245',
    time: '12 minutes ago',
    icon: TestTube,
    color: 'green',
  },
  {
    id: 3,
    type: 'report_generated',
    message: 'Lab report generated for Rajesh Kumar',
    time: '25 minutes ago',
    icon: FileText,
    color: 'purple',
  },
  {
    id: 4,
    type: 'result_approved',
    message: 'Results approved by Dr. Singh for Order #ORD789',
    time: '1 hour ago',
    icon: CheckCircle,
    color: 'orange',
  },
  {
    id: 5,
    type: 'patient_registered',
    message: 'New patient registered: Amit Patel',
    time: '2 hours ago',
    icon: User,
    color: 'blue',
  },
];

const colorMap = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  purple: 'bg-purple-100 text-purple-600',
  orange: 'bg-orange-100 text-orange-600',
};

const RecentActivity: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        <ClockIcon className="h-5 w-5 text-gray-400" />
      </div>
      
      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start space-x-3">
            <div className={`p-2 rounded-lg ${colorMap[activity.color as keyof typeof colorMap]}`}>
              <activity.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900">{activity.message}</p>
              <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200">
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          View all activity →
        </button>
      </div>
    </div>
  );
};

export default RecentActivity;