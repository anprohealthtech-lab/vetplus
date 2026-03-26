import { supabase } from './supabase';

export interface PatientActivity {
  id?: string;
  patient_id: string;
  order_id: string;
  activity_type: string;
  description: string;
  metadata?: any;
  performed_by?: string;
  lab_id?: string;
}

export interface OrderChain {
  parentOrderId: string;
  childOrders: Array<{
    id: string;
    order_type: string;
    addition_reason?: string;
    created_at: string;
  }>;
}

/**
 * Generate a visit group ID for patient sessions
 * Note: This is now handled automatically by the database trigger
 * This function is kept for manual generation when needed
 */
export async function generateVisitGroupId(patientId: string, orderDate: Date): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('generate_visit_group_id', {
      p_patient_id: patientId,
      p_order_date: orderDate.toISOString().split('T')[0]
    });

    if (error) throw error;
    return data || `PAT-${orderDate.toISOString().split('T')[0]}`;
  } catch (error) {
    console.error('Error generating visit group ID:', error);
    // Fallback generation
    const dateStr = orderDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    }).replace(/\s/g, '').toUpperCase();
    return `PAT-${dateStr}`;
  }
}

/**
 * Log patient activity
 * Note: Most activities are now logged automatically by database triggers
 * This function is for manual/custom activity logging
 */
export async function logPatientActivity(activity: PatientActivity): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('patient_activity_log')
      .insert({
        patient_id: activity.patient_id,
        order_id: activity.order_id,
        activity_type: activity.activity_type,
        description: activity.description,
        metadata: activity.metadata || {},
        performed_by: activity.performed_by,
        lab_id: activity.lab_id
      })
      .select('id')
      .single();

    if (error) throw error;
    return data?.id || null;
  } catch (error) {
    console.error('Error logging patient activity:', error);
    return null;
  }
}

/**
 * Create an additional order linked to a parent order
 */
export async function createAdditionalOrder(
  parentOrderId: string,
  orderData: {
    patient_id: string;
    doctor: string;
    total_amount: number;
    order_type: 'additional' | 'urgent' | 'follow_up';
    addition_reason: string;
    visit_group_id: string;
    lab_id?: string;
  }
): Promise<string | null> {
  try {
    // Create the additional order
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        patient_id: orderData.patient_id,
        doctor: orderData.doctor,
        total_amount: orderData.total_amount,
        order_type: orderData.order_type,
        addition_reason: orderData.addition_reason,
        visit_group_id: orderData.visit_group_id,
        parent_order_id: parentOrderId,
        can_add_tests: true,
        status: 'pending',
        order_date: new Date().toISOString(),
        lab_id: orderData.lab_id
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Log the activity
    await logPatientActivity({
      patient_id: orderData.patient_id,
      order_id: newOrder.id,
      activity_type: 'additional_order_created',
      description: `Additional order created: ${orderData.addition_reason}`,
      metadata: {
        parent_order_id: parentOrderId,
        order_type: orderData.order_type,
        total_amount: orderData.total_amount
      }
    });

    return newOrder.id;
  } catch (error) {
    console.error('Error creating additional order:', error);
    return null;
  }
}

/**
 * Add tests to an existing order (if modifiable)
 */
export async function addTestsToOrder(
  orderId: string,
  testGroupIds: string[],
  patientId: string
): Promise<boolean> {
  try {
    // Check if order can be modified
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('can_add_tests, locked_at, status')
      .eq('id', orderId)
      .single();

    if (orderError) throw orderError;

    if (!order.can_add_tests || order.locked_at) {
      throw new Error('Order cannot be modified');
    }

    // Add test groups to order
    const orderTestGroups = testGroupIds.map(testGroupId => ({
      order_id: orderId,
      test_group_id: testGroupId,
      status: 'pending'
    }));

    const { error: insertError } = await supabase
      .from('order_test_groups')
      .insert(orderTestGroups);

    if (insertError) throw insertError;

    // Calculate new total amount
    const { data: testGroups, error: testGroupsError } = await supabase
      .from('test_groups')
      .select('price')
      .in('id', testGroupIds);

    if (testGroupsError) throw testGroupsError;

    const additionalAmount = testGroups.reduce((sum, tg) => sum + (tg.price || 0), 0);

    // Get current total and update order total
    const { data: currentOrder, error: currentOrderError } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('id', orderId)
      .single();

    if (currentOrderError) throw currentOrderError;

    const newTotal = (currentOrder.total_amount || 0) + additionalAmount;

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        total_amount: newTotal
      })
      .eq('id', orderId);

    if (updateError) throw updateError;

    // Log activity
    await logPatientActivity({
      patient_id: patientId,
      order_id: orderId,
      activity_type: 'tests_added',
      description: `${testGroupIds.length} test(s) added to order`,
      metadata: {
        test_group_ids: testGroupIds,
        additional_amount: additionalAmount
      }
    });

    return true;
  } catch (error) {
    console.error('Error adding tests to order:', error);
    return false;
  }
}

