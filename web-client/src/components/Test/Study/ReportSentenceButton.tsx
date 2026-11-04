import React, { useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { ButtonBase } from '@mui/material';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';

import { copy } from '../../../copy';
import { colors, fonts } from '../../../theme';
import { RootState } from '../../../types/store';
import { reportSentence } from '../../../services/sentenceReportService';
import { reportError } from '../../../services/errorReporting';
import { SentenceReport } from '../../../utils/reportedSentences';

const mapStateToProps = (state: RootState) => ({ userId: state.auth.userId });

const connector = connect(mapStateToProps);

interface OwnProps {
  /** The sentence on screen, or null when there is none. */
  report: SentenceReport | null;
  /** The tryout has no account to save a report to. */
  isDemo?: boolean;
}

type Props = ConnectedProps<typeof connector> & OwnProps;

type Status = 'idle' | 'sent' | 'failed';

/**
 * Report a bad example sentence: a wrong translation, a wrong gloss, an
 * unnatural sentence. One tap saves the report and leaves the sentence out of
 * the learner's later sessions. Give it a `key` of the word and the sentence
 * id, so that the next question starts unreported: one sentence can serve two
 * words.
 */
const ReportSentenceButton: React.FC<Props> = ({ userId, report, isDemo }) => {
  const [status, setStatus] = useState<Status>('idle');

  if (!userId || !report || isDemo) return null;

  // A Firestore write resolves only when the server has it, so the button does
  // not wait: offline, the write waits in the queue and the learner moves on.
  // Only a rejection (the rules, a lost queue) offers the report again.
  const onReport = (): void => {
    setStatus('sent');
    reportSentence(userId, report).catch((error) => {
      reportError(error, { feature: 'sentence-report', context: { stage: report.stage } });
      setStatus('failed');
    });
  };

  const label =
    status === 'sent'
      ? copy.sentence.reported
      : status === 'failed'
        ? copy.sentence.reportFailed
        : copy.sentence.report;

  return (
    <ButtonBase
      onClick={onReport}
      disabled={status === 'sent'}
      sx={{
        fontFamily: fonts.body,
        alignSelf: 'center',
        mt: 1.5,
        height: 44,
        px: 1.75,
        gap: 0.75,
        borderRadius: 1,
        fontSize: 14,
        fontWeight: 600,
        color: status === 'failed' ? colors.error : colors.textSecondary,
      }}
    >
      <FlagOutlinedIcon sx={{ fontSize: 18 }} />
      {label}
    </ButtonBase>
  );
};

export default connector(ReportSentenceButton);
