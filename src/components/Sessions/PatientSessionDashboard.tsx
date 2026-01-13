import { useState, useEffect } from 'react';
import {
  User,
  Calendar,
  Clock,
  Phone,
  Mail,
  Stethoscope,
  Plus,
  FileText,
  Activity,
  CreditCard,
  TestTube,
  AlertCircle,
  CheckCircle,
  DollarSign
} from 'lucide-react';
import { supabase } from '../../utils/supabase';

interface PatientSession {
  id: string;
  patient_id: string;
  visit_group_id: string;
  session_date: string;
  total_amount: number;
  total_tests: number;
  status: 'active' | 'completed' | 'cancelled';
  patient: {
    id: string;
    name: string;
    email: string;
    phone: string;
    age: number;
    gender: string;
  };
  orders: Array<{
    id: string;
    order_type: string;
    status: string;
    total_amount: number;
    doctor: string;
    created_at: string;
    can_add_tests: boolean;
    locked_at?: string;
    test_groups: Array<{
      id: string;
      name: string;
      price: number;
      status: string;
    }>;
  }>;
  activities: Array<{
    id: string;
    activity_type: string;
    description: string;
    performed_at: string;
    performed_by: string;
  }>;
}

interface Props {
  sessionId?: string;
  patientId?: string;
  onSessionCreate?: (session: PatientSession) => void;
}

export default function PatientSessionDashboard({ sessionId, patientId, onSessionCreate }: Props) {
  const [session, setSession] = useState<PatientSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      fetchSession(sessionId);
    } else if (patientId) {
      fetchActiveSession(patientId);
    }
  }, [sessionId, patientId]);

  const fetchSession = async (id: string) => {
    try {
      setLoading(true);

      // Fetch session data with related orders and patient info
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          patients (
            id, name, email, phone, age, gender
          ),
          order_test_groups (
            id,
            test_groups (
              id, name, price
            ),
            status
          )
        `)
        .eq('visit_group_id', id)
        .order('created_at', { ascending: true });

      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) {
        setError('Session not found');
        return;
      }

      // Fetch activity log
      const { data: activities, error: activitiesError } = await supabase
        .from('patient_activity_log')
        .select(`
          *,
          users (name)
        `)
        .eq('patient_id', orders[0].patient_id)
        .order('performed_at', { ascending: false })
        .limit(20);

      if (activitiesError) throw activitiesError;

      // Transform data into session format
      const sessionData: PatientSession = {
        id: id,
        patient_id: orders[0].patient_id,
        visit_group_id: id,
        session_date: orders[0].order_date,
        total_amount: orders.reduce((sum, order) => sum + (order.total_amount || 0), 0),
        total_tests: orders.reduce((sum, order) => sum + (order.order_test_groups?.length || 0), 0),
        status: determineSessionStatus(orders),
        patient: orders[0].patients,
        orders: orders.map(order => ({
          id: order.id,
          order_type: order.order_type || 'initial',
          status: order.status,
          total_amount: order.total_amount || 0,
          doctor: order.doctor || '',
          created_at: order.created_at,
          can_add_tests: order.can_add_tests ?? true,
          locked_at: order.locked_at,
          test_groups: order.order_test_groups?.map((otg: any) => ({
            id: otg.id,
            name: otg.test_groups?.name || '',
            price: otg.test_groups?.price || 0,
            status: otg.status || 'pending'
          })) || []
        })),
        activities: activities?.map(activity => ({
          id: activity.id,
          activity_type: activity.activity_type,
          description: activity.description || '',
          performed_at: activity.performed_at,
          performed_by: activity.users?.name || 'System'
        })) || []
      };

      setSession(sessionData);
    } catch (error) {
      console.error('Error fetching session:', error);
      setError('Failed to load session data');
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveSession = async (patientId: string) => {
    try {
      setLoading(true);

      // Look for active session today
      const today = new Date().toISOString().split('T')[0];
      const { data: orders, error } = await supabase
        .from('orders')
        .select('visit_group_id')
        .eq('patient_id', patientId)
        .gte('order_date', today)
        .lt('order_date', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (orders && orders.length > 0) {
        await fetchSession(orders[0].visit_group_id);
      } else {
        setSession(null);
      }
    } catch (error) {
      console.error('Error fetching active session:', error);
      setError('Failed to load active session');
    } finally {
      setLoading(false);
    }
  };

  const determineSessionStatus = (orders: any[]): 'active' | 'completed' | 'cancelled' => {
    if (orders.some(order => order.status === 'cancelled')) return 'cancelled';
    if (orders.every(order => order.status === 'completed')) return 'completed';
    return 'active';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const addTestsToSession = async () => {
    // This would open the test addition modal
    console.log('Opening test addition modal');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
          <span className="text-red-800">{error}</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
        <TestTube className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Session</h3>
        <p className="text-gray-500 mb-4">No active patient session found for today.</p>
        <button
          onClick={() => onSessionCreate && onSessionCreate({} as PatientSession)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Start New Session
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Session Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Patient Session #{session.visit_group_id}
              </h1>
              <div className="flex items-center mt-1 space-x-4 text-sm text-gray-500">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  {new Date(session.session_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  {formatTime(session.orders[0]?.created_at)}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                {session.status === 'active' && <Activity className="h-3 w-3 mr-1" />}
                {session.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                {session.status === 'cancelled' && <AlertCircle className="h-3 w-3 mr-1" />}
                {session.status.charAt(0).toUpperCase() + session.status.slice(1)} Session
              </span>
            </div>
          </div>

          {/* Patient Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="bg-blue-100 rounded-full p-3">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{session.patient.name}</h3>
                  <p className="text-sm text-gray-500">
                    Age {session.patient.age} • {session.patient.gender}
                  </p>
                  <div className="flex items-center space-x-4 mt-1">
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="h-4 w-4 mr-1" />
                      {session.patient.email}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="h-4 w-4 mr-1" />
                      {session.patient.phone}
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center text-sm text-gray-600 mb-1">
                  <Stethoscope className="h-4 w-4 mr-1" />
                  {session.orders[0]?.doctor}
                </div>
              </div>
            </div>
          </div>

          {/* Session Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Amount</p>
                  <p className="text-2xl font-bold text-blue-900">{formatCurrency(session.total_amount)}</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center">
                <TestTube className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-green-600">Total Tests</p>
                  <p className="text-2xl font-bold text-green-900">{session.total_tests}</p>
                </div>
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-purple-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-purple-600">Orders</p>
                  <p className="text-2xl font-bold text-purple-900">{session.orders.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {session.status === 'active' && (
          <div className="border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex space-x-3">
                <button
                  onClick={addTestsToSession}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tests
                </button>
                <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Report
                </button>
              </div>
              <div className="flex space-x-2">
                <button className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Payment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Orders Timeline */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Timeline</h3>
          <div className="space-y-4">
            {session.activities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                    <Activity className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                    <p className="text-xs text-gray-500">{formatTime(activity.performed_at)}</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    {activity.activity_type.replace('_', ' ')} • {activity.performed_by}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
