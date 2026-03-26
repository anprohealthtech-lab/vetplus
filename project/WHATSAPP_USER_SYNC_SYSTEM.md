# WhatsApp User Synchronization System

## Overview
The WhatsApp User Synchronization system automatically synchronizes LIMS users with the WhatsApp backend database to enable seamless WhatsApp integration for sending PDF reports and managing patient communications.

## Architecture

### Database Schema

#### LIMS Database (Supabase)
The following fields are added to the `users` table:

```sql
-- User synchronization tracking
whatsapp_user_id UUID               -- ID in WhatsApp backend database
whatsapp_sync_status VARCHAR(20)    -- 'pending', 'synced', 'failed', 'disabled'
whatsapp_last_sync TIMESTAMP        -- Last synchronization attempt
whatsapp_sync_error TEXT            -- Error message from failed sync
whatsapp_config JSONB DEFAULT '{}'  -- WhatsApp-specific configuration
whatsapp_auto_sync BOOLEAN DEFAULT true -- Enable/disable auto-sync
```

#### WhatsApp Backend Database (Neon PostgreSQL)
```sql
-- Users table structure (as provided in sample)
{
  "id": "uuid",
  "auth_id": "uuid",                    -- Links to LIMS user.id
  "username": "email",
  "password_hash": "string",
  "name": "clinic_name",
  "role": "mapped_role",
  "clinic_name": "lab_name",
  "clinic_address": "formatted_address",
  "contact_phone": "lab_phone",
  "contact_email": "lab_email",
  "whatsapp_integration_available": true,
  "enabled_features": ["dashboard", "reports", ...],
  // ... other configuration fields
}
```

### System Components

#### 1. WhatsApp User Sync Service (`whatsappUserSync.ts`)
**Core Functions:**
- `syncUserToWhatsApp(userId)` - Sync single user
- `syncAllUsersInLab(labId)` - Bulk sync all users in a lab  
- `handleNewUserCreated(userData)` - Auto-sync for new users
- `getSyncStatus(labId)` - Get synchronization status
- `retryFailedSyncs(labId)` - Retry failed synchronizations

**Data Mapping:**
```typescript
LIMS User + Lab Data → WhatsApp User Format
- user.id → auth_id
- user.email → username  
- lab.name → clinic_name
- formatted address → clinic_address
- role mapping → role conversion
- default configuration → WhatsApp settings
```

#### 2. Auto-Sync Hook (`useWhatsAppAutoSync.ts`)
**Real-time Synchronization:**
- Listens to `users` table INSERT/UPDATE events
- Listens to `labs` table UPDATE events (affects user data)
- Automatic sync triggers for relevant field changes
- Background processing with error handling

**Trigger Conditions:**
- New user creation (`INSERT` on users table)
- User profile changes (name, email, role, lab_id, status)
- Lab information changes (name, address, contact details)

#### 3. Management Interface (`WhatsAppUserSyncManager.tsx`)
**Admin Features:**
- View sync status for all users
- Manual sync individual users
- Bulk sync operations
- Retry failed synchronizations
- Export sync reports
- Configuration management

### Data Flow

#### 1. New User Creation
```
User Registration → LIMS Database → Real-time Trigger → Auto-Sync → WhatsApp Database
```

#### 2. User Updates
```
Profile Update → Field Change Detection → Conditional Sync → Status Update
```

#### 3. Manual Sync
```
Admin Action → API Call → Data Mapping → WhatsApp Backend → Status Update
```

## Installation & Setup

### 1. Database Migration
```sql
-- Run the migration to add sync fields
\i src/migrations/add_whatsapp_user_sync_fields.sql
```

