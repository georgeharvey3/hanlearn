/**
 * What a learner reports about one part of the breakdown of a character: its
 * label (#533), or its split, with an optional reason (#563). A person reads
 * the reports with `node migration/export-part-reports.js` and corrects
 * `migration/components/labels.json` or `definitions.json`.
 */
export interface PartReport {
  /** The character that the breakdown split: the top of the tree. */
  char: string;
  /**
   * The character directly above the part: `char` for a part of the first
   * split. The labels file names an unnamed piece under this character.
   */
  parent: string;
  /** The character of the part; null for a piece with no name of its own. */
  part: string | null;
  /** The stroke indices of the part, in the strokes of `char`. They name the part in `char`. */
  strokes: number[];
  /** The label that the line showed; null when it showed "no name of its own". */
  label: string | null;
  /** What the learner wrote about the breakdown, trimmed; null when they wrote nothing. */
  reason: string | null;
}

/** The longest reason that a report keeps. The rules allow no more. */
export const MAX_REASON_LENGTH = 500;

/** The reason that a report saves from the text of the field. */
export function reasonOf(text: string): string | null {
  const reason = text.trim().slice(0, MAX_REASON_LENGTH);
  return reason === '' ? null : reason;
}

/**
 * The id of the report document: the hex code point of the character, then
 * the strokes of the part. A second report of the same part replaces the
 * first, so one learner counts once.
 */
export function partReportId(report: PartReport): string {
  return `${report.char.codePointAt(0)!.toString(16)}-${report.strokes.join('.')}`;
}

/**
 * The Firestore document of a report, at
 * `users/{userId}/partReports/{partReportId}`. The rules tests write the same
 * shape.
 */
export function partReportDocument<T>(report: PartReport, reportedAt: T) {
  return {
    char: report.char,
    parent: report.parent,
    part: report.part,
    strokes: report.strokes,
    label: report.label,
    reason: report.reason,
    reportedAt,
  };
}
