import { describe, it, expect } from 'vitest';
import { formatRelativeDueDate } from './formatRelativeDueDate';

const today = new Date(2026, 2, 5); // 2026-03-05

describe('formatRelativeDueDate', () => {
  it('returns "Due today" when the date matches today', () => {
    expect(formatRelativeDueDate('2026/03/05', today)).toBe('Due today');
  });

  it('returns "Due tomorrow" for +1 day', () => {
    expect(formatRelativeDueDate('2026/03/06', today)).toBe('Due tomorrow');
  });

  it('returns "Due in N days" for dates further ahead', () => {
    expect(formatRelativeDueDate('2026/03/08', today)).toBe('Due in 3 days');
  });

  it('returns "Overdue by 1 day" for yesterday', () => {
    expect(formatRelativeDueDate('2026/03/04', today)).toBe('Overdue by 1 day');
  });

  it('returns "Overdue by N days" for dates further in the past', () => {
    expect(formatRelativeDueDate('2026/03/01', today)).toBe('Overdue by 4 days');
  });

  it('handles YYYY-MM-DD format (hyphens)', () => {
    expect(formatRelativeDueDate('2026-03-05', today)).toBe('Due today');
  });

  it('returns the original string for unparseable input', () => {
    expect(formatRelativeDueDate('', today)).toBe('');
    expect(formatRelativeDueDate('invalid', today)).toBe('invalid');
  });
});
