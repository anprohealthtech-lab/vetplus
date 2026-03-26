# Phlebotomist Tracking System - Usage Guide

## Overview
System to track which lab users can collect samples and assign them to orders.

## Database Changes

### Migration: `20251116_add_phlebotomist_tracking.sql`

**Tables Modified:**
1. `users` - Added `is_phlebotomist` boolean flag
2. `orders` - Added `sample_collector_id` UUID (foreign key to users)
3. `v_report_template_context` view updated to include collector info

**Triggers:**
- `set_sample_collector` - Auto-populates collector ID when sample collected

## Frontend Components

### 1. PhlebotomistSelect Component
Dropdown to select phlebotomist when collecting sample.

**Usage:**
```tsx
import PhlebotomistSelect from '../components/PhlebotomistSelect';

function SampleCollectionForm({ orderId }) {
  const [collectorId, setCollectorId] = useState('');
  const [collectorName, setCollectorName] = useState('');

  const handleCollectorChange = (userId: string, userName: string) => {
    setCollectorId(userId);
    setCollectorName(userName);
  };

  const handleCollectSample = async () => {
    await database.orders.markSampleCollected(
      orderId,
      collectorName,
      collectorId  // Pass the phlebotomist user ID
    );
  };

  return (
    <div>
      <label>Collected By (Phlebotomist):</label>
      <PhlebotomistSelect
        value={collectorId}
        onChange={handleCollectorChange}
        placeholder="Select phlebotomist..."
      />
      <button onClick={handleCollectSample}>Mark Sample Collected</button>
    </div>
  );
}
```

### 2. PhlebotomistCheckbox Component
Checkbox in user management to mark users as phlebotomists.

**Usage:**
```tsx
import PhlebotomistCheckbox from '../components/PhlebotomistCheckbox';

function UserManagementTable({ users }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          <th>Can Collect Samples</th>
        </tr>
      </thead>
      <tbody>
        {users.map(user => (
          <tr key={user.id}>
            <td>{user.name}</td>
            <td>{user.role}</td>
            <td>
              <PhlebotomistCheckbox
                userId={user.id}
                initialValue={user.is_phlebotomist || false}
                userName={user.name}
                onStatusChange={(userId, isPhlebotomist) => {
                  console.log(`User ${userId} phlebotomist: ${isPhlebotomist}`);
                }}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## API Functions

### Get Phlebotomists List
```typescript
// Fetch all phlebotomists for current lab
const { data, error } = await database.users.getPhlebotomists();

// Fetch for specific lab
const { data, error } = await database.users.getPhlebotomists(labId);
```

### Update Phlebotomist Status
```typescript
// Mark user as phlebotomist
await database.users.updatePhlebotomistStatus(userId, true);

// Remove phlebotomist status
await database.users.updatePhlebotomistStatus(userId, false);
```

### Mark Sample Collected with Phlebotomist
```typescript
// Auto-assign logged-in user
await database.orders.markSampleCollected(orderId);

// Specify phlebotomist
await database.orders.markSampleCollected(
  orderId,
  'John Doe',           // Display name
  'phlebotomist-uuid'   // User ID
);
```

## Integration Examples

### Example 1: Order Detail Page
```tsx
import PhlebotomistSelect from '../components/PhlebotomistSelect';
import { database } from '../utils/supabase';

function OrderDetailPage({ order }) {
  const [collectorId, setCollectorId] = useState(order.sample_collector_id || '');
  
  const handleCollectSample = async () => {
    if (!collectorId) {
      alert('Please select a phlebotomist');
      return;
    }
    
    const phlebotomist = phlebotomists.find(p => p.id === collectorId);
    
    const { error } = await database.orders.markSampleCollected(
      order.id,
      phlebotomist.name,
      collectorId
    );
    
    if (!error) {
      alert('Sample collected successfully!');
    }
  };

  return (
    <div className="p-4">
      <h2>Sample Collection</h2>
      
      {!order.sample_collected_at ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Phlebotomist:
            </label>
            <PhlebotomistSelect
              value={collectorId}
              onChange={(userId, userName) => setCollectorId(userId)}
              className="w-full"
            />
          </div>
          
          <button
            onClick={handleCollectSample}
            disabled={!collectorId}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
          >
            Mark Sample Collected
          </button>
        </div>
      ) : (
        <div className="bg-green-50 p-4 rounded">
          <p>✓ Sample collected by: {order.sample_collected_by}</p>
          <p className="text-sm text-gray-600">
            {new Date(order.sample_collected_at).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
```

### Example 2: User Settings Page
```tsx
import PhlebotomistCheckbox from '../components/PhlebotomistCheckbox';

function UserSettingsPage({ users }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">User Management</h1>
      
      <table className="w-full border">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-3 text-left">Name</th>
            <th className="p-3 text-left">Email</th>
            <th className="p-3 text-left">Role</th>
            <th className="p-3 text-left">Phlebotomist</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id} className="border-t">
              <td className="p-3">{user.name}</td>
              <td className="p-3">{user.email}</td>
              <td className="p-3">
                <span className="px-2 py-1 bg-blue-100 rounded text-sm">
                  {user.role}
                </span>
              </td>
              <td className="p-3">
                <PhlebotomistCheckbox
                  userId={user.id}
                  initialValue={user.is_phlebotomist || false}
                  userName={user.name}
                  onStatusChange={(userId, status) => {
                    // Refresh user list or update local state
                    console.log('Phlebotomist status updated');
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="mt-4 p-4 bg-blue-50 rounded">
        <p className="text-sm text-gray-700">
          <strong>Note:</strong> Users marked as phlebotomists will appear in the 
          sample collection dropdown. Multiple users can be phlebotomists (e.g., 
          receptionists who also collect samples).
        </p>
      </div>
    </div>
  );
}
```

## Benefits

✅ **Proper tracking** - Know exactly who collected each sample
✅ **Flexible roles** - Receptionist can also be phlebotomist (no separate user type needed)
✅ **Lab-scoped** - Only shows phlebotomists from current lab
✅ **Reporting** - Can generate phlebotomist performance reports
✅ **Audit trail** - Full history of who collected which samples
✅ **Backward compatible** - Keeps `sample_collected_by` text field for legacy data

## Migration Steps

1. Run migration: `20251116_add_phlebotomist_tracking.sql`
2. Mark existing users as phlebotomists in user management UI
3. Update sample collection forms to use `PhlebotomistSelect`
4. Deploy updated frontend code
