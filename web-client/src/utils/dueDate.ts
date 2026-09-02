/**
 * Parse a due-date string into a Date.
 *
 * Three formats are in circulation:
 *   • YYYY/MM/DD  — stored by wordService.formatDate (the common case)
 *   • YYYY-MM-DD  — ISO date-only (hyphenated variant)
 *   • ISO 8601    — full timestamp like "2026-03-07T10:00:00.000Z" (demo words)
 *
 * ISO strings containing 'T' are parsed with new Date() — all browsers handle
 * these correctly.  Date-only strings are parsed manually so Safari/WebKit
 * (which returns Invalid Date for slash-separated strings) works on iOS.
 */
export function parseDueDate(dateStr: string): Date | null {
  if (dateStr.includes('T')) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
  const normalised = dateStr.replace(/\//g, '-');
  const [year, month, day] = normalised.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}
