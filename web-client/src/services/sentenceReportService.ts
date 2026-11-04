import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from '../firebase/config';
import {
  SentenceReport,
  markSentenceReported,
  sentenceReportDocument,
} from '../utils/reportedSentences';

/**
 * Save a learner's report of an example sentence, and leave the sentence out
 * of the learner's later sessions on this device. A person reads the reports
 * with `node migration/export-sentence-reports.js` (#469).
 */
export async function reportSentence(userId: string, report: SentenceReport): Promise<void> {
  // First, so that the sentence stays out while the write waits for the network.
  markSentenceReported(report.sentenceId);
  await setDoc(
    doc(db, 'users', userId, 'sentenceReports', report.sentenceId),
    sentenceReportDocument(report, serverTimestamp()),
  );
}
