---
description: How to enable and use Supabase Realtime for live data updates
---

# Supabase Realtime Implementation Guide

This guide explains how to enable and use real-time updates in the LIMS application using Supabase Realtime (PostgreSQL Change Data Capture).

## Overview

Supabase Realtime allows you to subscribe to database changes and receive updates instantly without polling or manual refresh. This is perfect for:
- Dashboard auto-refresh when orders are created
- Live result entry updates for doctors
- Instant notifications when reports are generated
- Multi-user collaboration

## Step 1: Enable Realtime on Database Tables

First, you need to enable realtime replication for the tables you want to monitor.

### Run in Supabase SQL Editor:

```sql
-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- Enable realtime for result values
ALTER PUBLICATION supabase_realtime ADD TABLE result_values;

-- Enable realtime for reports
ALTER PUBLICATION supabase_realtime ADD TABLE reports;

-- Enable realtime for order test groups (optional)
ALTER PUBLICATION supabase_realtime ADD TABLE order_test_groups;
```

### Verify it's enabled:

```sql
-- Check which tables have realtime enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
```

## Step 2: Use the Realtime Hooks

We've created three reusable hooks:
- `useRealtimeOrders` - Subscribe to order changes
- `useRealtimeResults` - Subscribe to result value changes
- `useRealtimeReports` - Subscribe to report generation

### Example 1: Dashboard - Auto-refresh orders

```tsx
import { useRealtimeOrders } from '../hooks/useRealtimeOrders';

function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [userLabId, setUserLabId] = useState('');

  // Enable realtime updates
  const { isConnected } = useRealtimeOrders({
    labId: userLabId,
    onInsert: (newOrder) => {
      console.log('New order received!', newOrder);
      setOrders(prev => [newOrder, ...prev]);
      showNotification('✨ New order created!');
    },
    onUpdate: (updatedOrder) => {
      console.log('Order updated!', updatedOrder);
      setOrders(prev => prev.map(order => 
        order.id === updatedOrder.id ? updatedOrder : order
      ));
    },
    onDelete: (deletedOrderId) => {
      setOrders(prev => prev.filter(order => order.id !== deletedOrderId));
    }
  });

  return (
    <div>
      {isConnected && <div className="text-green-500">🟢 Live</div>}
      {/* ... rest of dashboard */}
    </div>
  );
}
```

### Example 2: Results Entry - Live updates

```tsx
import { useRealtimeResults } from '../hooks/useRealtimeResults';

function ResultsEntry({ orderId }) {
  const [results, setResults] = useState([]);

  const { isConnected } = useRealtimeResults({
    orderId,
    onInsert: (newResult) => {
      setResults(prev => [...prev, newResult]);
    },
    onUpdate: (updatedResult) => {
      setResults(prev => prev.map(r => 
        r.id === updatedResult.id ? updatedResult : r
      ));
    },
    onVerificationChange: (verifiedResult) => {
      showNotification(`✅ Result verified: ${verifiedResult.analyte_name}`);
    }
  });

  return (
    <div>
      {isConnected && <span className="text-green-500">● Live</span>}
      {/* ... results form */}
    </div>
  );
}
```

### Example 3: Report Generation - Instant notification

```tsx
import { useRealtimeReports } from '../hooks/useRealtimeReports';

function OrderDetails({ orderId }) {
  const [reportUrl, setReportUrl] = useState(null);

  useRealtimeReports({
    orderId,
    onReportGenerated: (report) => {
      console.log('Report ready!', report);
      setReportUrl(report.report_url);
      showNotification('📄 Report generated successfully!');
    }
  });

  return (
    <div>
      {reportUrl ? (
        <a href={reportUrl}>Download Report</a>
      ) : (
        <div>Generating report...</div>
      )}
    </div>
  );
}
```

## Step 3: Connection Status Indicator

Show users when they're connected to realtime:

