// Helper functions for fetching custom headers and footers
// Based on priority: B2B Account > Location > Lab

/**
 * Fetch front and last page branding for a lab
 */
export async function fetchFrontBackPages(
  supabase: any,
  labId: string
): Promise<{ frontPage: string | null; lastPage: string | null }> {
  try {
    const { data: assets, error } = await supabase
      .from('lab_branding_assets')
      .select('asset_type, file_url')
      .eq('lab_id', labId)
      .eq('is_active', true)
      .eq('is_default', true)
      .in('asset_type', ['front_page', 'last_page']);

    if (error) {
      console.error('[FRONT/BACK] Error fetching branding pages:', error);
      return { frontPage: null, lastPage: null };
    }

    const frontPageAsset = assets?.find((a: any) => a.asset_type === 'front_page');
    const lastPageAsset = assets?.find((a: any) => a.asset_type === 'last_page');

    const frontPage = frontPageAsset ? await wrapImageInFullPageHTML(frontPageAsset.file_url) : null;
    const lastPage = lastPageAsset ? await wrapImageInFullPageHTML(lastPageAsset.file_url) : null;

    console.log('[FRONT/BACK] Fetched pages:', {
      hasFront: !!frontPage,
      hasLast: !!lastPage
    });

    return { frontPage, lastPage };

  } catch (error) {
    console.error('[FRONT/BACK] Unexpected error:', error);
    return { frontPage: null, lastPage: null };
  }
}

/**
 * Helper to wrap full page image in HTML
 */
function wrapImageInFullPageHTML(url: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body, html {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    .full-page-bg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: url('${url}');
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      z-index: -1;
    }
  </style>
</head>
<body>
  <div class="full-page-bg"></div>
</body>
</html>`;
}

/**
 * Fetch header or footer HTML for an order
 * Priority: B2B Account > Location > Lab > Default
 */
export async function fetchHeaderFooter(
  supabase: any,
  orderId: string,
  type: 'header' | 'footer'
): Promise<string | null> {
  try {
    // 1. Get order details to determine priority
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('account_id, location_id, lab_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('[HEADER/FOOTER] Error fetching order:', orderError);
      return null;
    }

    console.log(`[HEADER/FOOTER] Fetching ${type} for order:`, {
      orderId,
      account_id: order.account_id,
      location_id: order.location_id,
      lab_id: order.lab_id
    });

    // 2. Priority 1: Try B2B account-specific (using attachments table)
    if (order.account_id) {
      const accountHTML = await getAttachmentHTML(
        supabase,
        'account',
        order.account_id,
        type
      );
      
      if (accountHTML) {
        console.log(`[HEADER/FOOTER] Using B2B account ${type}`);
        return accountHTML;
      }
    }

    // 3. Priority 2: Try location-specific (using attachments table)
    if (order.location_id) {
      const locationHTML = await getAttachmentHTML(
        supabase,
        'location',
        order.location_id,
        type
      );
      
      if (locationHTML) {
        console.log(`[HEADER/FOOTER] Using location ${type}`);
        return locationHTML;
      }
    }

    // 4. Priority 3: Try lab-level (using NEW lab_branding_assets table)
    if (order.lab_id) {
      const labHTML = await getLabBrandingAssetHTML(
        supabase,
        order.lab_id,
        type
      );
      
      if (labHTML) {
        console.log(`[HEADER/FOOTER] Using lab branding asset ${type}`);
        return labHTML;
      }
    }

    // 5. No custom header/footer found
    console.log(`[HEADER/FOOTER] No custom ${type} found, will use default`);
    return null;

  } catch (error) {
    console.error(`[HEADER/FOOTER] Error fetching ${type}:`, error);
    return null;
  }
}

/**
 * Get attachment HTML from LAB BRANDING ASSETS table
 */
async function getLabBrandingAssetHTML(
  supabase: any,
  labId: string,
  assetType: string
): Promise<string | null> {
  try {
    const { data: asset, error } = await supabase
      .from('lab_branding_assets')
      .select('file_url, asset_name')
      .eq('lab_id', labId)
      .eq('asset_type', assetType)
      .eq('is_active', true)
      .eq('is_default', true)
      .single();

    if (error || !asset) return null;

    // Check content type based on URL extension
    const isImage = /\.(jpg|jpeg|png|webp)$/i.test(asset.file_url);

    if (isImage) {
        return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin: 0; padding: 0; width: 100%; }
        img { width: 100%; height: auto; display: block; }
      </style>
    </head>
    <body>
      <img src="${asset.file_url}" alt="${assetType}" />
    </body>
    </html>`.trim();
    } else {
        // Assume HTML
        return await fetchHTMLContent(asset.file_url);
    }
  } catch (err) {
      console.error('[HEADER/FOOTER] Lab Branding Error:', err);
      return null;
  }
}

