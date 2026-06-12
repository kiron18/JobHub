import { describe, it, expect } from 'vitest';
import { extractReactText } from '../extractReactText';

describe('extractReactText', () => {
  it('returns a plain string unchanged', () => {
    expect(extractReactText('hello world')).toBe('hello world');
  });

  it('converts a number to string', () => {
    expect(extractReactText(42)).toBe('42');
  });

  it('returns empty string for null', () => {
    expect(extractReactText(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(extractReactText(undefined)).toBe('');
  });

  it('joins an array of strings', () => {
    expect(extractReactText(['foo', ' ', 'bar'])).toBe('foo bar');
  });

  it('joins a nested array', () => {
    expect(extractReactText(['foo', ['bar', 'baz']])).toBe('foobarbaz');
  });
});