### 2. Environment Configuration
```env
# WhatsApp Backend Configuration
VITE_WHATSAPP_API_URL=http://your-whatsapp-backend-url/api
WHATSAPP_DB_CONNECTION=postgresql://neondb_owner:npg_HclN2sBL5OIF@ep-solitary-salad-a1alphes-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

### 3. Backend API Endpoints
The system expects these endpoints on your WhatsApp backend:

```typescript
POST /api/users                    // Create new user
PUT  /api/users/:id                // Update existing user
GET  /api/users/by-auth-id/:authId // Check if user exists
GET  /api/users/:labId/sync-status // Get sync status
```

## Usage Guide

### For Administrators

#### 1. Access User Sync Manager
- Navigate to **WhatsApp → User Management** tab
- View comprehensive sync status dashboard
- Monitor sync statistics and health

#### 2. Bulk Operations
```typescript
// Sync all users in current lab
const result = await whatsappUserSync.syncAllUsersInLab(labId);

// Retry all failed syncs
const retryResult = await whatsappUserSync.retryFailedSyncs(labId);
```

#### 3. Individual User Management
- Click "Sync" button next to any user
- View detailed error messages for failed syncs
- Monitor last sync timestamps

### For Developers

#### 1. Manual Sync Integration
```typescript
import { whatsappSyncUtils } from '../hooks/useWhatsAppAutoSync';

// Sync a specific user
const result = await whatsappSyncUtils.syncUser(userId);

// Check sync status
const status = await whatsappSyncUtils.checkSyncStatus(userId);

