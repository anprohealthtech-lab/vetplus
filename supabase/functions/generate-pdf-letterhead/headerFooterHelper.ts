// Simplified Helper: Fetch Letterhead Background Image URL
// Returns ImageKit URL for full-page letterhead background
// Supports priority: B2B Account > Location > Lab

/**
 * Fetch letterhead background image URL for an order
 * Priority: B2B Account > Location > Lab
 * Returns ImageKit URL to be used as full-page background
 */
export async function fetchLetterheadBackgroundForOrder(
  supabase: any,
  orderId: string,
  labId: string
): Promise<string | null> {
  try {
    console.log('[LETTERHEAD] Fetching letterhead for order:', orderId);

    // 1. Get order details to determine priority (account_id, location_id)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('account_id, location_id')
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.log('[LETTERHEAD] Error fetching order:', orderError.message);
      // Fall back to lab-level
      return fetchLetterheadBackground(supabase, labId);
    }

    console.log('[LETTERHEAD] Order context:', {
      orderId,
      account_id: order?.account_id,
      location_id: order?.location_id,
      lab_id: labId
    });

    // 2. Priority 1: Try B2B account-specific header (using attachments table)
    if (order?.account_id) {
      const accountHeader = await getAttachmentImageUrl(
        supabase,
        'account',
        order.account_id
      );
      
      if (accountHeader) {
        console.log('[LETTERHEAD] Using B2B account header');
        return accountHeader;
      }
    }

    // 3. Priority 2: Try location-specific header (using attachments table)
    if (order?.location_id) {
      const locationHeader = await getAttachmentImageUrl(
        supabase,
        'location',
        order.location_id
      );
      
      if (locationHeader) {
        console.log('[LETTERHEAD] Using location header');
        return locationHeader;
      }
    }

    // 4. Priority 3: Fall back to lab-level (using lab_branding_assets)
    console.log('[LETTERHEAD] Falling back to lab-level header');
    return fetchLetterheadBackground(supabase, labId);

  } catch (error) {
    console.error('[LETTERHEAD] Error fetching letterhead for order:', error);
    // Fall back to lab-level
    return fetchLetterheadBackground(supabase, labId);
  }
}

/**
 * Get header image URL from ATTACHMENTS table (for location/account)
 */
async function getAttachmentImageUrl(
  supabase: any,
  entityType: string,
  entityId: string
): Promise<string | null> {
  try {
    const { data: attachment, error } = await supabase
      .from('attachments')
      .select('file_url, imagekit_url, mime_type')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('attachment_type', 'header')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !attachment) {
      console.log(`[LETTERHEAD] No ${entityType} header found`);
      return null;
    }

    // Prefer ImageKit URL for better performance
    const headerUrl = attachment.imagekit_url || attachment.file_url;
    console.log(`[LETTERHEAD] Found ${entityType} header:`, headerUrl);
    return headerUrl;

  } catch (error) {
    console.error(`[LETTERHEAD] Error getting ${entityType} attachment:`, error);
    return null;
  }
}

/**
 * Fetch letterhead background image URL for a lab (fallback)
 * Returns ImageKit URL to be used as full-page background
 */
export async function fetchLetterheadBackground(
  supabase: any,
  labId: string
): Promise<string | null> {
  try {
    console.log('[LETTERHEAD] Fetching letterhead background for lab:', labId);

    const { data: asset, error } = await supabase
      .from('lab_branding_assets')
      .select('imagekit_url, file_url, asset_name')
      .eq('lab_id', labId)
      .eq('asset_type', 'header')  // Using 'header' type for letterhead
      .eq('is_active', true)
      .eq('is_default', true)
      .single();

    if (error) {
      console.log('[LETTERHEAD] No letterhead found:', error.message);
      return null;
    }

    if (!asset) {
      console.log('[LETTERHEAD] No default letterhead asset found');
      return null;
    }

    // Prefer ImageKit URL for better performance and transformations
    const letterheadUrl = asset.imagekit_url || asset.file_url;

    console.log('[LETTERHEAD] Found letterhead:', {
      name: asset.asset_name,
      url: letterheadUrl,
      isImageKit: !!asset.imagekit_url
    });

    return letterheadUrl;

  } catch (error) {
    console.error('[LETTERHEAD] Error fetching letterhead:', error);
    return null;
  }
}

/**
 * Fetch front and last page branding for a lab
 * (Keeping this for compatibility)
 */
export async function fetchFrontBackPages(
  supabase: any,
  labId: string
): Promise<{ frontPage: string | null; lastPage: string | null }> {
  try {
    const { data: assets, error } = await supabase
      .from('lab_branding_assets')
      .select('asset_type, file_url, imagekit_url')
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

    const frontPage = frontPageAsset ? await wrapImageInFullPageHTML(
      frontPageAsset.imagekit_url || frontPageAsset.file_url
    ) : null;
    
    const lastPage = lastPageAsset ? await wrapImageInFullPageHTML(
      lastPageAsset.imagekit_url || lastPageAsset.file_url
    ) : null;

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
 * DEPRECATED: No longer fetching separate header/footer
 * Keeping for backward compatibility but returns null
 */
export async function fetchHeaderFooter(
  supabase: any,
  orderId: string,
  type: 'header' | 'footer'
): Promise<string | null> {
  console.log(`[HEADER/FOOTER] Deprecated - using letterhead background instead of ${type}`);
  return null;
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
 * Get default header HTML (fallback) - NOT USED with letterhead approach
 */
export function getDefaultHeaderHTML(labInfo: any): string {
  return '';
}

/**
 * Get default footer HTML (fallback) - NOT USED with letterhead approach
 */
export function getDefaultFooterHTML(labInfo: any): string {
  return '';
}