```tsx
function RealtimeStatus({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={isConnected ? 'text-green-500' : 'text-gray-400'}>
        {isConnected ? '🟢' : '⚪'}
      </span>
      <span>{isConnected ? 'Live' : 'Offline'}</span>
    </div>
  );
}
```

## Hook API Reference

### `useRealtimeOrders(options)`

**Options:**
- `labId` - Filter orders by lab ID
- `onInsert` - Callback when new order is created
- `onUpdate` - Callback when order is updated
- `onDelete` - Callback when order is deleted
- `enabled` - Enable/disable subscription (default: true)

**Returns:**
- `isConnected` - Boolean indicating connection status
- `lastUpdate` - Last update received
- `error` - Any connection errors

### `useRealtimeResults(options)`

**Options:**
- `orderId` - Filter results by order ID
- `testGroupId` - Filter results by test group ID
- `onInsert` - Callback when new result is entered
- `onUpdate` - Callback when result is updated
- `onDelete` - Callback when result is deleted
- `onVerificationChange` - Callback when verification status changes
- `enabled` - Enable/disable subscription (default: true)

**Returns:**
- `isConnected` - Boolean indicating connection status
- `lastUpdate` - Last update received
- `error` - Any connection errors

### `useRealtimeReports(options)`

**Options:**
- `orderId` - Order ID to monitor
- `onReportGenerated` - Callback when report is generated
- `onReportUpdated` - Callback when report is updated
- `enabled` - Enable/disable subscription (default: true)

**Returns:**
- `isConnected` - Boolean indicating connection status
- `lastUpdate` - Last update received
- `error` - Any connection errors

## Best Practices

### 1. **Clean up subscriptions**
The hooks automatically clean up on unmount, but you can disable them:

```tsx
const [enabled, setEnabled] = useState(true);

useRealtimeOrders({
  enabled, // Toggle realtime on/off
  labId: userLabId,
  onInsert: handleNewOrder
});
```

### 2. **Avoid duplicate subscriptions**
Don't subscribe to the same channel multiple times. Use one subscription per component.

### 3. **Handle connection errors**
```tsx
const { isConnected, error } = useRealtimeOrders({ labId });

if (error) {
  console.error('Realtime error:', error);
  showNotification('Live updates temporarily unavailable');
}
```

### 4. **Optimize re-renders**
Use `useCallback` for event handlers:

```tsx
const handleNewOrder = useCallback((order) => {
  setOrders(prev => [order, ...prev]);
}, []);

useRealtimeOrders({
  labId: userLabId,
  onInsert: handleNewOrder
});
```

### 5. **Filter by lab_id**
Always filter by `lab_id` to avoid receiving data from other labs:

```tsx
useRealtimeOrders({
  labId: userLabId, // ← Always include this!
  onInsert: handleNewOrder
});
```

## Troubleshooting

### Realtime not working?

1. **Check if realtime is enabled on the table:**
   ```sql
   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
   ```

2. **Check browser console** - Look for subscription status logs:
   ```
   📡 Setting up realtime subscription for orders...
   ✅ Successfully subscribed to order changes
   ```

3. **Check Supabase Dashboard** - Go to Database → Publications → Verify your tables are listed

4. **Row Level Security (RLS)** - Make sure your RLS policies allow SELECT on the tables

### Still not receiving updates?

- Verify you're using the correct `lab_id`  
- Check that changes are actually being made to the database
- Try refreshing the browser
- Check network connection

## Performance Considerations

- Realtime uses WebSocket connections (very efficient)
- Each hook creates one subscription channel
- Subscriptions automatically reconnect on network issues
- No polling = reduced server load

## Next Steps

1. ✅ Enable realtime on database tables (Step 1)
2. ✅ Add hooks to Dashboard page
3. ✅ Add hooks to Results Entry page
4. ✅ Add hooks to Order Details page
5. ✅ Test with multiple users/tabs

---

**Note:** Supabase Realtime is already included in your project - no additional packages needed!
