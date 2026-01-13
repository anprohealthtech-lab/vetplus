# DNS & Subdomain Configuration Guide

## 🔴 Error: DNS_PROBE_FINISHED_NXDOMAIN

**What it means:** The subdomain `app.limsapp.in` doesn't exist in DNS records.

---

## 🔍 Root Causes

1. **DNS Records Not Configured**
   - Subdomain not added to DNS provider
   - CNAME/A record missing

2. **DNS Propagation Delay**
   - Changes can take 24-48 hours to propagate
   - Different DNS servers may have different cache times

3. **Netlify Domain Not Configured**
   - Subdomain not added to Netlify site
   - Domain verification pending

4. **Incorrect DNS Configuration**
   - Wrong CNAME target
   - Missing records

---

## ✅ Solution Steps

### **Step 1: Check Netlify Domain Configuration**

1. Go to Netlify Dashboard
2. Select your site
3. Go to **Domain Settings**
4. Check if `app.limsapp.in` is listed

**If NOT listed:**
- Click "Add custom domain"
- Enter `app.limsapp.in`
- Follow Netlify's instructions

**Expected Netlify Target:**
- Usually something like: `your-site-name.netlify.app`
- Or: `branch-name--your-site-name.netlify.app`

---

### **Step 2: Configure DNS Records**

Go to your DNS provider (where you manage `limsapp.in`):

#### **Option A: CNAME Record (Recommended)**

```
Type: CNAME
Name: app
Value: your-site-name.netlify.app
TTL: 3600 (or Auto)
```

#### **Option B: A Record (Alternative)**

If CNAME doesn't work, use Netlify's load balancer IP:

```
Type: A
Name: app
Value: 75.2.60.5
TTL: 3600
```

**Note:** Check Netlify docs for current IP addresses.

---

### **Step 3: Verify DNS Configuration**

#### **Using Command Line:**

```bash
# Check if DNS record exists
nslookup app.limsapp.in

# Check CNAME
nslookup -type=CNAME app.limsapp.in

# Check A record
nslookup -type=A app.limsapp.in

# Detailed DNS info
dig app.limsapp.in
```

#### **Using Online Tools:**

- https://dnschecker.org
- https://www.whatsmydns.net
- Enter: `app.limsapp.in`

**Expected Result:**
```
app.limsapp.in -> CNAME -> your-site.netlify.app
```

---

### **Step 4: Wait for DNS Propagation**

DNS changes can take time:
- **Minimum:** 5-10 minutes
- **Average:** 1-2 hours
- **Maximum:** 24-48 hours

**During propagation:**
- Some users may see the site
- Others may get DNS errors
- This is normal

---

## 🚀 Quick Fix Checklist

- [ ] Subdomain added to Netlify site settings
- [ ] DNS CNAME record created (app -> your-site.netlify.app)
- [ ] DNS changes saved at provider
- [ ] Waited 10-15 minutes for propagation
- [ ] Cleared browser DNS cache
- [ ] Tested with `nslookup app.limsapp.in`
- [ ] Verified on https://dnschecker.org

---

## 🔧 Common DNS Providers

### **Cloudflare:**
1. Login to Cloudflare
2. Select `limsapp.in` domain
3. Go to DNS → Records
4. Add CNAME:
   - Name: `app`
   - Target: `your-site.netlify.app`
   - Proxy status: DNS only (gray cloud)
5. Save

### **GoDaddy:**
1. Login to GoDaddy
2. My Products → DNS
3. Add Record
4. Type: CNAME
5. Name: `app`
6. Value: `your-site.netlify.app`
7. Save

### **Namecheap:**
1. Login to Namecheap
2. Domain List → Manage
3. Advanced DNS
4. Add New Record
5. Type: CNAME
6. Host: `app`
7. Value: `your-site.netlify.app`
8. Save

---

## 🧪 Testing After Configuration

### **Test 1: DNS Resolution**
```bash
nslookup app.limsapp.in
```

**Expected:**
```
Server: ...
Address: ...

Non-authoritative answer:
app.limsapp.in canonical name = your-site.netlify.app
```

### **Test 2: Browser Access**
1. Clear browser cache (Ctrl+Shift+Delete)
2. Try accessing `https://app.limsapp.in`
3. Should load your site

### **Test 3: SSL Certificate**
- Netlify auto-provisions SSL
- May take 10-20 minutes after DNS is configured
- Check Netlify → Domain Settings → HTTPS

---

## ⚠️ Troubleshooting

### **Issue: Still getting DNS error after 24 hours**

**Check:**
1. DNS record is correct (no typos)
2. Record is not proxied (if using Cloudflare)
3. TTL is not too high
4. DNS provider changes are saved

**Solution:**
- Delete and recreate DNS record
- Contact DNS provider support
- Try A record instead of CNAME

---

### **Issue: Works on some networks, not others**

**Cause:** DNS propagation in progress

**Solution:**
- Wait longer (up to 48 hours)
- Flush DNS cache on affected devices:
  ```bash
  # Windows
  ipconfig /flushdns
  
  # Mac
  sudo dscacheutil -flushcache
  
  # Linux
  sudo systemd-resolve --flush-caches
  ```

---

### **Issue: SSL/HTTPS not working**

**Cause:** Netlify hasn't provisioned certificate yet

**Solution:**
1. Wait 10-20 minutes after DNS is configured
2. Go to Netlify → Domain Settings → HTTPS
3. Click "Verify DNS configuration"
4. Click "Provision certificate"

---

## 📝 Current Setup Recommendation

For `app.limsapp.in`:

### **1. Netlify Configuration:**
- Add `app.limsapp.in` as custom domain
- Enable HTTPS
- Set as primary domain (optional)

### **2. DNS Configuration:**
```
Type: CNAME
Name: app
Value: [your-netlify-site].netlify.app
TTL: 3600
```

### **3. Verification:**
```bash
nslookup app.limsapp.in
# Should return CNAME to Netlify
```

---

## 🎯 Alternative: Use Netlify Subdomain

If DNS configuration is problematic, you can use Netlify's subdomain:

**Format:**
- `your-site-name.netlify.app`
- `branch-name--your-site-name.netlify.app`

**Advantages:**
- No DNS configuration needed
- Works immediately
- Free SSL included

**Disadvantages:**
- Not a custom domain
- Longer URL

---

## 📞 Next Steps

1. **Check Netlify Dashboard:**
   - Is `app.limsapp.in` listed?
   - What's the Netlify target domain?

2. **Check DNS Provider:**
   - Is CNAME record created?
   - Is it pointing to correct Netlify domain?

3. **Wait & Test:**
   - Wait 15-30 minutes
   - Test with `nslookup`
   - Try accessing in browser

4. **If Still Not Working:**
   - Share Netlify site name
   - Share DNS provider
   - Share `nslookup` output

---

## 🆘 Emergency Workaround

If you need immediate access:

1. **Use Netlify subdomain:**
   - `https://[your-site].netlify.app`

2. **Use main domain:**
   - `https://limsapp.in`
   - Configure to redirect to app

3. **Use IP + hosts file:**
   - Find Netlify IP
   - Add to local hosts file (temporary)

---

## ✅ Success Criteria

- [ ] `nslookup app.limsapp.in` returns Netlify domain
- [ ] `https://app.limsapp.in` loads in browser
- [ ] SSL certificate is valid
- [ ] No DNS errors
- [ ] Works on multiple networks

---

**Need Help?**
Share:
1. Netlify site name
2. DNS provider name
3. Output of `nslookup app.limsapp.in`
4. Screenshot of Netlify domain settings
