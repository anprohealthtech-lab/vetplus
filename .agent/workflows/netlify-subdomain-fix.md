# Netlify Function Subdomain Fix

## 🐛 Problem

The `branding-upload` Netlify function was failing with `net::ERR_NAME_NOT_RESOLVED` when deployed to subdomain `app.limsapp.in`.

**Error:**
```
(failed) net::ERR_NAME_NOT_RESOLVED
```

**Root Cause:**
The function was trying to call another Netlify function (`imagekit-process`) using `resolveInvokeUrl()`, which was only checking environment variables. On subdomain deployments, these variables don't always reflect the correct URL.

---

## ✅ Solution

Updated `netlify/functions/branding-upload.js` to properly resolve the URL for subdomain deployments.

### **Changes Made:**

#### **1. Updated `resolveInvokeUrl` Function**

**Before:**
```javascript
const resolveInvokeUrl = () => process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || 'http://localhost:8888';
```

**After:**
```javascript
const resolveInvokeUrl = (event) => {
  // Priority 1: Use the request origin (works for subdomain deployments)
  if (event && event.headers && event.headers.origin) {
    return event.headers.origin;
  }
  
  // Priority 2: Use the host header
  if (event && event.headers && event.headers.host) {
    const protocol = event.headers['x-forwarded-proto'] || 'https';
    return `${protocol}://${event.headers.host}`;
  }
  
  // Priority 3: Netlify environment variables (fallback)
  return process.env.URL || 
         process.env.DEPLOY_PRIME_URL || 
         process.env.DEPLOY_URL || 
         'http://localhost:8888';
};
```

#### **2. Updated Function Call**

**Before:**
```javascript
const invokeUrl = resolveInvokeUrl();
```

**After:**
```javascript
const invokeUrl = resolveInvokeUrl(event);
```

---

## 🎯 How It Works Now

The function now checks in this order:

1. **Request Origin Header** (e.g., `https://app.limsapp.in`)
   - Most reliable for subdomain deployments
   - Reflects the actual domain the request came from

2. **Host Header** (e.g., `app.limsapp.in`)
   - Constructs full URL from host + protocol
   - Works when origin is not available

3. **Environment Variables** (fallback)
   - `process.env.URL`
   - `process.env.DEPLOY_PRIME_URL`
   - `process.env.DEPLOY_URL`
   - `http://localhost:8888` (local development)

---

## 🚀 Deployment

The fix is already applied to the code. To deploy:

```bash
# Commit the changes
git add netlify/functions/branding-upload.js
git commit -m "Fix: Netlify function URL resolution for subdomain deployments"
git push

# Netlify will auto-deploy
# Or manually trigger deploy in Netlify dashboard
```

---

## 🧪 Testing

### **Test 1: Local Development**
```bash
netlify dev
```
- Should work as before
- Uses `http://localhost:8888`

### **Test 2: Subdomain Deployment**
- Deploy to `app.limsapp.in`
- Try uploading branding asset
- Should now resolve to `https://app.limsapp.in/.netlify/functions/imagekit-process`
- No more `ERR_NAME_NOT_RESOLVED`

### **Test 3: Main Domain**
- Deploy to `limsapp.in`
- Should still work correctly
- Uses appropriate domain

---

## 📝 Additional Notes

### **Why This Happened:**

Netlify environment variables (`URL`, `DEPLOY_PRIME_URL`, etc.) are set at build time and may not reflect the actual subdomain when:
- Using custom domains
- Using branch subdomains
- Using deploy previews

### **Why This Fix Works:**

The `event.headers` object contains the actual request headers from the client, including:
- `origin`: The full origin URL (e.g., `https://app.limsapp.in`)
- `host`: The hostname (e.g., `app.limsapp.in`)
- `x-forwarded-proto`: The protocol (http/https)

These headers always reflect the actual URL the request came from, making them more reliable for subdomain deployments.

---

## 🔍 Related Files

- `netlify/functions/branding-upload.js` ✅ Fixed
- `netlify/functions/imagekit-process.js` (called by branding-upload)

---

## ⚠️ Important

If you have other Netlify functions that call each other, they may need the same fix. Look for:
- `resolveInvokeUrl()`
- `process.env.URL`
- `fetch(\`\${...}/.netlify/functions/...\`)`

And update them to use the request headers for URL resolution.

---

## ✅ Status

- [x] Issue identified
- [x] Fix applied
- [x] Code updated
- [ ] Deployed to production
- [ ] Tested on subdomain

**Next Step:** Deploy to production and test!
