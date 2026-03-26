# Account Form - B2B Portal Access Guide

## ✅ Fixed: Modal is Now Scrollable!

The account creation modal has been updated to be scrollable. You can now see all fields including the B2B Portal Access section at the bottom.

---

## Where to Find the Password Fields

### **Location**: Account Master → New Account Form

1. Go to **Account Master** page (`/masters/accounts`)
2. Click **"+ Add Account"** button
3. Fill in the basic account information:
   - Account Name
   - Account Code
   - Account Type (Hospital, Corporate, etc.)
   - Email, Phone
   - Address
   - Credit Limit
   - Default Discount
   - Billing Mode

4. **Scroll down** to the bottom of the form

5. You will see a section titled:
   **"Enable B2B Portal Access"** with a checkbox and lock icon

6. **Check the checkbox** to enable portal access

7. Two new fields will appear:
   - **Portal Login Email** (required)
   - **Portal Password** (required, minimum 8 characters)

---

## Visual Guide

```
┌─────────────────────────────────────────┐
│  New Account                         [X]│
├─────────────────────────────────────────┤
│                                         │
│  Account Name: [________________]       │
│  Account Code: [____] Type: [Hospital▼]│
│  Email: [________________]              │
│  Phone: [________________]              │
│  Address: [_____________________]       │
│  Credit Limit: [0] Discount: [0]        │
│                                         │
│  ○ Standard Billing                     │
│  ○ Monthly Consolidated Billing         │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ☐ Enable B2B Portal Access      │   │ ← CHECK THIS
│  │                                  │   │
│  │ Allow this account to access...  │   │
│  │                                  │   │
│  │ ┌─────────────────────────────┐ │   │
│  │ │ Portal Login Email *        │ │   │
│  │ │ [portal@hospital.com]       │ │   │
│  │ │                             │ │   │
│  │ │ Portal Password *           │ │   │
│  │ │ [••••••••••]                │ │   │ ← PASSWORD HERE
│  │ │ Minimum 8 characters        │ │   │
│  │ │                             │ │   │
│  │ │ Portal URL: yourlab.com/b2b │ │   │
│  │ └─────────────────────────────┘ │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│              [Cancel]  [Save]           │
└─────────────────────────────────────────┘
```

---

## Important Notes

### ✅ **Password Field is ONLY for New Accounts**
- The B2B Portal Access section only appears when **creating a new account**
- It will NOT appear when **editing an existing account**
- This is by design - portal access is set up during account creation

### ✅ **Password Requirements**
- Minimum 8 characters
- Can include letters, numbers, special characters
- Will be used by the B2B account to login at `/b2b`

### ✅ **What Happens When You Save**
1. Account is created in the database
2. Edge function `create-b2b-user` is called
3. Auth user is created with the email and password
4. Success message shows:
   - Portal URL
   - Login email
   - Instructions to share with the account

---

## If You Don't See the Password Fields

### **Checklist:**
1. ✅ Are you creating a **NEW** account? (Not editing)
2. ✅ Did you **scroll down** to the bottom of the form?
3. ✅ Did you **check the checkbox** "Enable B2B Portal Access"?
4. ✅ Is the modal **scrollable**? (Should be fixed now)

### **If Still Not Visible:**
- Refresh the page
- Clear browser cache
- Check browser console for errors
- Verify you're on the latest code version

---

## User Management Page

### **Question: Can I set passwords in User Management?**

**Answer:** No, the User Management page is for **lab staff users** (admins, technicians, doctors), not B2B account users.

**B2B account users are created through:**
- Account Master → New Account → Enable Portal Access

**Lab staff users are created through:**
- User Management → Add User

These are **two separate systems**:
- **Lab Users**: Access the full LIMS system
- **B2B Users**: Access only the B2B portal

---

## Testing

### **Test the Scrollable Form:**
1. Go to Account Master
2. Click "Add Account"
3. Try scrolling in the modal
4. You should be able to see all fields including the B2B Portal Access section at the bottom

### **Test Creating B2B Account:**
1. Fill in all account details
2. Scroll to bottom
3. Check "Enable B2B Portal Access"
4. Enter email and password
5. Click Save
6. Should see success message with portal URL

---

## Summary

✅ **Modal is now scrollable** - You can see all fields
✅ **Password fields are at the bottom** - Scroll down and check the checkbox
✅ **Only for new accounts** - Not available when editing
✅ **Separate from User Management** - B2B users ≠ Lab users

The password field is there, you just need to:
1. Create a **new** account (not edit)
2. **Scroll down** to the bottom
3. **Check** "Enable B2B Portal Access"
4. Enter email and password
