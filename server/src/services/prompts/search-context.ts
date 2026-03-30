export function buildSearchContextBlock(profile: any): string {
  if (!profile?.hasCompletedOnboarding) return '';
  return `
--- CANDIDATE SEARCH CONTEXT ---
Target role: ${profile.targetRole || 'Not specified'}
Target city: ${profile.targetCity || 'Not specified'}
Seniority: ${profile.seniority || 'Not specified'}
Industry: ${profile.industry || 'Not specified'}
Search duration: ${profile.searchDuration || 'Not specified'}
Applications sent: ${profile.applicationsCount || 'Not specified'}
Response pattern: ${profile.responsePattern || 'Not specified'}
Self-identified blocker: ${profile.perceivedBlocker || 'Not specified'}
--- END CONTEXT ---

Use the above context to calibrate positioning, tone, and emphasis. A candidate who has sent 100+ applications and is getting silence needs ATS-optimised language and sharp keyword alignment. A candidate getting interviews that stall needs stronger proof points and narrative specificity. Weight the document accordingly.

`;
}
