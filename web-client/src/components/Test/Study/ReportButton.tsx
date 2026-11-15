import React, { useState } from 'react';
import { ButtonBase, SxProps, Theme } from '@mui/material';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';

import { colors, fonts } from '../../../theme';
import { reportError } from '../../../services/errorReporting';

interface Props {
  /** Save the report. */
  send: () => Promise<void>;
  labels: { report: string; reported: string; failed: string };
  /** The tags of a failed save in the error reports. */
  feature: string;
  context?: Record<string, unknown>;
  sx?: SxProps<Theme>;
}

type Status = 'idle' | 'sent' | 'failed';

/**
 * One tap saves a report, and the label says that it is saved. Give the
 * button a `key` of the thing that it reports, so that the next thing starts
 * unreported.
 */
const ReportButton: React.FC<Props> = ({ send, labels, feature, context, sx }) => {
  const [status, setStatus] = useState<Status>('idle');

  // A Firestore write resolves only when the server has it, so the button does
  // not wait: offline, the write waits in the queue and the learner moves on.
  // Only a rejection (the rules, a lost queue) offers the report again.
  const onReport = (): void => {
    setStatus('sent');
    send().catch((error) => {
      reportError(error, { feature, context });
      setStatus('failed');
    });
  };

  const label =
    status === 'sent' ? labels.reported : status === 'failed' ? labels.failed : labels.report;

  return (
    <ButtonBase
      onClick={onReport}
      disabled={status === 'sent'}
      sx={[
        {
          fontFamily: fonts.body,
          height: 44,
          px: 1.75,
          gap: 0.75,
          borderRadius: 1,
          fontSize: 14,
          fontWeight: 600,
          color: status === 'failed' ? colors.error : colors.textSecondary,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <FlagOutlinedIcon sx={{ fontSize: 18 }} />
      {label}
    </ButtonBase>
  );
};

export default ReportButton;
