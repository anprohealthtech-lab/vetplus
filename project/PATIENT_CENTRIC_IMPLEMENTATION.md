# 🏥 Patient-Centric LIMS Implementation Guide

## 📋 Overview

This implementation adds patient-centric workflow capabilities to your existing LIMS system with **minimal database changes**. The enhancement allows for:

- **Order Chaining**: Link related orders for the same patient visit
- **Flexible Test Addition**: Add tests before, during, or after sample collection
- **Patient Journey Tracking**: Complete audit trail of patient activities
- **Session Management**: Group orders by patient visits
- **Smart Test Suggestions**: Context-aware test recommendations

## 🚀 Quick Start

### Step 1: Database Migration

1. Open your **Supabase SQL Editor**
2. Copy and paste the contents of `PATIENT_CENTRIC_MIGRATION.sql`
3. Execute the script to add new columns and functions
4. Verify the migration using the verification queries at the bottom

### Step 2: Frontend Integration

The new components are ready to use:

```typescript
// Import the enhanced components
import PatientSessionDashboard from './components/Sessions/PatientSessionDashboard';
import SmartTestAddition from './components/Sessions/SmartTestAddition';
import EnhancedOrdersPage from './components/Sessions/EnhancedOrdersPage';

// Use PatientSessionDashboard for individual sessions
<PatientSessionDashboard 
  sessionId="PAT-02AUG25-001"
  onSessionCreate={handleSessionCreate}
/>

// Use SmartTestAddition for adding tests
<SmartTestAddition
  sessionId="PAT-02AUG25-001"
  patientId="patient-uuid"
  currentOrderStatus="pending"
  onTestsAdded={handleTestsAdded}
  onClose={handleClose}
/>

// Use EnhancedOrdersPage to replace existing Orders page
<EnhancedOrdersPage />
```

### Step 3: Replace Orders Page (Optional)

To use the new patient-centric Orders page:

1. Backup your current `src/pages/Orders.tsx`
2. Replace it with the contents of `src/components/Sessions/EnhancedOrdersPage.tsx`
3. Update imports in your routing if needed

## 🔧 Database Schema Changes

### New Columns Added to `orders` Table

```sql
-- Order linking and patient journey
parent_order_id UUID       -- Links to parent order
order_type VARCHAR(50)     -- initial, additional, urgent, follow_up
visit_group_id VARCHAR(100) -- Groups orders from same visit
addition_reason TEXT       -- Why this order was added
can_add_tests BOOLEAN      -- Whether more tests can be added
locked_at TIMESTAMPTZ      -- When order was locked
```

### New `patient_activity_log` Table

```sql
-- Comprehensive activity tracking
id UUID PRIMARY KEY
patient_id UUID           -- Links to patient
order_id UUID             -- Links to order
activity_type VARCHAR(50) -- Type of activity
description TEXT          -- Human-readable description
metadata JSONB            -- Flexible data storage
performed_by UUID         -- Who performed the action
performed_at TIMESTAMPTZ  -- When it happened
lab_id UUID               -- Which lab
```

## 🎯 Workflow Examples

### Example 1: Initial Order Creation

```typescript
// When creating a new order, visit_group_id is auto-generated
const newOrder = {
  patient_id: "uuid",
  doctor: "Dr. Smith",
  total_amount: 1200,
  order_type: "initial", // Default
  // visit_group_id will be auto-generated as "PAT-02AUG25-001"
};
```

### Example 2: Adding Tests Before Collection

```typescript
// Patient wants to add Vitamin D test before sample collection
import { addTestsToOrder } from '../utils/patientWorkflow';

const success = await addTestsToOrder(
  orderId,
  ['vitamin-d-test-id'],
  patientId
);
// This modifies the existing order directly
```

### Example 3: Adding Tests After Collection

```typescript
// Doctor requests additional test after samples collected
import { createAdditionalOrder } from '../utils/patientWorkflow';

const additionalOrderId = await createAdditionalOrder(
  parentOrderId,
  {
    patient_id: patientId,
    doctor: "Dr. Smith",
    total_amount: 400,
    order_type: "additional",
    addition_reason: "Doctor requested Vitamin D based on CBC results",
    visit_group_id: "PAT-02AUG25-001"
  }
);
```

## 📊 Smart Features

### 1. Auto Visit Group Generation

