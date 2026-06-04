// Phrase lists for visa-sponsorship detection. All lowercase; matched after the
// job description is normalized (lowercased, punctuation stripped) by the classifier.
// Tunable without code changes. NEGATION always wins over POSITIVE (see classifier).

export const POSITIVE_PHRASES = [
  'visa sponsorship available', 'sponsorship available', 'visa sponsorship offered',
  'visa sponsorship provided', 'willing to sponsor', 'will sponsor', 'we can sponsor',
  'able to sponsor', 'open to sponsorship', 'sponsorship provided', 'sponsorship considered',
  'sponsorship for the right candidate', '482 sponsorship', 'tss sponsorship',
  'skills in demand visa', 'employer sponsored', 'visa support', 'pr pathway',
];

export const NEGATION_PHRASES = [
  'no visa sponsorship', 'no sponsorship', 'not able to sponsor', 'unable to sponsor',
  'cannot sponsor', 'do not offer sponsorship', 'does not offer sponsorship',
  'no sponsorship available', 'sponsorship not available', 'no visa support',
  'must have full working rights', 'must have unrestricted work rights',
  'must hold a valid visa', 'permanent residents only', 'citizens only',
  'must be an australian citizen', 'must have permanent residency',
];
