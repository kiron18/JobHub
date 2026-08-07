import { describe, it, expect } from 'vitest';
import { emailFromResume } from './welcome';

describe('emailFromResume', () => {
  it('finds the address in a normal resume header', () => {
    const cv = `PRIYADARSHINI RAMESH
Sydney NSW | 0412 345 678 | priyaramesh1198@gmail.com | linkedin.com/in/priya

PROFESSIONAL SUMMARY
Clinical research professional with six years of experience.`;
    expect(emailFromResume(cv)).toBe('priyaramesh1198@gmail.com');
  });

  it('normalises case and strips trailing punctuation', () => {
    expect(emailFromResume('Contact: Sachin.Borkar@Outlook.COM,')).toBe('sachin.borkar@outlook.com');
  });

  it('ignores placeholder addresses left in downloaded templates', () => {
    expect(emailFromResume('Jane Doe | yourname@example.com | Melbourne')).toBeNull();
    expect(emailFromResume('email@domain.com')).toBeNull();
  });

  it('takes the header address, not a referee further down', () => {
    const cv = `ALEXYS WARJOVAARA
Bangkok | alexysw17@gmail.com

${'Experience filler line.\n'.repeat(90)}
REFEREES
Dr Helen Prior, University of Exeter, h.prior@exeter.ac.uk`;
    expect(emailFromResume(cv)).toBe('alexysw17@gmail.com');
  });

  it('returns null when there is no address at all', () => {
    expect(emailFromResume('Simbarashe Mlilwana\nGeospatial Analyst, Hobart')).toBeNull();
    expect(emailFromResume('')).toBeNull();
  });
});
