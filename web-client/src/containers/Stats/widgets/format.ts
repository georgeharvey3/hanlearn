/** Shared formatting for the scheduler stats, so every card reads the same. */

/** A rate as a whole-number percentage, or a dash when there is nothing to report. */
export function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

/** A number of days, or a dash when there are none to average. */
export function days(value: number | null): string {
  if (value === null) return '—';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} ${rounded === 1 ? 'day' : 'days'}`;
}
