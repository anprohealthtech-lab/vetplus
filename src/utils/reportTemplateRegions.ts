export interface ReportTemplateRegions {
  headerHtml: string;
  bodyHtml: string;
  footerHtml: string;
}

// Header/Footer are now handled by PDF.co overlay from database (labs table)
// Templates should only contain body content

const createDefaultStructure = (bodyHtml: string) => `
<section data-report-region="body" class="report-region report-region--body">
  ${bodyHtml || '<p></p>'}
</section>
`;

const ensureRegion = (html: string, region: 'header' | 'body' | 'footer'): string => {
  if (html.includes(`data-report-region="${region}"`)) {
    return html;
  }

  // Only wrap body region - header/footer come from PDF.co overlay
  if (region === 'body') {
    return `<section data-report-region="body" class="report-region report-region--body">${html}</section>`;
  }

  return html;
};

// Strip any existing header/footer regions from HTML (migration helper)
const stripHeaderFooterRegions = (html: string): string => {
  // Remove header region
  let result = html.replace(/<section[^>]*data-report-region=["']header["'][^>]*>[\s\S]*?<\/section>/gi, '');
  // Remove footer region
  result = result.replace(/<section[^>]*data-report-region=["']footer["'][^>]*>[\s\S]*?<\/section>/gi, '');
  return result.trim();
};

export const ensureReportRegions = (html: string): string => {
  const trimmed = (html || '').trim();

  if (!trimmed) {
    return createDefaultStructure('<p></p>');
  }

  // Strip any existing header/footer regions - they're now handled by PDF.co overlay
  let working = stripHeaderFooterRegions(trimmed);

  // Check if body region already exists
  if (working.includes('data-report-region="body"')) {
    return working;
  }

  // Wrap in body region if not already wrapped
  return createDefaultStructure(working);
};

const parseWithDom = (html: string) => {
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return null;
  }

  try {
    const parser = new window.DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    return doc;
  } catch (error) {
    console.warn('Failed to parse template regions with DOMParser:', error);
    return null;
  }
};

// Extract body content from template (header/footer come from PDF.co overlay now)
export const extractReportRegions = (html: string): ReportTemplateRegions => {
  const cleaned = ensureReportRegions(html);
  const doc = parseWithDom(cleaned);

  if (doc) {
    const bodyEl = doc.querySelector('[data-report-region="body"]');

    return {
      headerHtml: '', // Header comes from PDF.co overlay (labs table)
      bodyHtml: bodyEl ? bodyEl.innerHTML.trim() : cleaned,
      footerHtml: '', // Footer comes from PDF.co overlay (labs table)
    };
  }

  // Regex fallback for non-browser contexts
  const bodyRegex = /<([a-z0-9]+)([^>]*data-report-region=["']body["'][^>]*)>([\s\S]*?)<\/\1>/i;
  const match = cleaned.match(bodyRegex);

  return {
    headerHtml: '', // Header comes from PDF.co overlay (labs table)
    bodyHtml: match ? match[3].trim() : cleaned,
    footerHtml: '', // Footer comes from PDF.co overlay (labs table)
  };
};
