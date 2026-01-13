# Multiple Subdomain Support - Configuration Guide

## ✅ Updated: Dynamic Subdomain Support

The application now supports multiple subdomains dynamically without hardcoded URLs.

---

## 🌐 Supported Subdomains

### **Production Subdomains:**
- `app.limsapp.in` ✅
- `application.limsapp.in` ✅
- Any other subdomain of `limsapp.in` ✅

### **How It Works:**
The application automatically detects the current hostname and uses it for API calls.

---

## 🔧 Changes Made

### **File Updated:**
`src/utils/whatsappAPI.ts`

### **Before:**
```typescript
const WHATSAPP_API_BASE_URL =
  (import.meta as any).env?.VITE_WHATSAPP_API_BASE_URL ||
  'https://app.limsapp.in/whatsapp';  // ❌ Hardcoded
```

### **After:**
```typescript
const getDefaultWhatsAppBaseUrl = () => {
  // In production, use current hostname
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}/whatsapp`;  // ✅ Dynamic
  }
  // Fallback for development/SSR
  return 'https://app.limsapp.in/whatsapp';
};

const WHATSAPP_API_BASE_URL =
  (import.meta as any).env?.VITE_WHATSAPP_API_BASE_URL ||
  getDefaultWhatsAppBaseUrl();
```

---

## 🎯 URL Resolution Logic

### **1. Environment Variable (Highest Priority)**
```bash
VITE_WHATSAPP_API_BASE_URL=https://custom.domain.com/whatsapp
```
If set, this overrides everything.

### **2. Current Hostname (Production)**
```
User visits: https://application.limsapp.in
API calls go to: https://application.limsapp.in/whatsapp
```

```
User visits: https://app.limsapp.in
API calls go to: https://app.limsapp.in/whatsapp
```

### **3. Fallback (Development)**
```
User visits: http://localhost:8888
API calls go to: https://app.limsapp.in/whatsapp
```

---

## 🧪 Testing

### **Test 1: app.limsapp.in**
1. Visit `https://app.limsapp.in`
2. Open browser console
3. Check WhatsApp API calls
4. Should use: `https://app.limsapp.in/whatsapp`

### **Test 2: application.limsapp.in**
1. Visit `https://application.limsapp.in`
2. Open browser console
3. Check WhatsApp API calls
4. Should use: `https://application.limsapp.in/whatsapp`

### **Test 3: Local Development**
1. Visit `http://localhost:8888`
2. Open browser console
3. Check WhatsApp API calls
4. Should use: `https://app.limsapp.in/whatsapp` (fallback)

---

## 📋 DNS Configuration Needed

For `application.limsapp.in` to work, you need:

### **Option 1: CNAME Record**
```
Type: CNAME
Name: application
Value: your-site.netlify.app
TTL: 3600
```

### **Option 2: A Record**
```
Type: A
Name: application
Value: 75.2.60.5 (Netlify IP)
TTL: 3600
```

### **Netlify Configuration:**
1. Go to Netlify Dashboard
2. Domain Settings
3. Add custom domain: `application.limsapp.in`
4. Verify DNS configuration
5. Enable HTTPS

---

## ✅ Benefits

### **1. No Hardcoded URLs**
- Works with any subdomain
- No code changes needed for new subdomains

### **2. Automatic Detection**
- Uses current hostname
- No manual configuration

### **3. Environment Override**
- Can still override via env variable
- Useful for testing/staging

### **4. Backward Compatible**
- `app.limsapp.in` still works
- No breaking changes

---

## 🔍 Other Files Checked

### **Files Scanned:**
- ✅ `src/utils/whatsappAPI.ts` - Updated
- ✅ `netlify/functions/branding-upload.js` - Already dynamic
- ✅ Other Netlify functions - Use external APIs only

### **Result:**
Only one hardcoded URL found and fixed!

---

## 🚀 Deployment

### **No Additional Steps Needed:**
The code change is already committed. Just deploy:

```bash
git add src/utils/whatsappAPI.ts
git commit -m "feat: Dynamic subdomain support for WhatsApp API"
git push

# Or deploy directly
netlify deploy --prod
```

---

## 📝 Configuration Summary

| Scenario | Hostname | API Base URL |
|----------|----------|--------------|
| Production (app) | `app.limsapp.in` | `https://app.limsapp.in/whatsapp` |
| Production (application) | `application.limsapp.in` | `https://application.limsapp.in/whatsapp` |
| Local Development | `localhost` | `https://app.limsapp.in/whatsapp` |
| Custom (env var) | Any | Value from `VITE_WHATSAPP_API_BASE_URL` |

---

## ⚠️ Important Notes

### **1. DNS Must Be Configured**
- `application.limsapp.in` must point to Netlify
- SSL certificate must be provisioned
- Can take 10-20 minutes after DNS setup

### **2. Netlify Domain Must Be Added**
- Add `application.limsapp.in` in Netlify dashboard
- Verify DNS configuration
- Enable HTTPS

### **3. Both Subdomains Work Independently**
- `app.limsapp.in` → Uses `app.limsapp.in` for APIs
- `application.limsapp.in` → Uses `application.limsapp.in` for APIs
- No cross-domain issues

---

## 🎯 Next Steps

1. **Configure DNS** for `application.limsapp.in`
2. **Add to Netlify** domain settings
3. **Wait for DNS** propagation (10-30 minutes)
4. **Test** both subdomains
5. **Verify** WhatsApp API calls use correct hostname

---

## ✅ Success Criteria

- [ ] `app.limsapp.in` works correctly
- [ ] `application.limsapp.in` works correctly
- [ ] WhatsApp API calls use current hostname
- [ ] No hardcoded URLs remain
- [ ] Both subdomains can be used interchangeably

---

**Status**: ✅ Complete
**Breaking Changes**: None
**Deployment**: Ready

The application now supports multiple subdomains dynamically! 🚀
