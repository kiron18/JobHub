/** First name, written normally: "KIRON KURIAN" and "kiron" both become "Kiron". */
export function firstName(full: string | null | undefined): string {
  const first = (full ?? '').trim().split(/\s+/)[0] ?? '';
  if (!first) return 'there';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}
