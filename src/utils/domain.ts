export const isPublicWebsiteDomain = (): boolean => {
  const hostname = window.location.hostname.toLowerCase();
  
  // Define public website domains here.
  // When accessed via these domains, the website renders at the root (/) path.
  const publicDomains = [
    'vetplusdiagnostics.com',
    'vetplusdiagnostics.in',
    'www.vetplusdiagnostics.com',
    'www.vetplusdiagnostics.in'
  ];

  return publicDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
};

export const getSiteBasePath = (): string => {
  return isPublicWebsiteDomain() ? '' : '/vetplus';
};
