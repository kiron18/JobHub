import React from 'react';

/**
 * Recursively extracts plain text content from React children.
 * Used by the custom ReactMarkdown `li` renderer to match bullet text
 * against tip bullet keys.
 */
export function extractReactText(children: React.ReactNode): string {
  if (children === null || children === undefined) return '';
  if (typeof children === 'string') return children;
  if (typeof children === 'number' || typeof children === 'boolean') return String(children);
  if (Array.isArray(children)) return children.map(extractReactText).join('');
  if (React.isValidElement(children)) {
    return extractReactText((children.props as { children?: React.ReactNode }).children);
  }
  return '';
}
