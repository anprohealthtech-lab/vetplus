# 🔄 Refund Process Implementation Guide

## High-Level Overview

The refund system implements a **complete workflow-based refund management** with approval mechanisms, audit trails, and automatic balance updates.

---

## 🎯 Core Concepts

### **1. Two-Level Tracking**
- **Bill-level**: Track total refunded amount per bill
- **Request-level**: Individual refund requests with workflow states

### **2. Workflow States**
```
draft → pending_approval → approved → paid
                      ↓
                  rejected/cancelled
```

### **3. Key Principles**
- ✅ **Idempotent**: Multiple refunds for same bill possible
- ✅ **Auditable**: Every action tracked with timestamps
- ✅ **Safe**: Cannot refund more than paid amount
- ✅ **Flexible**: Item-level or bill-level refunds

---

## 🗄️ Database Schema (Generic)

### **Table 1: Main Transaction Table** (e.g., `bills`, `invoices`, `orders`)

```sql
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS
  total_refunded_amount DECIMAL(10,2) DEFAULT 0 NOT NULL,
  refund_status TEXT DEFAULT 'not_requested' 
    CHECK (refund_status IN (
      'not_requested',    -- No refund initiated
      'partially_refunded', -- Some amount refunded
      'fully_refunded'     -- Entire amount refunded
    )),
  refundable_balance DECIMAL(10,2) GENERATED ALWAYS AS 
    (paid_amount - total_refunded_amount) STORED;

CREATE INDEX idx_transactions_refund_status 
  ON transactions(refund_status);
```

**Key Points:**
- `total_refunded_amount`: Cumulative refunds
- `refund_status`: High-level status for quick filtering
- `refundable_balance`: Auto-calculated (paid - refunded)

---

### **Table 2: Refund Requests** (Workflow tracking)

```sql
CREATE TABLE refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source reference (what's being refunded)
  source_id UUID NOT NULL,           -- ID of bill/invoice/order
  source_type TEXT NOT NULL,          -- 'bill', 'invoice', 'order', etc.
  entity_id UUID NOT NULL,            -- Customer/Patient ID
  
  -- Financial details
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount > 0),
  refunded_items JSONB DEFAULT '[]'::jsonb, -- Item-level breakdown
  refund_method TEXT CHECK (refund_method IN (
    'cash', 'card', 'upi', 'cheque', 'net_banking', 'wallet', 'bank_transfer'
  )),
  
  -- Workflow state
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',              -- Created but not submitted
    'pending_approval',   -- Awaiting authorization
    'approved',           -- Approved, awaiting payment
    'rejected',           -- Rejected by approver
    'paid',              -- Refund completed
    'cancelled'          -- Request cancelled
  )),
  
  -- Metadata
  reason TEXT,                        -- Why refund requested
  internal_notes TEXT,                -- Admin notes
  
  -- Audit trail
  requested_by UUID,                  -- Who created request
  approved_by UUID,                   -- Who approved
  rejected_by UUID,                   -- Who rejected (if applicable)
  paid_by UUID,                       -- Who marked as paid
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Foreign keys
  CONSTRAINT fk_source FOREIGN KEY (source_id) 
    REFERENCES transactions(id) ON DELETE CASCADE,
  CONSTRAINT fk_entity FOREIGN KEY (entity_id) 
    REFERENCES customers(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_refund_requests_source ON refund_requests(source_id);
CREATE INDEX idx_refund_requests_status ON refund_requests(status);
CREATE INDEX idx_refund_requests_entity ON refund_requests(entity_id);
CREATE INDEX idx_refund_requests_created_at ON refund_requests(created_at DESC);
```

**Key Points:**
- **Generic `source_id` + `source_type`**: Works for any transaction type
- **Status workflow**: Clear progression from draft → paid
- **Audit columns**: Track WHO did WHAT and WHEN
- **JSONB for items**: Flexible item-level tracking

---

### **Table 3: Payment Records** (Optional - for accounting)

```sql
CREATE TABLE payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('payment', 'refund')),
  
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Link to refund request (if applicable)
  refund_request_id UUID,
  
  reference_number TEXT,              -- Transaction/receipt number
  notes TEXT,
  recorded_by UUID,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT fk_transaction FOREIGN KEY (transaction_id) 
    REFERENCES transactions(id) ON DELETE CASCADE,
  CONSTRAINT fk_refund_request FOREIGN KEY (refund_request_id) 
    REFERENCES refund_requests(id) ON DELETE SET NULL
);

CREATE INDEX idx_payment_records_transaction ON payment_records(transaction_id);
CREATE INDEX idx_payment_records_type ON payment_records(record_type);
```

