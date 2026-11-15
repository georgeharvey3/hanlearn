import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from '../firebase/config';
import { PartReport, partReportDocument, partReportId } from '../utils/partReports';

/**
 * Save a learner's report of a wrong part meaning in the breakdown. A person
 * reads the reports with `node migration/export-part-reports.js` (#533).
 */
export async function reportPart(userId: string, report: PartReport): Promise<void> {
  await setDoc(
    doc(db, 'users', userId, 'partReports', partReportId(report)),
    partReportDocument(report, serverTimestamp()),
  );
}
