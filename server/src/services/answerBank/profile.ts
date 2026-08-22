// The fields a bank's profile half can hold.
//
// This is the list only. The matching half of profile.js, which decides WHICH
// field answers a given form question, stays in the extension: the server never
// sees a form. Keeping the list here means the intake and the extension cannot
// disagree about what a profile is made of.

export interface ProfileField {
  key: string;
  label: string;
  example: string;
  boolean?: boolean;
}

export const PROFILE_FIELDS: ProfileField[] = [
  { key: 'name', label: 'Full name', example: 'Priya Nair' },
  { key: 'email', label: 'Email', example: 'priya.nair@example.com' },
  { key: 'phone', label: 'Phone', example: '0412 345 678' },
  { key: 'location', label: 'Location', example: 'Melbourne, VIC' },
  { key: 'linkedin', label: 'LinkedIn URL', example: 'https://www.linkedin.com/in/…' },
  { key: 'workRights', label: 'Working rights (in words)', example: 'Temporary Graduate visa (485), full working rights until March 2028' },
  { key: 'hasWorkRights', label: 'Has working rights (true/false)', example: 'true', boolean: true },
  { key: 'requiresSponsorship', label: 'Will need sponsorship (true/false)', example: 'false', boolean: true },
  { key: 'noticePeriod', label: 'Notice period / availability', example: '1 week' },
  { key: 'salaryExpectation', label: 'Salary expectation', example: '70,000 - 78,000 AUD' },
  { key: 'driversLicence', label: "Driver's licence", example: 'Full Victorian licence, own car' },
  { key: 'willingToRelocate', label: 'Willing to relocate (true/false)', example: 'false', boolean: true },
  { key: 'willingToTravel', label: 'Willing to travel (true/false)', example: 'true', boolean: true },
  { key: 'policeCheck', label: 'Police check', example: 'Cleared, issued Feb 2026' },
  { key: 'workingWithChildren', label: 'Working with children check', example: 'Not held, happy to obtain' },
  { key: 'industry', label: 'Industry (turns on extra themes)', example: 'finance' },
];
