# Watermark Background Layer Feature

**Date**: November 17, 2025  
**Status**: ✅ Implemented & Built

---

## How to Send Watermark to Background

### Method 1: Automatic (Using Placeholder Picker) ✨ RECOMMENDED

1. **Open Template Editor**
   - Navigate to Template Studio (CKEditor)

2. **Click "Placeholders" button**
   - Top toolbar → "Placeholders"

3. **Select Watermark from Branding section**
   - Look for "Branding · Watermark" option
   - Click to insert

4. **✅ Watermark automatically styled!**
   - Position: Center of page
   - Opacity: 15% (faded)
   - Z-index: -1 (behind content)
   - Non-clickable (pointer-events: none)

### Method 2: Manual Conversion (Any Image) 🎯

1. **Insert or select any image** in the template

2. **Click "Send to Background" button**
   - Top toolbar → Indigo button with up/down arrows
   - Button appears after "Placeholders"

3. **✅ Image converted to watermark!**
   - Confirmation alert shows applied styles
   - Image moves behind text content

---

## Technical Implementation

### Automatic Watermark Styling (Placeholders)

**File**: `src/pages/TemplateStudioCKE.tsx`

When watermark is inserted via placeholder picker:

```typescript
if (option.assetType === 'watermark') {
  styleSegments.push(
    'position:absolute',      // Absolute positioning
    'top:50%',                // Center vertically
    'left:50%',               // Center horizontally
    'transform:translate(-50%, -50%)',  // Perfect centering
    'z-index:-1',             // Behind all content
    'opacity:0.15',           // 15% opacity (faded)
    'pointer-events:none'     // Can't be clicked
  );
}
```

### Manual Watermark Conversion

**Function**: `handleConvertToWatermark()`

Applies watermark styling to any selected image:

```typescript
const watermarkStyles = [
  'position:absolute',
  'top:50%',
  'left:50%',
  'transform:translate(-50%, -50%)',
  'z-index:-1',
  'opacity:0.15',
  'pointer-events:none',
  'max-width:80%',
  'height:auto',
  'background:none transparent',
  'background-image:none'
].join(';');

writer.setAttribute('style', watermarkStyles, selectedElement);
writer.setAttribute('class', 'report-watermark', selectedElement);
```

### CSS Support

**File**: `src/styles/report-baseline.css`

Global watermark class for consistency:

```css
.report-watermark {
  position: absolute !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  z-index: -1 !important;
  opacity: 0.15 !important;
  pointer-events: none !important;
  max-width: 80% !important;
  height: auto !important;
}
```

**Why it works**:
- `.limsv2-report` has `position: relative` (container)
- `.report-region` has `position: relative` (sections)
- Watermark with `position: absolute` is positioned relative to these

---

## Watermark Styling Properties Explained

### Position Properties
```css
position: absolute;           /* Float above/below content */
top: 50%;                     /* 50% from top */
left: 50%;                    /* 50% from left */
transform: translate(-50%, -50%);  /* Center exactly */
```

### Layer Properties
```css
z-index: -1;                  /* Behind content (negative layer) */
opacity: 0.15;                /* 15% visible (85% transparent) */
pointer-events: none;         /* Can't interact with it */
```

### Size Properties
```css
max-width: 80%;               /* Max 80% of container width */
height: auto;                 /* Maintain aspect ratio */
```

### Background Properties
```css
background: none transparent; /* No background color */
background-image: none;       /* No background image */
```

---

## UI Button Details

### "Send to Background" Button

**Location**: Template Studio toolbar (between "Placeholders" and "A4 Full View")

**Appearance**:
- Indigo background (`bg-indigo-50`)
- Up/down arrows icon
- Text: "Send to Background"

**Behavior**:
1. Checks if image is selected
2. If no selection → Alert: "Please select an image first"
3. If image selected → Applies watermark styles
4. Shows success alert with applied properties

**Alert Message**:
```
✅ Image converted to watermark background layer!

The image now has:
• Low opacity (15%)
• Centered position
• Behind content (z-index: -1)
```

---

## Step-by-Step Example

### Scenario: Add Lab Logo as Background Watermark

1. **Open Template Studio**
   - `/template-studio` or Template Studio menu

2. **Click "Placeholders"**
   - Opens placeholder picker modal

3. **Find "Branding · Watermark" section**
   - Shows uploaded watermark image
   - Preview thumbnail visible

4. **Click to insert**
   - Watermark appears in editor
   - Already styled with background properties
   - Faded, centered, behind text

5. **Preview in A4 view**
   - Click "A4 Full View" button
   - See watermark in full page context
   - Text appears above watermark

6. **Save template**
   - Click "Save" button
   - Template saved with watermark styling

7. **Generate report**
   - When report is generated
   - Watermark appears faded in background
   - Patient info and results appear on top

---

## Troubleshooting

### ❌ Watermark appears in front of text

**Cause**: `z-index` not applied or parent container missing `position: relative`

**Solution**:
1. Select the watermark image
2. Click "Send to Background" button
3. Or manually add `z-index: -1` in Custom CSS

### ❌ Watermark not centered

