# Dashboard Order & Payment Enhancement Plan

## Objective
Enhance the **Dashboard Page** order creation form to support:
1. **Dynamic Test Management** - Add/Delete tests while creating order
2. **Discount Application** - Percentage or fixed discount during order creation
3. **Payment Collection** - Collect payment immediately on order creation
4. **Auto-Generate Invoice & Payment Entry** - Seamless order → invoice → payment workflow

---

## 1. Dashboard Order Form - Enhanced Test Selection

### UI Changes (Dashboard.tsx - Order Creation Section)

**Location**: Dashboard page's order creation form (not a modal, inline form)

**Current Flow**: Patient selection → Test selection → Submit
**Enhanced Flow**: Patient selection → Dynamic Test Management → Discount → Payment → Submit

**New Features in Test Selection**:
- **Dynamic Test List** with add/remove capability
- **Test Search/Filter** for quick selection
- **Real-time Price Calculation** as tests are added/removed

**Component Structure**:
```tsx
<DashboardOrderForm>
  {/* Patient Selection - EXISTING */}
  <PatientSelector />
  
  {/* ENHANCED: Dynamic Test Management */}
  <TestManagementSection>
    <SelectedTestsList>
      {selectedTests.map(test => (
        <TestRow key={test.id}>
          <TestName>{test.name}</TestName>
          <TestPrice>₹{test.price}</TestPrice>
          <RemoveButton onClick={() => removeTest(test.id)}>
            ✕
          </RemoveButton>
        </TestRow>
      ))}
    </SelectedTestsList>
    
    <AddTestDropdown>
      <SearchInput placeholder="Search tests..." />
      <TestOptions>
        {availableTests.map(test => (
          <TestOption onClick={() => addTest(test)}>
            {test.name} - ₹{test.price}
          </TestOption>
        ))}
      </TestOptions>
    </AddTestDropdown>
    
    <Subtotal>Subtotal: ₹{calculateSubtotal()}</Subtotal>
  </TestManagementSection>
  
  {/* Continue with discount & payment sections below... */}
</DashboardOrderForm>
```

---

## 2. Dashboard Order Form - Discount & Payment

### UI Changes (Dashboard.tsx - Create Order Modal)

**New Fields**:
```tsx
<CreateOrderModal>
  {/* Existing fields: patient, doctor, tests, etc. */}
  
  {/* NEW SECTION: Pricing & Payment */}
  <PricingSection>
    <SubTotal>{subtotal}</SubTotal>
    
    <DiscountInput>
      <DiscountType> {/* Percentage or Fixed */}
        <Radio value="percentage">%</Radio>
        <Radio value="fixed">₹</Radio>
      </DiscountType>
      <DiscountValue 
        type="number" 
        placeholder="Enter discount"
        onChange={handleDiscountChange}
      />
    </DiscountInput>
    
    <FinalTotal>{total - discount}</FinalTotal>
    
    <PaymentSection>
      <PaymentMethodSelect>
        <Option value="cash">Cash</Option>
        <Option value="card">Card</Option>
        <Option value="upi">UPI</Option>
        <Option value="online">Online</Option>
      </PaymentMethodSelect>
      
      <AmountPaidInput 
        type="number"
        placeholder="Amount collected"
        max={finalTotal}
      />
      
      <BalanceDue>{finalTotal - amountPaid}</BalanceDue>
    </PaymentSection>
  </PricingSection>
  
  <CreateOrderButton onClick={handleCreateWithPayment} />
</CreateOrderModal>
```

---

## 3. Backend Implementation

### Database Schema Updates

#### A. Add discount fields to `orders` table (if not exists):
```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20); -- 'percentage', 'fixed'
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS final_amount DECIMAL(10,2);
```

#### B. Ensure `invoices` table has:
```sql
-- Already exists, but verify:
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  invoice_number VARCHAR(50) UNIQUE,
  subtotal DECIMAL(10,2),
  discount_amount DECIMAL(10,2),
  tax_amount DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  payment_status VARCHAR(20), -- 'paid', 'partial', 'unpaid'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### C. Ensure `payments` table has:
```sql
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  invoice_id UUID REFERENCES invoices(id),
  amount DECIMAL(10,2),
  payment_method VARCHAR(50), -- 'cash', 'card', 'upi', 'online'
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  transaction_id VARCHAR(100),
  notes TEXT,
  created_by UUID REFERENCES users(id)
);
```

---

### Edge Function: `create-order-with-payment`

**Location**: `supabase/functions/create-order-with-payment/index.ts`

**Input Payload**:
```typescript
{
  patient_id: string,
  test_ids: string[],
  discount_type?: 'percentage' | 'fixed',
  discount_value?: number,
  payment_method?: string,
  amount_paid?: number,
  referring_doctor_id?: string,
  location_id?: string
}
```

**Logic**:
1. **Create Order**
   - Insert into `orders` table
   - Insert into `order_tests` table
   - Calculate subtotal, discount, final_amount
   
2. **Generate Invoice**
   - Create unique invoice_number
   - Insert into `invoices` table
   - Link to order_id
   - Set payment_status based on amount_paid
   
3. **Record Payment** (if amount_paid > 0)
   - Insert into `payments` table
   - Link to order_id and invoice_id
   - Record payment_method
   
4. **Return Response**
   ```typescript
   {
     order_id,
     invoice_id,
     payment_id,
     balance_due
   }
   ```

---

## 4. Frontend Service Layer

### File: `src/services/orderService.ts`

**New Functions**:

```typescript
// Enhanced order creation with payment
export async function createOrderWithPayment(orderData: {
  patientId: string;
  testIds: string[];
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  paymentMethod?: string;
  amountPaid?: number;
  referringDoctorId?: string;
  locationId?: string;
}) {
  const { data, error } = await supabase.functions.invoke('create-order-with-payment', {
    body: orderData
  });
  
  if (error) throw error;
  return data;
}

