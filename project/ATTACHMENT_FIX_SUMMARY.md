# LIMS Attachment Relationship Fix

## Problem
The Orders page was failing to load with this error:
```
Error loading orders: {
  code: "PGRST200",
  details: "Searched for a foreign key relationship between 'orders' and 'attachments' using the hint 'attachments_related_id_fkey' in the schema 'public', but no matches were found.",
  hint: "Perhaps you meant 'patients' instead of 'attachments'.",
  message: "Could not find a relationship between 'orders' and 'attachments' in the schema cache"
}
```

## Root Cause
The code in `src/utils/supabase.ts` was trying to use a foreign key relationship that doesn't exist:
```typescript
// WRONG - This foreign key doesn't exist
attachments!attachments_related_id_fkey(id, file_url, original_filename, file_type)
```

The actual database schema uses a **generic attachment system** where:
- `attachments.related_table` stores the table name (e.g., 'orders')
- `attachments.related_id` stores the UUID of the related record
- There are **NO direct foreign key constraints** between `attachments` and specific tables

## Solution
Updated the `orders.getAll()` function to manually fetch attachments using the correct approach:

```typescript
orders: {
  getAll: async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        patients(name, age, gender),
        order_tests(test_name),
        results(id, status, result_values(parameter, value, unit, reference_range, flag))
      `)
      .order('order_date', { ascending: false });
    
    if (error || !data) return { data, error };
    
    // Manually fetch attachments for each order
    const ordersWithAttachments = await Promise.all(
      data.map(async (order) => {
        const { data: orderAttachments } = await supabase
          .from('attachments')
          .select('id, file_url, original_filename, file_type')
          .eq('related_table', 'orders')
          .eq('related_id', order.id);
        
        return {
          ...order,
          attachments: orderAttachments || []
        };
      })
    );
    
    return { data: ordersWithAttachments, error: null };
  },
}
```

## Additional Improvements

1. **Created Schema Documentation**: Added `20250802000000_schema_documentation.sql` to document the current schema and relationship patterns for future reference.

2. **Added Helper Functions**: Enhanced the `attachments` object with specific helper functions:
   ```typescript
   getByOrderId: async (orderId: string) => {
     return attachments.getByRelatedId('orders', orderId);
   },
   getByPatientIdRelated: async (patientId: string) => {
     return attachments.getByRelatedId('patients', patientId);
   },
   getByResultId: async (resultId: string) => {
     return attachments.getByRelatedId('results', resultId);
   }
   ```

3. **Created Database Views and Functions**: Added helpful views and functions to make the relationship patterns clearer for developers.

## Key Takeaways for Future Development

1. **No Direct Foreign Keys**: The attachments system uses `related_table` + `related_id` pattern, not foreign keys
2. **Manual Relationship Queries**: Always query attachments separately using the generic relationship pattern
3. **Schema Documentation**: The new migration file serves as comprehensive documentation for the database structure
4. **Multi-Lab Support**: The system is designed for multiple labs with lab-specific configurations

## Testing
The fix should resolve the "Error loading orders" issue. The Orders page should now load successfully with attachment information properly included.