**Cause**: Missing transform or absolute positioning

**Solution**:
```css
position: absolute;
top: 50%;
left: 50%;
transform: translate(-50%, -50%);
```

### ❌ Watermark too visible

**Cause**: Opacity too high

**Solution**:
- Adjust opacity: `opacity: 0.1` (10%) or `opacity: 0.05` (5%)
- Or use Custom CSS:
```css
.report-watermark {
  opacity: 0.1 !important;
}
```

### ❌ Watermark blocking interactions

**Cause**: Missing `pointer-events: none`

**Solution**:
```css
pointer-events: none;
```

---

## Customization Options

### Change Opacity

**Light watermark (5%)**:
```css
.report-watermark {
  opacity: 0.05 !important;
}
```

**Medium watermark (20%)**:
```css
.report-watermark {
  opacity: 0.20 !important;
}
```

### Change Position

**Top left corner**:
```css
.report-watermark {
  top: 10% !important;
  left: 10% !important;
  transform: none !important;
}
```

**Bottom right corner**:
```css
.report-watermark {
  top: auto !important;
  bottom: 10% !important;
  left: auto !important;
  right: 10% !important;
  transform: none !important;
}
```

### Change Size

**Larger watermark (90%)**:
```css
.report-watermark {
  max-width: 90% !important;
}
```

**Smaller watermark (50%)**:
```css
.report-watermark {
  max-width: 50% !important;
}
```

### Rotate Watermark (Diagonal)

**45-degree rotation**:
```css
.report-watermark {
  transform: translate(-50%, -50%) rotate(45deg) !important;
}
```

---

## Before & After Comparison

### ❌ Before (Normal Image)
```html
<img src="watermark.png" style="width:1000px;">
```
- Appears in document flow
- Full opacity (100%)
- Pushes text down
- Blocks content

### ✅ After (Background Watermark)
```html
<img src="watermark.png" 
     class="report-watermark"
     style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
            z-index:-1;opacity:0.15;pointer-events:none;max-width:80%;">
```
- Behind content
- Faded (15% opacity)
- Text flows on top
- No interaction

---

## Related Features

### Upload Watermark

1. Go to **Branding Settings** (`/branding-settings`)
2. Click **"Add Branding Asset"**
3. Select type: **Watermark**
4. Upload image (PNG recommended for transparency)
5. Image processed through ImageKit
6. Available in placeholder picker

### Remove Watermark

**Option 1**: Delete image from template
- Click watermark in editor
- Press Delete key

**Option 2**: Make invisible
- Select watermark
- Set opacity to 0: `opacity: 0`

**Option 3**: Remove from branding
- Go to Branding Settings
- Find watermark asset
- Click "Remove" button

---

## Best Practices

### ✅ DO:
- Use PNG images with transparency
- Keep opacity between 5-20%
- Use high-resolution images (1000px+)
- Test in A4 preview before saving
- Use grayscale or light-colored watermarks

### ❌ DON'T:
- Use JPEG (no transparency)
- Set opacity above 30% (too visible)
- Use low-resolution images (pixelated)
- Place multiple watermarks
- Use dark/colorful watermarks (distracting)

---

## Files Modified

### Frontend Components
- ✅ `src/pages/TemplateStudioCKE.tsx`
  - Added automatic watermark styling for placeholder inserts
  - Added `handleConvertToWatermark()` function
  - Added "Send to Background" button to toolbar

### Styles
- ✅ `src/styles/report-baseline.css`
  - Added `.report-watermark` class
  - Includes all necessary styling with `!important` flags

---

## Production Status

**Build**: ✅ Successful (11.79s)  
**Bundle**: 6,133.96 KB  
**Ready**: Yes

**Features Live**:
- ✅ Automatic watermark styling via placeholders
- ✅ Manual "Send to Background" button
- ✅ CSS class `.report-watermark` available
- ✅ A4 preview shows watermark correctly

---

## User Guide Summary

### Quick Start (3 Steps)

1. **Click "Placeholders"** → Select "Branding · Watermark"
2. Watermark appears **automatically styled** as background
3. **Click "Save"** → Done!

### Alternative (Manual)

1. Insert any image
2. Select image
3. Click **"Send to Background"** button
4. Image converts to watermark
5. Save template

**That's it!** 🎉

---

## Support

**Common Issue**: "Watermark still in front of text"

**Solution**: 
1. Select the watermark image in editor
2. Click the **"Send to Background"** button (indigo button with arrows)
3. Verify alert confirms styling applied
4. If still not working, add this to Custom CSS:
```css
img[src*="watermark"] {
  z-index: -1 !important;
  opacity: 0.15 !important;
  position: absolute !important;
}
```

**Need More Help**: Check Template Studio → A4 Full View to see final result

---

## Conclusion

The watermark background feature provides two easy ways to add faded background images to report templates:

1. **Automatic**: Use placeholder picker for instant watermark styling
2. **Manual**: Convert any image with one button click

Both methods ensure watermarks appear behind content with proper opacity, positioning, and non-interactive behavior.

**Result**: Professional-looking reports with subtle branding that doesn't interfere with content readability.