// Add test to existing order
export async function addTestToOrder(orderId: string, testId: string) {
  // 1. Insert into order_tests
  const { error: insertError } = await supabase
    .from('order_tests')
    .insert({ order_id: orderId, test_group_id: testId });
  
  if (insertError) throw insertError;
  
  // 2. Recalculate order total
  await recalculateOrderTotal(orderId);
  
  // 3. Update invoice if exists
  await updateInvoiceForOrder(orderId);
}

// Remove test from order
export async function removeTestFromOrder(orderId: string, testId: string) {
  const { error } = await supabase
    .from('order_tests')
    .delete()
    .eq('order_id', orderId)
    .eq('test_group_id', testId);
  
  if (error) throw error;
  
  await recalculateOrderTotal(orderId);
  await updateInvoiceForOrder(orderId);
}

// Helper: Recalculate order total
async function recalculateOrderTotal(orderId: string) {
  // Fetch all tests for order
  const { data: orderTests } = await supabase
    .from('order_tests')
    .select('test_group_id, test_groups(price)')
    .eq('order_id', orderId);
  
  const subtotal = orderTests.reduce((sum, ot) => sum + (ot.test_groups?.price || 0), 0);
  
  // Get discount from order
  const { data: order } = await supabase
    .from('orders')
    .select('discount_type, discount_value')
    .eq('id', orderId)
    .single();
  
  let discountAmount = 0;
  if (order.discount_type === 'percentage') {
    discountAmount = (subtotal * order.discount_value) / 100;
  } else if (order.discount_type === 'fixed') {
    discountAmount = order.discount_value;
  }
  
  const finalAmount = subtotal - discountAmount;
  
  // Update order
  await supabase
    .from('orders')
    .update({ 
      total_amount: subtotal,
      discount_amount: discountAmount,
      final_amount: finalAmount
    })
    .eq('id', orderId);
}
```

---

## 5. UI Component Updates

### Dashboard.tsx

**State Management**:
```typescript
const [selectedOrder, setSelectedOrder] = useState(null);
const [showAddTest, setShowAddTest] = useState(false);
const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
const [discountValue, setDiscountValue] = useState(0);
const [paymentMethod, setPaymentMethod] = useState('cash');
const [amountPaid, setAmountPaid] = useState(0);
```

**Handler Functions**:
```typescript
const handleAddTestToOrder = async (orderId: string, testId: string) => {
  try {
    await addTestToOrder(orderId, testId);
    toast.success('Test added successfully');
    refreshOrderDetails();
  } catch (error) {
    toast.error('Failed to add test');
  }
};

const handleRemoveTestFromOrder = async (orderId: string, testId: string) => {
  if (!confirm('Remove this test from the order?')) return;
  
  try {
    await removeTestFromOrder(orderId, testId);
    toast.success('Test removed');
    refreshOrderDetails();
  } catch (error) {
    toast.error('Failed to remove test');
  }
};

const handleCreateOrderWithPayment = async () => {
  try {
    const result = await createOrderWithPayment({
      patientId: selectedPatient.id,
      testIds: selectedTests,
      discountType,
      discountValue,
      paymentMethod,
      amountPaid
    });
    
    toast.success(`Order created! Balance: ₹${result.balance_due}`);
    onOrderCreated(result);
  } catch (error) {
    toast.error('Failed to create order');
  }
};
```

---

## 6. Migration Plan

### Step 1: Database Schema
```bash
# Create migration file
supabase/migrations/20260108160000_order_payment_enhancements.sql
```

### Step 2: Edge Function
```bash
# Create new edge function
supabase functions new create-order-with-payment
```

### Step 3: Frontend Services
- Update `orderService.ts`
- Update `invoiceService.ts`
- Update `paymentService.ts`

### Step 4: UI Components
- Update `Dashboard.tsx`
- Create `OrderTestManager.tsx` component
- Create `PaymentCollector.tsx` component

### Step 5: Testing
- Test add/remove tests from order
- Test discount calculation (percentage & fixed)
- Test payment collection
- Test invoice auto-generation
- Test partial payment scenarios

---

## 7. User Flow Example

### Scenario: Create Order with Immediate Payment

1. **User clicks "Create Order" on Dashboard**
2. **Selects Patient** → Auto-fills patient details
3. **Selects Tests** → Shows prices, calculates subtotal
4. **Applies Discount** → 10% discount → New total shown
5. **Collects Payment** → ₹500 cash → Balance shown
6. **Clicks "Create Order"**
7. **System**:
   - Creates order record
   - Creates invoice with discount
   - Records ₹500 payment
   - Shows confirmation with balance due

### Scenario: Add Test to Existing Order

1. **User opens Order Details from Dashboard**
2. **Clicks "Add Test" button**
3. **Selects new test from catalog**
4. **System**:
   - Adds test to `order_tests`
   - Recalculates order total
   - Updates existing invoice
   - Shows updated total

---

## 8. Security Considerations

- **RLS Policies**: Ensure users can only modify orders from their lab
- **Payment Verification**: Validate amount_paid <= final_amount
- **Audit Trail**: Log all order modifications
- **Invoice Integrity**: Prevent manual invoice tampering

---

## 9. Next Steps

Would you like me to:
1. ✅ Start with database migration?
2. ✅ Create the edge function?
3. ✅ Update the Dashboard UI?
4. ✅ All of the above in sequence?

Let me know how you'd like to proceed!
