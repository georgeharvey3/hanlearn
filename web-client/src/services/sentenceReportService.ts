import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from '../firebase/config';
import {
  SentenceReport,
  markOptionReported,
  markSentenceReported,
  sentenceReportDocument,
  sentenceReportId,
} from '../utils/reportedSentences';

/**
 * Save a learner's report of an example sentence, or of one option of the
 * Comprehend tab, and leave it out of the learner's later sessions on this
 * device. A person reads the reports with
 * `node migration/export-sentence-reports.js` (#469, #601).
 */
export async function reportSentence(userId: string, report: SentenceReport): Promise<void> {
  // First, so that the sentence stays out while the write waits for the network.
  if (report.stage === 'option') markOptionReported(report.sentenceId, report.distractorId);
  else markSentenceReported(report.sentenceId);
  await setDoc(
    doc(db, 'users', userId, 'sentenceReports', sentenceReportId(report)),
    sentenceReportDocument(report, serverTimestamp()),
  );
}
