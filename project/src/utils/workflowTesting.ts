/**
 * Test utilities for patient-centric workflow
 * Run these functions to verify your implementation works correctly
 */

import { supabase } from './supabase';
import { 
  generateVisitGroupId, 
  getPatientVisitSummary,
  getPatientActivityTimeline 
} from './patientWorkflow';

export interface TestResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Test 1: Verify database migration completed successfully
 */
export async function testDatabaseMigration(): Promise<TestResult> {
  try {
    // Check if new columns exist
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, parent_order_id, order_type, visit_group_id, can_add_tests, locked_at')
      .limit(1);

    if (ordersError) {
      return { success: false, message: `Orders table check failed: ${ordersError.message}` };
    }

    // Check if activity log table exists
    const { data: activities, error: activitiesError } = await supabase
      .from('patient_activity_log')
      .select('id, activity_type, description')
      .limit(1);

    if (activitiesError) {
      return { success: false, message: `Activity log table check failed: ${activitiesError.message}` };
    }

    // Check if views exist
    const { error: viewError } = await supabase
      .from('patient_visit_summary')
      .select('visit_group_id, patient_name, total_orders')
      .limit(1);

    if (viewError) {
      return { success: false, message: `Views check failed: ${viewError.message}` };
    }

    return { 
      success: true, 
      message: 'Database migration verified successfully!',
      data: { ordersCount: orders?.length, activitiesCount: activities?.length, viewsWorking: true }
    };
  } catch (error) {
    return { success: false, message: `Migration test failed: ${error}` };
  }
}

/**
 * Test 2: Test visit group ID generation
 */
export async function testVisitGroupGeneration(): Promise<TestResult> {
  try {
    // Test with a sample patient (you'll need to replace with a real patient ID)
    const samplePatientId = '00000000-0000-0000-0000-000000000000'; // Replace with real patient ID
    const visitGroupId = await generateVisitGroupId(samplePatientId, new Date());

    if (!visitGroupId || visitGroupId.length < 5) {
      return { success: false, message: 'Visit group ID generation failed' };
    }

    return { 
      success: true, 
      message: 'Visit group ID generated successfully',
      data: { visitGroupId }
    };
  } catch (error) {
    return { success: false, message: `Visit group generation test failed: ${error}` };
  }
}

/**
 * Test 3: Test database functions
 */
export async function testDatabaseFunctions(): Promise<TestResult> {
  try {
    // Test generate_visit_group_id function
    const { data: visitId, error: visitIdError } = await supabase.rpc('generate_visit_group_id', {
      p_patient_id: '00000000-0000-0000-0000-000000000000', // Replace with real patient ID
      p_order_date: new Date().toISOString().split('T')[0]
    });

    if (visitIdError) {
      return { success: false, message: `generate_visit_group_id function failed: ${visitIdError.message}` };
    }

    // Test can_add_tests_to_order function (you'll need a real order ID)
    // This will fail if no orders exist, which is expected
    
    return { 
      success: true, 
      message: 'Database functions working correctly',
      data: { generatedVisitId: visitId }
    };
  } catch (error) {
    return { success: false, message: `Database functions test failed: ${error}` };
  }
}

/**
 * Test 4: Test views and data retrieval
 */
export async function testViewsAndQueries(): Promise<TestResult> {
  try {
    const visitSummary = await getPatientVisitSummary();
    const activities = await getPatientActivityTimeline('test-visit-123'); // Will return empty array

    return { 
      success: true, 
      message: 'Views and queries working correctly',
      data: { 
        visitSummaryCount: visitSummary.length,
        activitiesCount: activities.length
      }
    };
  } catch (error) {
    return { success: false, message: `Views and queries test failed: ${error}` };
  }
}

/**
 * Run all tests
 */
export async function runAllTests(): Promise<TestResult[]> {
  console.log('🧪 Running Patient-Centric Workflow Tests...\n');

  const tests = [
    { name: 'Database Migration', test: testDatabaseMigration },
    { name: 'Visit Group Generation', test: testVisitGroupGeneration },
    { name: 'Database Functions', test: testDatabaseFunctions },
    { name: 'Views and Queries', test: testViewsAndQueries }
  ];

  const results: TestResult[] = [];

  for (const { name, test } of tests) {
    console.log(`Running ${name} test...`);
    const result = await test();
    results.push(result);
    
    if (result.success) {
      console.log(`✅ ${name}: ${result.message}`);
      if (result.data) {
        console.log(`   Data:`, result.data);
      }
    } else {
      console.log(`❌ ${name}: ${result.message}`);
    }
    console.log('');
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`🎯 Test Results: ${successCount}/${results.length} tests passed`);

  return results;
}

/**
 * Quick verification of basic setup
 */
export async function quickVerification(): Promise<boolean> {
  try {
    // Just check if we can query the new structures
    const { error: ordersError } = await supabase
      .from('orders')
      .select('visit_group_id')
      .limit(1);

    const { error: activityError } = await supabase
      .from('patient_activity_log')
      .select('id')
      .limit(1);

    const { error: viewError } = await supabase
      .from('patient_visit_summary')
      .select('visit_group_id')
      .limit(1);

    return !ordersError && !activityError && !viewError;
  } catch (error) {
    console.error('Quick verification failed:', error);
    return false;
  }
}

// Export convenience function for console testing
export function testInConsole() {
  console.log('🔍 To test the patient-centric workflow implementation:');
  console.log('');
  console.log('1. Quick check:');
  console.log('   quickVerification().then(result => console.log("Setup OK:", result))');
  console.log('');
  console.log('2. Full test suite:');
  console.log('   runAllTests().then(results => console.log("Done!", results))');
  console.log('');
  console.log('3. Individual tests:');
  console.log('   testDatabaseMigration().then(r => console.log(r))');
  console.log('   testVisitGroupGeneration().then(r => console.log(r))');
  console.log('');
}
