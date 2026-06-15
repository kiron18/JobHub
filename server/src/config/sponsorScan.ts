// Seek sponsorship keyword searches, broad to narrow. Each searchTerm reproduces a
// Seek /{slug}-jobs/in-All-Australia result set. Whole national pool approx 600-700 deduped
// (measured 2026-06-04), so this is cheap. The broad 'sponsorship' query over-captures
// noise (event/marketing sponsorship); the classifier filters it out.

export const SPONSOR_SCAN_QUERIES = [
  { searchTerm: 'sponsorship',          label: 'broad' }, // ~614 — widest net, noisy
  { searchTerm: 'visa sponsorship',     label: 'visa'  }, // ~345
  { searchTerm: '482 visa sponsorship', label: '482'   }, // ~126
  { searchTerm: '457 visa sponsorship', label: '457'   }, // legacy 457, low volume
];

export const SPONSOR_SCAN_LOCATION    = 'All Australia';
export const SPONSOR_SCAN_MAX_RESULTS = 500; // Apify actor caps at 550; full pool is ~600-700 anywa
export const SPONSOR_SCAN_DATE_RANGE  = 30;  // capture the full live set, not just last 7d
