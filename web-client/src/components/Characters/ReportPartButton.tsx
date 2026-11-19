import React, { useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { Box, ButtonBase, TextField } from '@mui/material';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';

import { copy } from '../../copy';
import { colors, fonts } from '../../theme';
import { RootState } from '../../types/store';
import { reportPart } from '../../services/partReportService';
import { reportError } from '../../services/errorReporting';
import { MAX_REASON_LENGTH, PartReport, reasonOf } from '../../utils/partReports';

const mapStateToProps = (state: RootState) => ({ userId: state.auth.userId });

const connector = connect(mapStateToProps);

type Props = ConnectedProps<typeof connector> & { report: Omit<PartReport, 'reason'> };

type Status = 'idle' | 'open' | 'sent' | 'failed';

const buttonSx = {
  fontFamily: fonts.body,
  height: 44,
  px: 1,
  gap: 0.75,
  borderRadius: 1,
  fontSize: 14,
  fontWeight: 600,
  color: colors.textSecondary,
};

/**
 * Report a wrong breakdown on the line of a tapped part (#533, #563). The
 * first tap opens a field for an optional reason, and Send saves the report.
 * With no account there is nowhere to save the report, so the button does
 * not show. Give the button, or a parent of it, a `key` of the part, so that
 * the next part starts unreported.
 */
const ReportPartButton: React.FC<Props> = ({ userId, report }) => {
  const [status, setStatus] = useState<Status>('idle');
  const [text, setText] = useState('');

  if (!userId) return null;

  // A Firestore write resolves only when the server has it, so the button does
  // not wait: offline, the write waits in the queue and the learner moves on.
  // Only a rejection (the rules, a lost queue) offers the report again.
  const send = (): void => {
    setStatus('sent');
    reportPart(userId, { ...report, reason: reasonOf(text) }).catch((error) => {
      reportError(error, { feature: 'part-report' });
      setStatus('failed');
    });
  };

  if (status === 'open') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
        <TextField
          label={copy.test.partReportReason}
          value={text}
          onChange={(event) => setText(event.target.value)}
          size="small"
          autoFocus
          inputProps={{ maxLength: MAX_REASON_LENGTH }}
          sx={{ flex: 1 }}
        />
        <ButtonBase onClick={send} sx={{ ...buttonSx, color: colors.primaryDark }}>
          {copy.test.sendPartReport}
        </ButtonBase>
      </Box>
    );
  }

  const label =
    status === 'sent'
      ? copy.test.partReported
      : status === 'failed'
        ? copy.test.partReportFailed
        : copy.test.reportPart;

  return (
    <ButtonBase
      onClick={status === 'failed' ? send : () => setStatus('open')}
      disabled={status === 'sent'}
      sx={{ ...buttonSx, color: status === 'failed' ? colors.error : colors.textSecondary }}
    >
      <FlagOutlinedIcon sx={{ fontSize: 18 }} />
      {label}
    </ButtonBase>
  );
};

export default connector(ReportPartButton);
