import { describe, it, expect } from 'vitest';
import { analyzeRawTextLayout, countPdfImages } from './atsStructure';

// A realistic clean single-column resume: contact at top, normal length, only a
// few right-aligned dates (which must NOT trip the multi-column rule). Silent.
const CLEAN_RESUME = `Jane Smith
jane.smith@email.com | 0400 000 000 | Sydney NSW

PROFESSIONAL SUMMARY
Experienced operations coordinator with five years across logistics and supply
chain, focused on dispatch accuracy, stock control, and continuous improvement in
fast moving warehouse environments where deadlines and accuracy both matter.

EXPERIENCE
Operations Coordinator, Acme Logistics, Sydney        2021 to 2024
Coordinated daily dispatch across three warehouses and reduced late deliveries by
running a tighter morning planning routine with the transport team.
Managed a team of six pickers and owned the weekly stock reconciliation process.
Built a simple exception report that surfaced mismatches before they became orders.
Worked closely with planning and customer service to keep service levels on target.

Warehouse Supervisor, BrightFreight, Sydney        2018 to 2021
Supervised inbound goods receipting and maintained accurate inventory records in SAP.
Trained new staff on safe handling, cycle counting, and the warehouse system.
Reduced stock discrepancies by introducing a consistent end of shift count.

EDUCATION
Bachelor of Business, University of Sydney        2017
Major in supply chain management with electives in data analysis and operations.

SKILLS
SAP, Microsoft Excel, inventory reconciliation, cycle counting, stakeholder communication.`;

describe('analyzeRawTextLayout', () => {
  it('flags nothing for a clean single-column resume', () => {
    expect(analyzeRawTextLayout(CLEAN_RESUME)).toEqual([]);
  });

  it('does not flag multi-column just because dates are right-aligned', () => {
    // The clean resume above uses wide gaps before dates on a few lines; that
    // must not trip the multi-column rule.
    const reasons = analyzeRawTextLayout(CLEAN_RESUME);
    expect(reasons.some(r => r.includes('multi-column'))).toBe(false);
  });

  it('flags an image-based file with almost no extractable text', () => {
    const reasons = analyzeRawTextLayout('Jane Smith Resume 2024');
    expect(reasons.some(r => r.includes('image-based'))).toBe(true);
  });

  it('flags broken reading order when the email parses far down', () => {
    const filler = 'Skills and a long sidebar of keywords that parse first. '.repeat(20);
    const reasons = analyzeRawTextLayout(`${filler}\ncontact: jane.smith@email.com`);
    expect(reasons.some(r => r.includes('top to bottom'))).toBe(true);
  });

  it('flags a true multi-column layout with wide gutters on most lines', () => {
    const cols = Array.from({ length: 16 }, (_, i) =>
      `Left column content line ${i}        Right column sidebar item ${i}`
    ).join('\n');
    const reasons = analyzeRawTextLayout(cols);
    expect(reasons.some(r => r.includes('multi-column'))).toBe(true);
  });
});

describe('countPdfImages', () => {
  it('counts /Subtype /Image markers in raw bytes', () => {
    const buf = Buffer.from('/Subtype /Image foo /Subtype/Image bar /Subtype  /Image');
    expect(countPdfImages(buf)).toBe(3);
  });

  it('returns 0 when there are no image markers', () => {
    expect(countPdfImages(Buffer.from('just some text'))).toBe(0);
  });
});
