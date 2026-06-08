import { describe, it, expect } from 'vitest';
import { reconcileApplication } from './applicationReconcile';

describe('reconcileApplication', () => {
  it('creates when no existing application', () => {
    expect(reconcileApplication(null)).toEqual({ kind: 'create' });
  });

  it('reports already_applied when existing is APPLIED', () => {
    expect(reconcileApplication({ status: 'APPLIED' })).toEqual({ kind: 'already_applied' });
  });

  it('promotes a SAVED application and keeps its previous status', () => {
    expect(reconcileApplication({ status: 'SAVED' })).toEqual({ kind: 'promote', previousStatus: 'SAVED' });
  });

  it('promotes any non-APPLIED status (e.g. REJECTED)', () => {
    expect(reconcileApplication({ status: 'REJECTED' })).toEqual({ kind: 'promote', previousStatus: 'REJECTED' });
  });
});