// Toggle auto-sync
await whatsappSyncUtils.toggleAutoSync(userId, false);
```

#### 2. Custom Sync Triggers
```typescript
// Add custom sync logic
useEffect(() => {
  const handleSpecialEvent = async () => {
    await whatsappUserSync.syncUserToWhatsApp(userId);
  };
  
  // Your custom trigger logic
}, [dependencies]);
```

## Configuration Options

### System-wide Settings
```sql
-- Configuration stored in system_config table
whatsapp_auto_sync_enabled: 'true'           -- Enable auto-sync globally
whatsapp_sync_on_user_create: 'true'        -- Auto-sync new users
whatsapp_sync_on_user_update: 'false'       -- Auto-sync user updates
whatsapp_backend_url: 'your_api_url'        -- Backend API URL
whatsapp_sync_batch_size: '10'              -- Batch operation size
```

### User-level Settings
```typescript
// Per-user configuration in whatsapp_config field
{
  "auto_sync": true,
  "custom_role_mapping": "manager",
  "notification_preferences": {
    "sync_success": true,
    "sync_failure": true
  },
  "whatsapp_features": ["reports", "messaging"]
}
```

## Status Definitions

| Status | Description | Actions Available |
|--------|-------------|-------------------|
| `pending` | User not yet synced | Manual sync, Auto-sync |
| `synced` | Successfully synchronized | Re-sync, Update |
| `failed` | Synchronization failed | Retry, Debug |
| `disabled` | Excluded from auto-sync | Enable, Manual sync |

## Error Handling

### Common Error Scenarios
1. **Network Issues**: Connection timeouts, API unavailable
2. **Data Validation**: Invalid email formats, missing required fields
3. **Backend Errors**: WhatsApp API errors, database constraints
4. **Configuration Issues**: Missing lab data, invalid role mappings

### Error Recovery
```typescript
// Automatic retry with exponential backoff
const retrySync = async (userId: string, attempts = 3) => {
  for (let i = 0; i < attempts; i++) {
    try {
      const result = await whatsappUserSync.syncUserToWhatsApp(userId);
      if (result.success) return result;
    } catch (error) {
      if (i === attempts - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
};
```

## Security Considerations

### 1. Data Protection
- **Password Hashing**: Placeholder hashes used (backend handles real hashing)
- **API Authentication**: JWT tokens for all API calls
- **Lab Isolation**: Users can only sync within their lab context

### 2. Permission Checks
```typescript
// Verify user has permission to sync
const canSync = await checkUserPermission(userId, 'whatsapp_sync');
if (!canSync) throw new Error('Insufficient permissions');
```

### 3. Audit Logging
All sync operations are logged with:
- Timestamp of operation
- User who initiated sync
- Success/failure status
- Error details (if applicable)

## Monitoring & Maintenance

### 1. Health Dashboard
- Sync success rates by lab
- Failed sync alerts
- Performance metrics
- System status indicators

### 2. Automated Monitoring
```typescript
// Check for stale syncs (older than 24 hours)
const staleSyncs = await database.query(`
  SELECT * FROM users 
  WHERE whatsapp_sync_status = 'pending' 
  AND created_at < NOW() - INTERVAL '24 hours'
`);
```

### 3. Maintenance Tasks
- **Daily**: Retry failed syncs
- **Weekly**: Cleanup old error logs
- **Monthly**: Sync status report generation

## Troubleshooting

### Issue: Users Not Auto-Syncing
**Check:**
1. Auto-sync hook is initialized in App.tsx
2. Real-time subscriptions are active
3. User has `whatsapp_auto_sync = true`
4. Network connectivity to WhatsApp backend

### Issue: Bulk Sync Failures
**Solutions:**
1. Check batch size configuration
2. Verify backend API rate limits
3. Review error logs for specific failures
4. Test with smaller batches

### Issue: Inconsistent Data
**Resolution:**
1. Force re-sync affected users
2. Compare LIMS vs WhatsApp data
3. Update mapping logic if needed
4. Run data validation checks

## Development Guidelines

### 1. Adding New Sync Fields
```typescript
// 1. Update WhatsApp user interface
interface WhatsAppUser {
  // Add new field
  new_field: string;
}

// 2. Update mapping function
private mapLIMSUserToWhatsApp(user: User, lab: Lab): WhatsAppUser {
  return {
    // ... existing fields
    new_field: user.new_source_field || 'default_value'
  };
}

// 3. Test sync with new field
```

### 2. Custom Role Mapping
```typescript
private mapLIMSRoleToWhatsApp(limsRole: string): string {
  const customMapping = {
    'Laboratory Director': 'admin',
    'Senior Technician': 'manager',
    // Add custom mappings
  };
  
  return customMapping[limsRole] || this.defaultRoleMapping[limsRole] || 'user';
}
```

### 3. Performance Optimization
- Use batch operations for large datasets
- Implement caching for frequently accessed data
- Add database indexes for sync status queries
- Monitor API response times

## API Reference

### Core Sync Functions

#### `syncUserToWhatsApp(userId: string)`
Synchronize a single user to WhatsApp backend.

**Parameters:**
- `userId`: LIMS user ID to sync

**Returns:**
```typescript
{
  success: boolean;
  message: string;
  whatsappUserId?: string;
}
```

#### `syncAllUsersInLab(labId: string)`
Bulk synchronize all users in a lab.

**Parameters:**
- `labId`: Lab ID to sync users for

**Returns:**
```typescript
{
  success: number;    // Count of successful syncs
  failed: number;     // Count of failed syncs
  results: Array<{    // Detailed results
    userId: string;
    email: string;
    success: boolean;
    message: string;
  }>;
}
```

#### `getSyncStatus(labId?: string)`
Get synchronization status for users.

**Parameters:**
- `labId`: Optional lab ID filter

**Returns:**
```typescript
Array<{
  id: string;
  name: string;
  email: string;
  whatsapp_sync_status: string;
  whatsapp_last_sync: string | null;
  whatsapp_user_id: string | null;
  whatsapp_sync_error: string | null;
}>
```

## Future Enhancements

### Planned Features
1. **Advanced Scheduling**: Configurable sync schedules
2. **Data Validation**: Enhanced field validation before sync
3. **Conflict Resolution**: Handle data conflicts between systems
4. **Bulk Import**: CSV import for external user data
5. **API Versioning**: Support multiple WhatsApp backend versions

### Integration Opportunities
1. **Patient Sync**: Extend to synchronize patient data
2. **Order Sync**: Sync order information for better reporting
3. **Analytics Sync**: Sync usage analytics and metrics
4. **Settings Sync**: Synchronize lab preferences and settings

This documentation provides a complete guide for implementing, managing, and troubleshooting the WhatsApp user synchronization system in your LIMS application.