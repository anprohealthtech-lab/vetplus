# Location & Currency Implementation - Updated

## Overview
This document describes the automatic location inheritance and currency detection system.

---

## 1. Location Inheritance (Order → Invoice)

### How It Works

**Automatic Flow:**
```
1. User creates ORDER → must select location_id (if enforce_location_restrictions = true)
   ↓
2. ORDER is created with location_id
   ↓
3. INVOICE is created from ORDER
   ↓
4. Database trigger automatically copies location_id from ORDER to INVOICE
   ↓
5. INVOICE now has the same location_id as ORDER (no manual selection needed)
```

### Database Trigger

**File**: `supabase/migrations/20260106_auto_set_invoice_location.sql`

```sql
CREATE FUNCTION set_invoice_location_from_order()
RETURNS TRIGGER AS $$
BEGIN
  -- If invoice has an order_id and location_id is not already set
  IF NEW.order_id IS NOT NULL AND NEW.location_id IS NULL THEN
    -- Get location_id from the order
    SELECT location_id INTO NEW.location_id
    FROM orders
    WHERE id = NEW.order_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_invoice_location_from_order
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_location_from_order();
```

### Schema Relationships

```
orders table:
  - location_id (where order was created)
  - collected_at_location_id (where sample was collected)
  
invoices table:
  - location_id (inherited from orders.location_id)
  - order_id (links to orders table)
```

### Location Filtering in Billing

The location dropdown in Billing page is **NOT for creating invoices** - it's for **filtering/viewing** invoices by location.

**Use Cases:**
1. **Admin** wants to see all invoices from all locations
2. **Branch Manager** wants to see only their branch's invoices
3. **Accountant** wants to filter by specific location for reconciliation

**Important**: The invoice's location is already set from the order - the dropdown only filters the view.

---

## 2. Currency Auto-Detection

### How It Works

**Automatic Flow:**
```
1. Lab selects country_code (e.g., +92 for Pakistan)
   ↓
2. Database trigger automatically sets currency_code to PKR
   ↓
3. All invoices, bills, reports use PKR currency
```

### Country → Currency Mapping

| Country Code | Country | Currency | Symbol |
|--------------|---------|----------|--------|
| `+91` | India | INR | ₹ |
| `+92` | Pakistan | PKR | Rs |
| `+94` | Sri Lanka | LKR | Rs |
| `+971` | UAE | AED | د.إ |
| `+880` | Bangladesh | BDT | ৳ |
| `+977` | Nepal | NPR | Rs |

### Database Trigger

**File**: `supabase/migrations/20260106_add_currency_to_labs.sql`

```sql
CREATE FUNCTION set_currency_from_country_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.currency_code := CASE 
    WHEN NEW.country_code = '+92' THEN 'PKR'
    WHEN NEW.country_code = '+94' THEN 'LKR'
    WHEN NEW.country_code = '+971' THEN 'AED'
    WHEN NEW.country_code = '+880' THEN 'BDT'
    WHEN NEW.country_code = '+977' THEN 'NPR'
    ELSE 'INR'
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_currency_from_country
  BEFORE INSERT OR UPDATE OF country_code ON labs
  FOR EACH ROW
  EXECUTE FUNCTION set_currency_from_country_code();
```

---

## 3. Complete Data Flow

### Order Creation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Create Order                                        │
└─────────────────────────────────────────────────────────────┘
User creates order
  ↓
IF enforce_location_restrictions = true:
  → User MUST select location_id (required field)
ELSE:
  → location_id is optional
  ↓
Order saved with location_id = "location-uuid"


┌─────────────────────────────────────────────────────────────┐
│ Step 2: Create Invoice from Order                          │
└─────────────────────────────────────────────────────────────┘
Invoice created with order_id
  ↓
Trigger: set_invoice_location_from_order()
  ↓
Invoice.location_id = Order.location_id (automatic)
  ↓
Invoice saved with inherited location_id


┌─────────────────────────────────────────────────────────────┐
│ Step 3: View/Filter Invoices                               │
└─────────────────────────────────────────────────────────────┘
User goes to Billing page
  ↓
IF user has multiple accessible locations:
  → Show location dropdown for filtering
  ↓
User selects location (or "All Locations")
  ↓
Display only invoices matching selected location
```

### Currency Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Lab Setup                                                   │
└─────────────────────────────────────────────────────────────┘
Lab selects country_code = "+92" (Pakistan)
  ↓
Trigger: set_currency_from_country_code()
  ↓
Lab.currency_code = "PKR" (automatic)


┌─────────────────────────────────────────────────────────────┐
│ Display Amounts                                             │
└─────────────────────────────────────────────────────────────┘
Frontend calls: getLabCurrency()
  ↓
Returns: "PKR"
  ↓
formatCurrency(1500, "PKR")
  ↓
Display: "Rs 1,500.00"
```

---

## 4. Implementation Files

### Database Migrations
- ✅ `20260106_add_currency_to_labs.sql` - Currency auto-detection
- ✅ `20260106_auto_set_invoice_location.sql` - Location inheritance

### Frontend Files
- ✅ `src/utils/currencyFormatter.ts` - Currency formatting utility
- ✅ `src/pages/Billing.tsx` - Location filter dropdown (for viewing only)

---

## 5. Key Points

### Location
- ✅ **Order creation**: User selects location (if enforcement is on)
- ✅ **Invoice creation**: Location is **automatically inherited** from order
- ✅ **Billing page**: Location dropdown is for **filtering view**, not setting location
- ✅ **No manual selection**: Invoice location is never manually set

### Currency
- ✅ **Lab setup**: User selects country code
- ✅ **Currency auto-set**: Database trigger sets currency from country
- ✅ **No manual selection**: Currency is never manually selected
- ✅ **Display**: All amounts formatted with lab's currency

---

## 6. Migration Steps

### Apply Both Migrations

```bash
# Via Supabase Dashboard
# 1. Run: 20260106_add_currency_to_labs.sql
# 2. Run: 20260106_auto_set_invoice_location.sql
```

Or via CLI:
```bash
supabase db push
```

### Verify

```sql
-- Check currency auto-detection
SELECT id, name, country_code, currency_code 
FROM labs 
LIMIT 5;

-- Check invoice location inheritance
SELECT i.id, i.order_id, i.location_id as invoice_location, o.location_id as order_location
FROM invoices i
JOIN orders o ON i.order_id = o.id
LIMIT 10;
```

---

## 7. Testing Checklist

### Currency
- [ ] Change lab country_code to `+92`
- [ ] Verify currency_code auto-changes to `PKR`
- [ ] Create invoice, verify amounts show "Rs" symbol

### Location
- [ ] Create order with location_id = "location-A"
- [ ] Create invoice from that order
- [ ] Verify invoice.location_id = "location-A" (automatic)
- [ ] Go to Billing page
- [ ] Use location dropdown to filter by "location-A"
- [ ] Verify invoice appears in filtered list

---

## Summary

✅ **Location**: Automatically inherited from order → invoice (no manual selection)  
✅ **Currency**: Automatically set from country code (no manual selection)  
✅ **Billing Filter**: Location dropdown is for viewing/filtering, not creating  
✅ **Database Triggers**: Handle all automatic assignments  

**Both features are fully automatic!** 🎉
