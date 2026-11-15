import { describe, it, expect } from 'vitest';
import { partReportCsv } from './partReportCsv';

/** A Firestore timestamp, as the Admin SDK reads one. */
const at = (iso) => ({ toDate: () => new Date(iso) });

describe('partReportCsv', () => {
  it('writes one row for each report, with the reports of one part together', () => {
    const csv = partReportCsv([
      { char: '礙', part: '疑', strokes: [5, 6], label: 'to doubt', reportedAt: at('2026-11-14T09:00:00Z') },
      { char: '疑', part: '矢', strokes: [2, 3], label: 'arrow', reportedAt: at('2026-11-13T09:00:00Z') },
      { char: '礙', part: '矢', strokes: [7, 8], label: 'arrow', reportedAt: at('2026-11-15T09:00:00Z') },
      { char: '疑', part: '矢', strokes: [2, 3], label: 'arrow', reportedAt: at('2026-11-12T09:00:00Z') },
    ]);

    expect(csv).toBe(
      [
        'part,label,char,strokes,reportedAt',
        '疑,to doubt,礙,5 6,2026-11-14T09:00:00.000Z',
        '矢,arrow,疑,2 3,2026-11-12T09:00:00.000Z',
        '矢,arrow,疑,2 3,2026-11-13T09:00:00.000Z',
        '矢,arrow,礙,7 8,2026-11-15T09:00:00.000Z',
        '',
      ].join('\n'),
    );
  });

  it('leaves the part and the label empty for a piece with no name of its own', () => {
    const csv = partReportCsv([
      { char: '疑', part: null, strokes: [7, 8], label: null, reportedAt: at('2026-11-14T09:00:00Z') },
    ]);

    expect(csv.split('\n')[1]).toBe(',,疑,7 8,2026-11-14T09:00:00.000Z');
  });

  it('quotes a label that holds a comma or a quote', () => {
    const csv = partReportCsv([
      { char: '凶', part: '凶', strokes: [0], label: 'fierce, "bad"', reportedAt: null },
    ]);

    expect(csv.split('\n')[1]).toBe('凶,"fierce, ""bad""",凶,0,');
  });

  it('writes only the header with no reports', () => {
    expect(partReportCsv([])).toBe('part,label,char,strokes,reportedAt\n');
  });
});
