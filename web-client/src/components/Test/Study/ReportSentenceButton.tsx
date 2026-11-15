import React from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { copy } from '../../../copy';
import { RootState } from '../../../types/store';
import { reportSentence } from '../../../services/sentenceReportService';
import { SentenceReport } from '../../../utils/reportedSentences';
import ReportButton from './ReportButton';

const mapStateToProps = (state: RootState) => ({ userId: state.auth.userId });

const connector = connect(mapStateToProps);

interface OwnProps {
  /** The sentence on screen, or null when there is none. */
  report: SentenceReport | null;
  /** The tryout has no account to save a report to. */
  isDemo?: boolean;
}

type Props = ConnectedProps<typeof connector> & OwnProps;

/**
 * Report a bad example sentence: a wrong translation, a wrong gloss, an
 * unnatural sentence. One tap saves the report and leaves the sentence out of
 * the learner's later sessions. Give it a `key` of the word and the sentence
 * id, so that the next question starts unreported: one sentence can serve two
 * words.
 */
const ReportSentenceButton: React.FC<Props> = ({ userId, report, isDemo }) => {
  if (!userId || !report || isDemo) return null;

  return (
    <ReportButton
      send={() => reportSentence(userId, report)}
      labels={{
        report: copy.sentence.report,
        reported: copy.sentence.reported,
        failed: copy.sentence.reportFailed,
      }}
      feature="sentence-report"
      context={{ stage: report.stage }}
      sx={{ alignSelf: 'center', mt: 1.5 }}
    />
  );
};

export default connector(ReportSentenceButton);
