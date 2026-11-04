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

/** What a learner reports about one sentence. */
export interface SentenceReport {
  /** The id of the sentence in the files. */
  sentenceId: string;
  /** The word whose stage showed the sentence, in simplified characters. */
  word: string;
  stage: 'read' | 'write';
  /** The Chinese text that the stage showed. */
  sentence: string;
  english: string;
}

/**
 * The Firestore document of a report, at
 * `users/{userId}/sentenceReports/{sentenceId}`. The rules tests write the
 * same shape.
 */
export function sentenceReportDocument<T>(report: SentenceReport, reportedAt: T) {
  return {
    sentenceId: report.sentenceId,
    word: report.word,
    stage: report.stage,
    sentence: report.sentence,
    english: report.english,
    reportedAt,
  };
}