/**
 * Lock an order from further modifications
 */
export async function lockOrder(orderId: string, patientId: string, reason?: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('orders')
      .update({
        can_add_tests: false,
        locked_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (error) throw error;

    // Log activity
    await logPatientActivity({
      patient_id: patientId,
      order_id: orderId,
      activity_type: 'order_locked',
      description: reason || 'Order locked from modifications',
      metadata: {
        locked_at: new Date().toISOString(),
        reason
      }
    });

    return true;
  } catch (error) {
    console.error('Error locking order:', error);
    return false;
  }
}

/**
 * Get order chain for a parent order
 */
export async function getOrderChain(parentOrderId: string): Promise<OrderChain | null> {
  try {
    const { data: childOrders, error } = await supabase
      .from('orders')
      .select('id, order_type, addition_reason, created_at')
      .eq('parent_order_id', parentOrderId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return {
      parentOrderId,
      childOrders: childOrders || []
    };
  } catch (error) {
    console.error('Error fetching order chain:', error);
    return null;
  }
}

/**
 * Get patient session summary
 */
export async function getPatientSessionSummary(visitGroupId: string) {
  try {
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
      .eq('visit_group_id', visitGroupId)
      .order('created_at', { ascending: true });

    if (ordersError) throw ordersError;

    const { data: activities, error: activitiesError } = await supabase
      .from('patient_activity_log')
      .select(`
        *,
        users (name)
      `)
      .eq('patient_id', orders?.[0]?.patient_id)
      .order('performed_at', { ascending: false })
      .limit(50);

    if (activitiesError) throw activitiesError;

    return {
      orders: orders || [],
      activities: activities || []
    };
  } catch (error) {
    console.error('Error fetching session summary:', error);
    return { orders: [], activities: [] };
  }
}

/**
 * Check if tests can be added to a session
 */
export function canAddTestsToSession(
  orderStatus: string,
  isLocked: boolean,
  canAddTests: boolean
): {
  allowed: boolean;
  method: 'modify' | 'additional' | 'none';
  reason: string;
  requiresApproval: boolean;
} {
  if (isLocked || !canAddTests) {
    return {
      allowed: false,
      method: 'none',
      reason: 'Order is locked from modifications',
      requiresApproval: false
    };
  }

  switch (orderStatus) {
    case 'pending':
    case 'confirmed':
      return {
        allowed: true,
        method: 'modify',
        reason: 'Tests can be added before sample collection',
        requiresApproval: false
      };

    case 'sample_collection':
      return {
        allowed: true,
        method: 'additional',
        reason: 'Create additional order during collection',
        requiresApproval: true
      };

    case 'processing':
    case 'completed':
      return {
        allowed: true,
        method: 'additional',
        reason: 'Follow-up order required',
        requiresApproval: true
      };

    default:
      return {
        allowed: false,
        method: 'none',
        reason: 'Cannot add tests in current status',
        requiresApproval: false
      };
  }
}

/**
 * Smart test suggestions based on existing tests
 */
export function getSmartTestSuggestions(existingTests: string[]): Array<{
  test: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}> {
  const suggestions: Array<{ test: string; reason: string; priority: 'high' | 'medium' | 'low' }> = [];

  // Rule-based suggestions
  if (existingTests.includes('CBC')) {
    suggestions.push({
      test: 'Iron Studies',
      reason: 'Common follow-up for CBC abnormalities',
      priority: 'medium'
    });
  }

  if (existingTests.includes('LFT')) {
    suggestions.push({
      test: 'Hepatitis Panel',
      reason: 'Recommended for liver function monitoring',
      priority: 'medium'
    });
  }

  if (existingTests.includes('FBS') || existingTests.includes('HbA1c')) {
    suggestions.push({
      test: 'Lipid Profile',
      reason: 'Cardiovascular risk assessment for diabetes',
      priority: 'high'
    });
  }

  if (existingTests.some(test => test.toLowerCase().includes('thyroid'))) {
    suggestions.push({
      test: 'Vitamin D',
      reason: 'Often deficient in thyroid disorders',
      priority: 'low'
    });
  }

  return suggestions;
}
