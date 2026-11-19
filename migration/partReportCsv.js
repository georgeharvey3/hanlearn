/**
 * The CSV file of the reports of wrong breakdowns, one row for each report
 * (#533). A report from #563 on can carry a reason; an older one has none.
 *
 * Pure: export-part-reports.js reads the documents with the Admin SDK and
 * writes the file. The rows of one part sit together, so a person can fix its
 * label in `components/labels.json` once. A piece with no name of its own has
 * an empty part and label. The labels file names it under `parent`, and
 * `strokes` finds it in `char`.
 */

const PART_REPORT_COLUMNS = ['part', 'label', 'parent', 'char', 'strokes', 'reason', 'reportedAt'];

/** One CSV field: quoted when it holds a comma, a quote or a line break. */
const field = (value) => {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** The rows of the report documents: by part, by parent, by character, then oldest first. */
function partReportRows(reports) {
  return reports
    .map((report) => ({
      part: report.part ?? '',
      label: report.label ?? '',
      parent: report.parent,
      char: report.char,
      strokes: report.strokes.join(' '),
      reason: report.reason ?? '',
      reportedAt: report.reportedAt?.toDate?.().toISOString() ?? '',
    }))
    .sort(
      (a, b) =>
        compare(a.part, b.part) ||
        compare(a.parent, b.parent) ||
        compare(a.char, b.char) ||
        compare(a.reportedAt, b.reportedAt),
    );
}

function partReportCsv(reports) {
  const lines = [PART_REPORT_COLUMNS.join(',')];
  for (const row of partReportRows(reports)) {
    lines.push(PART_REPORT_COLUMNS.map((column) => field(row[column])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

module.exports = { PART_REPORT_COLUMNS, partReportCsv };