---

## 🔄 Database Triggers (Auto-update logic)

### **Trigger 1: Auto-update transaction totals on refund**

```sql
CREATE OR REPLACE FUNCTION update_transaction_refund_totals()
RETURNS TRIGGER AS $$
DECLARE
  total_refunded DECIMAL(10,2);
  paid_amt DECIMAL(10,2);
BEGIN
  -- Calculate total refunded amount for this transaction
  SELECT COALESCE(SUM(total_amount), 0) INTO total_refunded
  FROM refund_requests
  WHERE source_id = NEW.source_id 
    AND status = 'paid';
  
  -- Get paid amount
  SELECT paid_amount INTO paid_amt
  FROM transactions
  WHERE id = NEW.source_id;
  
  -- Update transaction
  UPDATE transactions
  SET 
    total_refunded_amount = total_refunded,
    refund_status = CASE
      WHEN total_refunded = 0 THEN 'not_requested'
      WHEN total_refunded >= paid_amt THEN 'fully_refunded'
      ELSE 'partially_refunded'
    END,
    updated_at = now()
  WHERE id = NEW.source_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_refund_totals
  AFTER INSERT OR UPDATE ON refund_requests
  FOR EACH ROW
  WHEN (NEW.status = 'paid')
  EXECUTE FUNCTION update_transaction_refund_totals();
```

**What it does:**
- Automatically recalculates `total_refunded_amount` on transaction
- Updates `refund_status` based on amounts
- Triggers when refund request marked as 'paid'

---

### **Trigger 2: Prevent over-refunding**

```sql
CREATE OR REPLACE FUNCTION prevent_over_refund()
RETURNS TRIGGER AS $$
DECLARE
  total_refunded DECIMAL(10,2);
  paid_amt DECIMAL(10,2);
BEGIN
  -- Get totals
  SELECT 
    COALESCE(SUM(total_amount), 0) INTO total_refunded
  FROM refund_requests
  WHERE source_id = NEW.source_id 
    AND status IN ('approved', 'paid')
    AND id != NEW.id; -- Exclude current request if updating
  
  SELECT paid_amount INTO paid_amt
  FROM transactions
  WHERE id = NEW.source_id;
  
  -- Check if total would exceed paid amount
  IF (total_refunded + NEW.total_amount) > paid_amt THEN
    RAISE EXCEPTION 'Refund amount exceeds paid amount. Max refundable: %', 
      (paid_amt - total_refunded);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_over_refund
  BEFORE INSERT OR UPDATE ON refund_requests
  FOR EACH ROW
  WHEN (NEW.status IN ('approved', 'paid'))
  EXECUTE FUNCTION prevent_over_refund();
```

**What it does:**
- Prevents creating/approving refunds that exceed paid amount
- Raises exception with clear error message
- Database-level safety net

---

## 🎨 Frontend Implementation Pattern

### **1. Service Layer** (API calls)