```typescript
// Automatically generates: PAT-02AUG25-001, PAT-02AUG25-002, etc.
const visitGroupId = await generateVisitGroupId(patientId, new Date());
```

### 2. Activity Logging

```typescript
import { logPatientActivity } from '../utils/patientWorkflow';

await logPatientActivity({
  patient_id: patientId,
  order_id: orderId,
  activity_type: 'sample_collected',
  description: 'Blood sample collected for CBC and LFT',
  metadata: { sample_type: 'blood', volume: '5ml' }
});
```

### 3. Smart Test Suggestions

```typescript
import { getSmartTestSuggestions } from '../utils/patientWorkflow';

const suggestions = getSmartTestSuggestions(['CBC', 'LFT']);
// Returns: [{ test: 'Iron Studies', reason: 'Common follow-up for CBC', priority: 'medium' }]
```

### 4. Test Addition Rules

```typescript
import { canAddTestsToSession } from '../utils/patientWorkflow';

const rules = canAddTestsToSession('pending', false, true);
// Returns: { allowed: true, method: 'modify', reason: 'Tests can be added before collection' }
```

## 🎨 UI Components

### PatientSessionDashboard

Complete dashboard showing:
- Patient information
- Session timeline
- Order chain visualization
- Activity log
- Test addition capabilities

### SmartTestAddition

Modal for adding tests with:
- Smart rules engine
- Popular test packages
- Individual test selection
- Cost calculation
- Addition method determination

### EnhancedOrdersPage

Patient-centric orders view with:
- Session grouping
- Order chain visualization
- Activity timeline
- Flexible test addition

## 🔍 Monitoring & Analytics

### Key Metrics to Track

```sql
-- Test addition rate
SELECT 
  COUNT(CASE WHEN order_type = 'additional' THEN 1 END)::FLOAT / COUNT(*) * 100 as addition_rate
FROM orders 
WHERE order_date >= CURRENT_DATE - INTERVAL '30 days';

-- Average tests per session
SELECT 
  visit_group_id,
  COUNT(*) as total_orders,
  SUM(
    (SELECT COUNT(*) FROM order_test_groups WHERE order_id = orders.id)
  ) as total_tests
FROM orders 
GROUP BY visit_group_id;

-- Patient journey duration
SELECT 
  visit_group_id,
  MAX(performed_at) - MIN(performed_at) as session_duration
FROM patient_activity_log 
GROUP BY visit_group_id;
```

## 🔄 Backward Compatibility

- ✅ All existing orders work unchanged
- ✅ No breaking changes to current workflow
- ✅ Gradual migration possible
- ✅ Fallback mechanisms in place

## 🛠️ Troubleshooting

### Common Issues

1. **Migration fails**: Ensure you have admin privileges in Supabase
2. **Components not loading**: Check import paths are correct
3. **Visit group ID not generating**: Verify the trigger was created

### Rollback Plan

If you need to rollback:

```sql
-- Remove new columns (WARNING: This will lose data)
ALTER TABLE orders 
DROP COLUMN parent_order_id,
DROP COLUMN order_type,
DROP COLUMN visit_group_id,
DROP COLUMN addition_reason,
DROP COLUMN can_add_tests,
DROP COLUMN locked_at;

-- Drop new table
DROP TABLE patient_activity_log;

-- Drop functions and triggers
DROP FUNCTION generate_visit_group_id;
DROP FUNCTION log_patient_activity;
DROP TRIGGER trigger_auto_visit_group ON orders;
DROP TRIGGER trigger_log_order_activity ON orders;
```

## 📈 Next Steps

1. **Run the migration** - Execute the SQL script
2. **Test with sample data** - Create a test order and add tests
3. **Train staff** - Show them the new workflow
4. **Monitor metrics** - Track test addition rates
5. **Iterate** - Add more smart suggestions based on usage

## 🎯 Success Indicators

- ✅ Test addition rate increases (target: 15-25%)
- ✅ Patient visit efficiency improves
- ✅ Reduced duplicate orders
- ✅ Better audit trail compliance
- ✅ Staff workflow satisfaction

## 📞 Support

For questions or issues:
1. Check the verification queries in the migration script
2. Review the console logs for error messages
3. Ensure all database functions were created successfully

---

**🎉 Congratulations!** Your LIMS now supports patient-centric workflow with minimal database changes while maintaining full backward compatibility.
