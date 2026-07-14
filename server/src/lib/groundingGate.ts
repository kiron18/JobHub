// Grounding gate: deterministic verification that generated output is grounded in source text.
// Reuses normalizeForMatch and isGroundedInSource from fidelityGuard.

import { normalizeForMatch, isGroundedInSource } from './fidelityGuard';

export interface GroundingCheckResult {
  violations: string[];
}

/**
 * Extracts every number-bearing token from text.
 * Pattern matches: $50K, $1,200, 90%, 150+, 1.5%, etc.
 */
function extractNumbers(text: string): string[] {
  const pattern = /(\$[\d,.]+[kKmM]?\+?|\d+(?:\.\d+)?%|\b\d{2,}(?:,\d{3})*\+?\b)/g;
  return text.match(pattern) || [];
}

/**
 * Normalizes a number token for comparison by stripping $, commas, %, + and lowercasing k/m.
 * Also strips trailing periods that might appear at end of sentences.
 */
function normalizeNumber(num: string): string {
  return num
    .replace(/[.,]+$/, '')  // Strip trailing periods/commas (end of sentence)
    .replace(/[$,+%\s]/g, '')
    .toLowerCase();
}

/**
 * Checks if a string looks like a date line (e.g., "*Jan 2020 - Dec 2022*" or "*Present*")
 */
function isDateLine(line: string): boolean {
  return /^\s*\*[A-Za-z]{3}\s+\d{4}\s*-\s*(?:[A-Za-z]{3}\s+\d{4}|Present)\*\s*$/.test(line);
}

/**
 * Checks if a number is a bare 4-digit year in the range 1950-2035 (exempt from checking).
 */
function isExemptYear(num: string): boolean {
  const bareYear = num.replace(/[^\d]/g, '');
  if (bareYear.length !== 4) return false;
  const year = parseInt(bareYear, 10);
  return year >= 1950 && year <= 2035;
}

/**
 * Extracts the company part from a "### Role | Company" heading.
 */
function extractCompanyFromHeading(line: string): string | null {
  const match = line.match(/^###\s*[^|]+\|\s*(.+)$/);
  return match ? match[1].trim() : null;
}

/**
 * Extracts institution lines from the Education section.
 * Looks for lines directly following "**Degree**" lines.
 */
function extractInstitutions(output: string): string[] {
  const institutions: string[] = [];
  const lines = output.split('\n');

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];

    // Check if current line is a degree line
    if (/^\*\*[^*]+\*\*\s*·\s*\d{4}/.test(line)) {
      // Next line should be the institution
      const institution = nextLine?.trim();
      if (institution && institution.length > 0 && !institution.startsWith('**')) {
        institutions.push(institution);
      }
    }
  }

  return institutions;
}

/**
 * Extracts email addresses from text.
 */
function extractEmails(text: string): string[] {
  const pattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return text.match(pattern) || [];
}

/**
 * Extracts phone numbers from text (basic pattern matching common formats).
 * Requires at least 8 digits and reasonable phone-like structure.
 * Excludes bare 4-digit years.
 */
function extractPhones(text: string): string[] {
  // Matches patterns like: +61 412 345 678, (02) 9123 4567, 0412 345 678, etc.
  const pattern = /(?:\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}/g;
  const matches = text.match(pattern) || [];
  // Filter out matches that are just years (4 digits) and ensure at least 8 digits
  return matches.filter(m => {
    const digitCount = m.replace(/\D/g, '').length;
    return digitCount >= 8 && digitCount <= 15;
  });
}

/**
 * Strips all whitespace from a phone number for digit-for-digit comparison.
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, '');
}

/**
 * Checks if generated output is grounded in the source resume and job description.
 *
 * Checks performed:
 * 1. Numbers - every number in output must appear in resume OR job description
 * 2. Employers - every company in "### Role | Company" must be grounded in resume
 * 3. Institutions - every institution after a degree line must be grounded in resume
 * 4. Contact - email/phone in first 5 lines must appear verbatim in resume
 */
export function checkGrounding(
  output: string,
  resumeText: string,
  jobDescription: string
): GroundingCheckResult {
  const violations: string[] = [];
  const normalizedResume = normalizeForMatch(resumeText);
  const normalizedJobDesc = normalizeForMatch(jobDescription);
  const combinedSource = normalizedResume + ' ' + normalizedJobDesc;

  // 1. Numbers check
  const numbers = extractNumbers(output);
  for (const num of numbers) {
    // Skip exempt years
    if (isExemptYear(num)) continue;

    // Skip numbers in date lines
    const lines = output.split('\n');
    const numLine = lines.find(line => line.includes(num));
    if (numLine && isDateLine(numLine)) continue;

    const normalized = normalizeNumber(num);
    // normalizeForMatch replaces punctuation with spaces, so we need to check
    // if the normalized number (with spaces between digit groups) exists in the source
    // Also create a space-stripped version for matching
    const normalizedResumeForMatch = normalizeForMatch(resumeText).replace(/\s/g, '');
    const normalizedJobDescForMatch = normalizeForMatch(jobDescription).replace(/\s/g, '');

    const inResume = normalizedResumeForMatch.includes(normalized);
    const inJobDesc = normalizedJobDescForMatch.includes(normalized);

    if (!inResume && !inJobDesc) {
      violations.push(`Number "${num}" does not appear in the resume or job description`);
    }
  }

  // 2. Employers check - check ### Role | Company headings
  const lines = output.split('\n');
  for (const line of lines) {
    const company = extractCompanyFromHeading(line);
    if (company) {
      const grounded = isGroundedInSource(company, normalizedResume);
      if (!grounded) {
        violations.push(`Employer "${company}" does not appear in the resume`);
      }
    }
  }

  // 3. Institutions check
  const institutions = extractInstitutions(output);
  for (const institution of institutions) {
    const grounded = isGroundedInSource(institution, normalizedResume);
    if (!grounded) {
      violations.push(`Institution "${institution}" does not appear in the resume`);
    }
  }

  // 4. Contact check - email/phone in contact section must be in resume
  // Contact info appears early in the document, typically after the header and title
  // Scan first 10 lines and look for lines that contain contact-like content (|, @, or phone patterns)
  const contactSectionLines: string[] = [];
  for (const line of lines.slice(0, 10)) {
    // Contact lines typically contain pipe separators, emails, or phone-like patterns
    if (line.includes('|') || line.includes('@') || /\d{2,}/.test(line)) {
      contactSectionLines.push(line);
    }
  }
  const contactSection = contactSectionLines.join('\n');
  const emails = extractEmails(contactSection);
  const phones = extractPhones(contactSection);

  for (const email of emails) {
    if (!resumeText.includes(email)) {
      violations.push(`Email "${email}" does not appear in the resume`);
    }
  }

  for (const phone of phones) {
    const normalizedPhone = normalizePhone(phone);
    const resumePhones = extractPhones(resumeText).map(normalizePhone);
    if (!resumePhones.includes(normalizedPhone)) {
      violations.push(`Phone number "${phone}" does not appear in the resume`);
    }
  }

  return { violations };
}
