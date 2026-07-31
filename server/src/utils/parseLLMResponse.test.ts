import { describe, it, expect } from 'vitest';
import { parseLLMJson } from './parseLLMResponse';

describe('parseLLMJson', () => {
  it('parses plain JSON', () => {
    expect(parseLLMJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips markdown fences', () => {
    expect(parseLLMJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('recovers JSON wrapped in prose', () => {
    expect(parseLLMJson('Sure! {"a":1} hope that helps')).toEqual({ a: 1 });
  });

  it('repairs raw tabs inside strings — the real intake failure', () => {
    // Verbatim from a failing Word-resume analysis. The model was asked to quote
    // a resume line exactly; Word uses tabs for alignment, and a literal tab
    // inside a JSON string is invalid, so the whole upload 502'd.
    const body = '{"anchor": "eClerx Services Ltd.\tMumbai |\t\tFinancial Analyst"}';
    expect(parseLLMJson(body)).toEqual({
      anchor: 'eClerx Services Ltd.\tMumbai |\t\tFinancial Analyst',
    });
  });

  it('repairs raw newlines and carriage returns inside strings', () => {
    expect(parseLLMJson('{"detail": "line one\nline two\r\nline three"}'))
      .toEqual({ detail: 'line one\nline two\r\nline three' });
  });

  it('repairs control characters inside a fenced body with prose around it', () => {
    const body = 'Here you go:\n```json\n{"a": "x\ty", "b": 2}\n```\nDone.';
    expect(parseLLMJson(body)).toEqual({ a: 'x\ty', b: 2 });
  });

  it('leaves whitespace BETWEEN tokens alone — only string contents are escaped', () => {
    // Newlines and tabs outside a string are legal JSON whitespace. Escaping
    // those would corrupt an otherwise valid document.
    expect(parseLLMJson('{\n\t"a": 1,\n\t"b": [1,\t2]\n}')).toEqual({ a: 1, b: [1, 2] });
  });

  it('does not corrupt already-escaped sequences', () => {
    const parsed = parseLLMJson('{"a": "tab\\there", "b": "quote\\"inside"}');
    expect(parsed).toEqual({ a: 'tab\there', b: 'quote"inside' });
  });

  it('handles a backslash immediately before a closing quote', () => {
    expect(parseLLMJson('{"a": "ends with backslash\\\\", "b": 1}'))
      .toEqual({ a: 'ends with backslash\\', b: 1 });
  });

  it('still strips JS comments', () => {
    expect(parseLLMJson('{"a":1 // note\n}')).toEqual({ a: 1 });
  });

  it('parses arrays', () => {
    expect(parseLLMJson('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('throws on genuinely unrecoverable output', () => {
    expect(() => parseLLMJson('I refuse to answer that.')).toThrow(/unparseable/);
  });
});
