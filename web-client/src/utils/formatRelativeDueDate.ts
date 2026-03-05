/**
 * Converts a due-date string (YYYY/MM/DD or YYYY-MM-DD) into a
 * human-readable countdown relative to `today`.
 */
export function formatRelativeDueDate(dateStr: string, today: Date = new Date()): string {
  const normalised = dateStr.replace(/\//g, '-');
  const [year, month, day] = normalised.split('-').map(Number);
  if (!year || !month || !day) return dateStr;

  const due = new Date(year, month - 1, day);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = due.getTime() - todayMidnight.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < -1) return `Overdue by ${Math.abs(diffDays)} days`;
  if (diffDays === -1) return 'Overdue by 1 day';
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due in ${diffDays} days`;
}
