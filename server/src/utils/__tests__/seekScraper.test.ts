import { describe, it, expect } from 'vitest'
import { buildSeekClusterKey as buildClusterKey } from '../../services/seekScraper'

describe('buildClusterKey', () => {
  it('trims whitespace and lowercases city', () => {
    const k = buildClusterKey('  Software Engineer  ', '  Melbourne  ', 'Tech')
    expect(k.role).toBe('Software Engineer')
    expect(k.city).toBe('melbourne')
  })

  it('strips state suffix from city', () => {
    const k1 = buildClusterKey('Engineer', 'Melbourne, VIC', null)
    const k2 = buildClusterKey('Engineer', 'Melbourne', null)
    expect(k1.hash).toBe(k2.hash)
  })

  it('produces identical hashes for identical inputs', () => {
    const k1 = buildClusterKey('Software Engineer', 'Melbourne', 'Tech')
    const k2 = buildClusterKey('Software Engineer', 'Melbourne', 'Tech')
    expect(k1.hash).toBe(k2.hash)
  })

  it('produces different hashes for different roles', () => {
    const k1 = buildClusterKey('Software Engineer', 'Melbourne', 'Tech')
    const k2 = buildClusterKey('Data Scientist', 'Melbourne', 'Tech')
    expect(k1.hash).not.toBe(k2.hash)
  })

  it('produces different hashes for different cities', () => {
    const k1 = buildClusterKey('Engineer', 'Melbourne', 'Tech')
    const k2 = buildClusterKey('Engineer', 'Sydney', 'Tech')
    expect(k1.hash).not.toBe(k2.hash)
  })

  it('treats null industry same as empty string', () => {
    const k1 = buildClusterKey('Engineer', 'Melbourne', null)
    const k2 = buildClusterKey('Engineer', 'Melbourne', '')
    expect(k1.hash).toBe(k2.hash)
  })

  it('strips seniority prefix so senior and junior roles share a cluster', () => {
    const k1 = buildClusterKey('Senior Software Engineer', 'Melbourne', 'Tech')
    const k2 = buildClusterKey('Software Engineer', 'Melbourne', 'Tech')
    expect(k1.role).toBe('Software Engineer')
    expect(k1.hash).toBe(k2.hash)
  })
})
