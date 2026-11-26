/**
 * The sentences that the learner reported on this device. The sentence
 * service leaves them out, so a reported sentence does not come back. The
 * report itself goes to Firestore (sentenceReportService), and a person fixes
 * the data in the next build.
 */

const KEY = 'reportedSentences';

export function reportedSentenceIds(): Set<string> {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return new Set(Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

export function markSentenceReported(id: string): void {
  try {
    const ids = reportedSentenceIds();
    ids.add(id);
    localStorage.setItem(KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Storage is full or blocked: the sentence can come back. The report still went.
  }
}

const OPTIONS_KEY = 'reportedOptions';

/** The key of one reported option: the sentence id and the distractor id. */
const optionKey = (sentenceId: string, distractorId: string): string =>
  `${sentenceId}-${distractorId}`;

/**
 * The distractors that the learner reported on this device, as keys of the
 * sentence id and the distractor id (#601). The sentence service leaves them
 * out of the options of their sentence only: the distractor stays a good
 * sentence, and a good option of other sentences.
 */
export function reportedOptionKeys(): Set<string> {
  try {
    const stored = JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? '[]');
    return new Set(Array.isArray(stored) ? stored.filter((key) => typeof key === 'string') : []);
  } catch {
    return new Set();
  }
}

export const isOptionReported = (
  keys: ReadonlySet<string>,
  sentenceId: string,
  distractorId: string,
): boolean => keys.has(optionKey(sentenceId, distractorId));

export function markOptionReported(sentenceId: string, distractorId: string): void {
  try {
    const keys = reportedOptionKeys();
    keys.add(optionKey(sentenceId, distractorId));
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(Array.from(keys)));
  } catch {
    // Storage is full or blocked: the option can come back. The report still went.
  }
}

interface ReportBase {
  /** The id of the sentence in the files. */
  sentenceId: string;
  /** The word whose stage showed the sentence, in simplified characters. */
  word: string;
  /** The Chinese text that the stage showed. */
  sentence: string;
}

/** What a learner reports about one sentence, or about one option of it (#601). */
export type SentenceReport =
  | (ReportBase & { stage: 'read' | 'write'; english: string })
  | (ReportBase & {
      stage: 'option';
      /** The id of the distractor sentence that the option showed. */
      distractorId: string;
      /** The English of the option. */
      english: string;
    });

/**
 * The id of the report document: the sentence id, and for an option also the
 * distractor id, so that the reports of two options of one sentence both stay.
 */
export const sentenceReportId = (report: SentenceReport): string =>
  report.stage === 'option' ? optionKey(report.sentenceId, report.distractorId) : report.sentenceId;

/**
 * The Firestore document of a report, at
 * `users/{userId}/sentenceReports/{sentenceReportId}`. The rules tests write
 * the same shape.
 */
export function sentenceReportDocument<T>(report: SentenceReport, reportedAt: T) {
  return {
    sentenceId: report.sentenceId,
    word: report.word,
    stage: report.stage,
    sentence: report.sentence,
    english: report.english,
    ...(report.stage === 'option' ? { distractorId: report.distractorId } : {}),
    reportedAt,
  };
}
