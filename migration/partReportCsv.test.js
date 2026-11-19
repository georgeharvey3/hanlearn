import { describe, it, expect } from 'vitest';
import { partReportCsv } from './partReportCsv';

/** A Firestore timestamp, as the Admin SDK reads one. */
const at = (iso) => ({ toDate: () => new Date(iso) });

describe('partReportCsv', () => {
  it('writes one row for each report, with the reports of one part together', () => {
    const csv = partReportCsv([
      { char: '礙', parent: '礙', part: '疑', strokes: [5, 6], label: 'to doubt', reportedAt: at('2026-11-14T09:00:00Z') },
      { char: '疑', parent: '疑', part: '矢', strokes: [2, 3], label: 'arrow', reportedAt: at('2026-11-13T09:00:00Z') },
      { char: '礙', parent: '疑', part: '矢', strokes: [7, 8], label: 'arrow', reportedAt: at('2026-11-15T09:00:00Z') },
      { char: '疑', parent: '疑', part: '矢', strokes: [2, 3], label: 'arrow', reportedAt: at('2026-11-12T09:00:00Z') },
    ]);

    expect(csv).toBe(
      [
        'part,label,parent,char,strokes,reason,reportedAt',
        '疑,to doubt,礙,礙,5 6,,2026-11-14T09:00:00.000Z',
        '矢,arrow,疑,疑,2 3,,2026-11-12T09:00:00.000Z',
        '矢,arrow,疑,疑,2 3,,2026-11-13T09:00:00.000Z',
        '矢,arrow,疑,礙,7 8,,2026-11-15T09:00:00.000Z',
        '',
      ].join('\n'),
    );
  });

  it('leaves the part and the label empty for a piece with no name of its own', () => {
    const csv = partReportCsv([
      { char: '礙', parent: '疑', part: null, strokes: [12, 13], label: null, reportedAt: at('2026-11-14T09:00:00Z') },
    ]);

    expect(csv.split('\n')[1]).toBe(',,疑,礙,12 13,,2026-11-14T09:00:00.000Z');
  });

  it('quotes a label that holds a comma or a quote', () => {
    const csv = partReportCsv([
      { char: '凶', parent: '凶', part: '凶', strokes: [0], label: 'fierce, "bad"', reportedAt: null },
    ]);

    expect(csv.split('\n')[1]).toBe('凶,"fierce, ""bad""",凶,凶,0,,');
  });

  it('writes the reason of a report, quoted when it holds a line break', () => {
    const csv = partReportCsv([
      { char: '酒', parent: '酒', part: '酉', strokes: [3, 4, 5, 6, 7, 8, 9], label: 'wine jar', reason: 'The bottom\nline is wrong', reportedAt: null },
    ]);

    expect(csv.split('\n').slice(1).join('\n')).toBe('酉,wine jar,酒,酒,3 4 5 6 7 8 9,"The bottom\nline is wrong",\n');
  });

  it('writes only the header with no reports', () => {
    expect(partReportCsv([])).toBe('part,label,parent,char,strokes,reason,reportedAt\n');
  });
});