```typescript
// refundService.ts
class RefundService {
  // Create new refund request
  async createRefundRequest(data: {
    sourceId: string;
    sourceType: 'bill' | 'invoice' | 'order';
    entityId: string;
    totalAmount: number;
    refundMethod: string;
    reason?: string;
    refundedItems?: any[];
  }): Promise<RefundRequest> {
    const { data: result, error } = await supabase
      .from('refund_requests')
      .insert([{
        source_id: data.sourceId,
        source_type: data.sourceType,
        entity_id: data.entityId,
        total_amount: data.totalAmount,
        refund_method: data.refundMethod,
        reason: data.reason,
        refunded_items: data.refundedItems,
        status: 'pending_approval',
        requested_by: currentUserId
      }])
      .select()
      .single();
    
    if (error) throw error;
    return result;
  }

  // List refund requests
  async listRefundRequests(filters?: {
    sourceId?: string;
    status?: string;
    entityId?: string;
  }): Promise<RefundRequest[]> {
    let query = supabase
      .from('refund_requests')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (filters?.sourceId) query = query.eq('source_id', filters.sourceId);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.entityId) query = query.eq('entity_id', filters.entityId);
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // Approve refund
  async approveRefund(requestId: string, approverId: string): Promise<void> {
    const { error } = await supabase
      .from('refund_requests')
      .update({
        status: 'approved',
        approved_by: approverId,
        approved_at: new Date().toISOString()
      })
      .eq('id', requestId);
    
    if (error) throw error;
  }

  // Reject refund
  async rejectRefund(requestId: string, rejecterId: string, reason?: string): Promise<void> {
    const { error } = await supabase
      .from('refund_requests')
      .update({
        status: 'rejected',
        rejected_by: rejecterId,
        rejected_at: new Date().toISOString(),
        internal_notes: reason
      })
      .eq('id', requestId);
    
    if (error) throw error;
  }

  // Mark as paid
  async markRefundPaid(requestId: string, data: {
    amount: number;
    paymentMethod: string;
    paidBy: string;
    notes?: string;
  }): Promise<void> {
    // Start transaction
    const { error: updateError } = await supabase
      .from('refund_requests')
      .update({
        status: 'paid',
        paid_by: data.paidBy,
        paid_at: new Date().toISOString()
      })
      .eq('id', requestId);
    
    if (updateError) throw updateError;

    // Record payment
    const { error: paymentError } = await supabase
      .from('payment_records')
      .insert([{
        transaction_id: sourceId, // Get from refund request
        record_type: 'refund',
        amount: -data.amount,     // Negative for refund
        payment_method: data.paymentMethod,
        refund_request_id: requestId,
        notes: data.notes,
        recorded_by: data.paidBy
      }]);
    
    if (paymentError) throw paymentError;
    
    // Trigger will auto-update transaction totals
  }
}
```

---

### **2. UI Component Structure**

```typescript
// RefundRequestModal.tsx
const RefundRequestModal = ({ transaction, onClose, onRefresh }) => {
  // State
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState('cash');
  const [reason, setReason] = useState('');
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  
  // Calculate refundable amount
  const refundableAmount = transaction.paidAmount - transaction.totalRefundedAmount;
  
  // Load existing requests
  useEffect(() => {
    loadRequests();
  }, [transaction.id]);
  
  // Submit new request
  const handleSubmit = async () => {
    await refundService.createRefundRequest({
      sourceId: transaction.id,
      sourceType: 'bill',
      entityId: transaction.customerId,
      totalAmount: amount,
      refundMethod: method,
      reason: reason
    });
    await loadRequests();
  };
  
  // Approve request (admin only)
  const handleApprove = async (requestId) => {
    await refundService.approveRefund(requestId, currentUserId);
    await loadRequests();
  };
  
  // Mark as paid (admin only)
  const handleMarkPaid = async (request) => {
    await refundService.markRefundPaid(request.id, {
      amount: request.totalAmount,
      paymentMethod: request.refundMethod,
      paidBy: currentUserId
    });
    await loadRequests();
  };
  
  return (
    <Modal>
      {/* Left: Create new request form */}
      <Form onSubmit={handleSubmit}>
        <Input 
          type="number" 
          max={refundableAmount}
          value={amount}
          onChange={setAmount}
        />
        <Select value={method} onChange={setMethod}>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          {/* ... */}
        </Select>
        <Textarea value={reason} onChange={setReason} />
        <Button type="submit">Submit Request</Button>
      </Form>
      
      {/* Right: List of existing requests */}
      <RequestList>
        {requests.map(request => (
          <RequestCard key={request.id}>
            <StatusBadge status={request.status} />
            <Amount>₹{request.totalAmount}</Amount>
            <Reason>{request.reason}</Reason>
            
            {/* Admin actions */}
            {canManage && (
              <>
                {request.status === 'pending_approval' && (
                  <>
                    <Button onClick={() => handleApprove(request.id)}>
                      Approve
                    </Button>
                    <Button onClick={() => handleReject(request.id)}>
                      Reject
                    </Button>
                  </>
                )}
                
                {request.status === 'approved' && (
                  <Button onClick={() => handleMarkPaid(request)}>
                    Mark Paid
                  </Button>
                )}
              </>
            )}
          </RequestCard>
        ))}
      </RequestList>
    </Modal>
  );
};
```

---

## 🔐 Permission Model

### **Role-based Actions**

