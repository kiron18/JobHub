/**
 * The deep link is the entire value of the admin task email: it removes the
 * "find them" step. If the address is encoded wrongly the link opens an empty
 * search, which looks like the customer never joined and sends Kiron chasing a
 * problem that does not exist.
 */
import { describe, it, expect } from 'vitest';
import { skoolMemberSearchUrl } from '../lib/skoolLinks';

describe('skoolMemberSearchUrl', () => {
  it('encodes the @ so the query survives a mail client', () => {
    expect(skoolMemberSearchUrl('awasthi26061@outlook.com')).toBe(
      'https://www.skool.com/touch-grass-5787/-/search?q=awasthi26061%40outlook.com&t=members',
    );
  });

  it('encodes plus addressing rather than turning it into a space', () => {
    // A raw + in a query string decodes as a space, which would silently search
    // for the wrong person.
    expect(skoolMemberSearchUrl('kiron+test@gmail.com')).toContain('q=kiron%2Btest%40gmail.com');
  });

  it('targets the members tab, not posts', () => {
    expect(skoolMemberSearchUrl('a@b.com')).toContain('&t=members');
  });
});