/**
 * Get attachment HTML from ATTACHMENTS table (legacy/general)
 */
async function getAttachmentHTML(
  supabase: any,
  entityType: string,
  entityId: string,
  attachmentType: string
): Promise<string | null> {
  try {
    // Query attachments table
    const { data: attachment, error } = await supabase
      .from('attachments')
      .select('file_url, file_name, mime_type')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('attachment_type', attachmentType)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !attachment) {
      return null;
    }
    
    // Check if it's an image
    const isImage = 
      (attachment.mime_type && attachment.mime_type.startsWith('image/')) ||
      /\.(jpg|jpeg|png)$/i.test(attachment.file_name) ||
      /\.(jpg|jpeg|png)$/i.test(attachment.file_url);

    if (isImage) {
      return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      padding: 0;
      width: 100%;
    }
    img {
      width: 100%;
      height: auto;
      display: block;
    }
  </style>
</head>
<body>
  <img src="${attachment.file_url}" alt="${attachmentType}" />
</body>
</html>
      `.trim();
    }

    // It is likely HTML, fetch content
    const htmlContent = await fetchHTMLContent(attachment.file_url);
    return htmlContent;

  } catch (error) {
    console.error(`[HEADER/FOOTER] Error getting attachment:`, error);
    return null;
  }
}

/**
 * Fetch HTML content from a URL
 */
async function fetchHTMLContent(url: string): Promise<string | null> {
  try {
    console.log(`[HEADER/FOOTER] Fetching HTML from:`, url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[HEADER/FOOTER] Failed to fetch HTML:`, {
        url,
        status: response.status,
        statusText: response.statusText
      });
      return null;
    }

    const html = await response.text();
    
    // Safety check: if the content looks like binary/image, don't return it as HTML
    if (html.includes('PNG') || html.includes('JFIF') || html.length < 10) {
       // It might be a mislabeled image file
       console.warn(`[HEADER/FOOTER] Warning: Content fetched from ${url} does not look like valid HTML.`);
    }
    
    console.log(`[HEADER/FOOTER] Successfully fetched HTML (${html.length} bytes)`);
    return html;

  } catch (error) {
    console.error(`[HEADER/FOOTER] Error fetching HTML content:`, error);
    return null;
  }
}

/**
 * Replace template variables in HTML
 */
export function replaceTemplateVariables(
  html: string,
  variables: Record<string, string>
): string {
  let result = html;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value || '');
  }
  
  return result;
}

/**
 * Get default header HTML (fallback)
 */
export function getDefaultHeaderHTML(labInfo: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      padding: 10px 20px;
      font-family: Arial, sans-serif;
      font-size: 10px;
    }
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 5px;
    }
    .logo {
      max-height: 50px;
    }
    .lab-info {
      text-align: right;
    }
  </style>
</head>
<body>
  <div class="header-container">
    <div>
      ${labInfo.logo_url ? `<img src="${labInfo.logo_url}" class="logo" alt="Lab Logo">` : ''}
    </div>
    <div class="lab-info">
      <strong>${labInfo.name || 'Lab Name'}</strong><br>
      ${labInfo.address || ''}<br>
      ${labInfo.phone ? `Phone: ${labInfo.phone}` : ''}
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Get default footer HTML (fallback)
 */
export function getDefaultFooterHTML(labInfo: any): string {
  const now = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      padding: 10px 20px;
      font-family: Arial, sans-serif;
      font-size: 9px;
      color: #666;
    }
    .footer-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #ddd;
      padding-top: 5px;
    }
  </style>
</head>
<body>
  <div class="footer-container">
    <div>
      Generated on: ${now}
    </div>
    <div>
      Page <span class="pageNumber"></span> of <span class="totalPages"></span>
    </div>
    <div>
      ${labInfo.name || 'Lab Name'} ${labInfo.website ? `| ${labInfo.website}` : ''}
    </div>
  </div>
</body>
</html>
  `.trim();
}