```typescript
// Permission checks
const canCreateRefundRequest = true; // Anyone can request

const canApproveRefund = user.hasPermission([
  'manage_billing',
  'approve_refunds',
  'manage_finance'
]);

const canMarkRefundPaid = user.hasPermission([
  'manage_billing',
  'record_payments',
  'manage_finance'
]);
```

### **Database RLS Policies**

```sql
-- Anyone can create refund requests for their clinic
CREATE POLICY "Users can create refund requests"
  ON refund_requests FOR INSERT
  WITH CHECK (
    source_id IN (
      SELECT id FROM transactions 
      WHERE clinic_id = current_user_clinic_id()
    )
  );

-- Users can view refund requests in their clinic
CREATE POLICY "Users can view refund requests"
  ON refund_requests FOR SELECT
  USING (
    source_id IN (
      SELECT id FROM transactions 
      WHERE clinic_id = current_user_clinic_id()
    )
  );

-- Only authorized users can approve/reject/mark paid
CREATE POLICY "Authorized users can manage refunds"
  ON refund_requests FOR UPDATE
  USING (
    source_id IN (
      SELECT id FROM transactions 
      WHERE clinic_id = current_user_clinic_id()
    )
    AND current_user_has_permission('approve_refunds')
  );
```

---

## 📊 Reporting Queries

### **1. Refund Summary Report**

```sql
SELECT 
  DATE_TRUNC('month', paid_at) AS month,
  COUNT(*) AS total_refunds,
  SUM(total_amount) AS total_refunded,
  AVG(total_amount) AS avg_refund_amount,
  COUNT(*) FILTER (WHERE refund_method = 'cash') AS cash_refunds,
  COUNT(*) FILTER (WHERE refund_method = 'card') AS card_refunds
FROM refund_requests
WHERE status = 'paid'
  AND clinic_id = $1
  AND paid_at >= $2 AND paid_at <= $3
GROUP BY month
ORDER BY month DESC;
```

### **2. Pending Approval Dashboard**

```sql
SELECT 
  rr.id,
  rr.total_amount,
  rr.reason,
  rr.created_at,
  t.transaction_number,
  c.name AS customer_name,
  u.name AS requested_by_name
FROM refund_requests rr
JOIN transactions t ON t.id = rr.source_id
JOIN customers c ON c.id = rr.entity_id
JOIN users u ON u.id = rr.requested_by
WHERE rr.status = 'pending_approval'
  AND rr.clinic_id = $1
ORDER BY rr.created_at ASC;
```

### **3. Audit Trail Query**

```sql
SELECT 
  rr.id,
  rr.status,
  rr.total_amount,
  rr.created_at,
  rr.approved_at,
  rr.paid_at,
  req_user.name AS requested_by,
  app_user.name AS approved_by,
  paid_user.name AS paid_by,
  (rr.paid_at - rr.created_at) AS processing_time
FROM refund_requests rr
LEFT JOIN users req_user ON req_user.id = rr.requested_by
LEFT JOIN users app_user ON app_user.id = rr.approved_by
LEFT JOIN users paid_user ON paid_user.id = rr.paid_by
WHERE rr.source_id = $1
ORDER BY rr.created_at DESC;
```

---

## 🎯 Key Takeaways for Your LIMS

### **1. Database Design**
- ✅ Add refund columns to main transaction table
- ✅ Create separate `refund_requests` table for workflow
- ✅ Use triggers to auto-update totals
- ✅ Add database-level checks (prevent over-refunding)

### **2. Workflow States**
- ✅ draft → pending_approval → approved → paid
- ✅ Track WHO did WHAT and WHEN (audit trail)
- ✅ Allow rejection/cancellation at any stage

### **3. Safety Measures**
- ✅ Cannot refund more than paid amount (trigger enforces)
- ✅ Requires approval before actual refund
- ✅ Separate "approve" and "mark paid" actions
- ✅ Audit trail for compliance

### **4. Flexibility**
- ✅ Support multiple refund methods
- ✅ Item-level or full refunds (JSONB field)
- ✅ Generic `source_type` works for any transaction
- ✅ Status-based filtering for reports

### **5. User Experience**
- ✅ Single modal shows: form + existing requests
- ✅ Real-time balance calculation
- ✅ Role-based action buttons
- ✅ Clear status indicators

This same pattern can be applied to **invoices, lab orders, prescriptions, or any transactional entity** in your LIMS! Just replace `transactions` with your table name and adjust field names. 🎉