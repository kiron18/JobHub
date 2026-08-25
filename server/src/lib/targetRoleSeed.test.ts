import { describe, it, expect } from 'vitest';
import { targetRoleSeed } from './targetRoleSeed';

describe('targetRoleSeed', () => {
  it('drops a bracketed rung — the case that shipped an intern headline', () => {
    expect(targetRoleSeed('Data Analyst (Intern)')).toBe('Data Analyst');
  });

  it('drops a rung hung off the end after a separator', () => {
    expect(targetRoleSeed('Data Analyst - Intern')).toBe('Data Analyst');
    expect(targetRoleSeed('Data Analyst, Casual')).toBe('Data Analyst');
    expect(targetRoleSeed('Marketing Coordinator / Part-time')).toBe('Marketing Coordinator');
  });

  it('drops a leading rung when it is its own segment', () => {
    expect(targetRoleSeed('Intern - Data Analyst')).toBe('Data Analyst');
  });

  it('leaves a leading bare qualifier alone — it is usually part of the craft', () => {
    expect(targetRoleSeed('Contract Administrator')).toBe('Contract Administrator');
    expect(targetRoleSeed('Student Advisor')).toBe('Student Advisor');
    expect(targetRoleSeed('Volunteer Coordinator')).toBe('Volunteer Coordinator');
  });

  it('clears more than one qualifier', () => {
    expect(targetRoleSeed('Data Analyst (Intern) - Part-time')).toBe('Data Analyst');
  });

  it('leaves titles alone where the word IS the job', () => {
    expect(targetRoleSeed('Research Assistant')).toBe('Research Assistant');
    expect(targetRoleSeed('Clinical Support Associate')).toBe('Clinical Support Associate');
    expect(targetRoleSeed('Junior Software Engineer')).toBe('Junior Software Engineer');
    expect(targetRoleSeed('Graduate Engineer')).toBe('Graduate Engineer');
    expect(targetRoleSeed('Contract Administrator')).toBe('Contract Administrator');
  });

  it('keeps a bracket that is not a rung', () => {
    expect(targetRoleSeed('Analyst (Risk & Compliance)')).toBe('Analyst (Risk & Compliance)');
  });

  it('falls back to the original rather than returning a fragment', () => {
    expect(targetRoleSeed('Intern')).toBe('Intern');
    expect(targetRoleSeed('(Intern)')).toBe('(Intern)');
  });

  it('handles empty input', () => {
    expect(targetRoleSeed('')).toBe('');
    expect(targetRoleSeed(null)).toBe('');
    expect(targetRoleSeed(undefined)).toBe('');
  });

  it('normalises whitespace', () => {
    expect(targetRoleSeed('  Data   Analyst  (Intern) ')).toBe('Data Analyst');
  });
});
