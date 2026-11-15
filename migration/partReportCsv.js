/**
 * The CSV file of the reports of wrong part meanings, one row for each
 * report (#533).
 *
 * Pure: export-part-reports.js reads the documents with the Admin SDK and
 * writes the file. The rows of one part sit together, so a person can fix its
 * label in `components/labels.json` once. A piece with no name of its own has
 * an empty part and label; `char` and `strokes` find it.
 */

const PART_REPORT_COLUMNS = ['part', 'label', 'char', 'strokes', 'reportedAt'];

/** One CSV field: quoted when it holds a comma, a quote or a line break. */
const field = (value) => {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** The rows of the report documents: by part, then by character, then oldest first. */
function partReportRows(reports) {
  return reports
    .map((report) => ({
      part: report.part ?? '',
      label: report.label ?? '',
      char: report.char,
      strokes: report.strokes.join(' '),
      reportedAt: report.reportedAt?.toDate?.().toISOString() ?? '',
    }))
    .sort(
      (a, b) =>
        compare(a.part, b.part) ||
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
