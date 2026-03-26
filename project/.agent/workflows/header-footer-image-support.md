# Header/Footer Image Upload Support

## ✅ Update Summary

The Report Header & Footer UI has been upgraded to support **Image Uploads** directly!

### **✨ New Capabilities**
- **Upload Images:** You can now upload `PNG`, `JPG`, or `JPEG` files directly.
- **Auto-Formatting:** The system automatically wraps your image in HTML so it fits perfectly on the PDF page (100% width).
- **Existing Support:** HTML file uploads still work as before for valid templates.
- **Max File Size:** Increased from 100KB to **2MB** to accommodate high-quality images.

---

## 🛠 How It Works Internally

When you upload an image (e.g., `brand_header.png`):

1. **Image Upload:** The image is uploaded securely to storage.
2. **Auto-Wrap:** A small HTML file is generated automatically:
   ```html
   <!DOCTYPE html>
   <html>
     <body>
       <img src="https://.../brand_header.png" style="width:100%;" />
     </body>
   </html>
   ```
3. **Save:** This HTML wrapper is saved as your header/footer.

This ensures compatibility with the PDF generation system (which expects HTML) while giving you the simplicity of uploading just an image.

---

## 🧪 How to Use

1. Go to **Masters** -> **Location Master** (or Account Master).
2. Edit a Location/Account.
3. Scroll to **Report Header & Footer**.
4. Click to upload (or drag & drop).
5. Select your **Image File** (e.g., your company letterhead or logo banner).
6. Click **Preview** to verify how it looks.

## ✅ Verification
- [x] UI accepts .png, .jpg, .jpeg
- [x] UI shows "Accepts: HTML, PNG, JPG"
- [x] Uploading image creates HTML wrapper
- [x] Preview works for images (opens HTML with image)

Ready to go! 🚀
