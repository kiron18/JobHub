import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../index', () => ({
  prisma: {
    salesLead: {
      updateMany: vi.fn(),
    },
  },
}));

import { recordSkoolClick } from './salesLead';
import { prisma } from '../index';

const mockUpdateMany = vi.mocked(prisma.salesLead.updateMany);

describe('recordSkoolClick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMany.mockResolvedValue({ count: 1 } as any);
  });

  it('stamps the click against the lead', async () => {
    await recordSkoolClick('lead_abc');

    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    const arg = mockUpdateMany.mock.calls[0][0] as any;
    expect(arg.where.id).toBe('lead_abc');
    expect(arg.data.skoolClickedAt).toBeInstanceOf(Date);
  });

  /**
   * The guard that makes this a record of when it first became true rather than
   * a last-seen timestamp. Every other signal on the board behaves this way, and
   * a second click months later must not rewrite the history.
   */
  it('only stamps a lead that has not clicked before', async () => {
    await recordSkoolClick('lead_abc');

    const arg = mockUpdateMany.mock.calls[0][0] as any;
    expect(arg.where.skoolClickedAt).toBeNull();
  });

  it('trims a padded id rather than missing the row', async () => {
    await recordSkoolClick('  lead_abc  ');

    const arg = mockUpdateMany.mock.calls[0][0] as any;
    expect(arg.where.id).toBe('lead_abc');
  });

  it('does nothing at all for a blank id', async () => {
    await recordSkoolClick('   ');
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  /**
   * The id comes off a URL a stranger can edit, so an unknown one is expected
   * traffic. updateMany matching nothing is the whole defence: no throw, no row.
   */
  it('is a silent no-op for an id that matches nobody', async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 } as any);
    await expect(recordSkoolClick('not-a-real-lead')).resolves.toBeUndefined();
  });
});
