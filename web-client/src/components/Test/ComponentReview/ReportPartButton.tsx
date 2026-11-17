import React from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { copy } from '../../../copy';
import { RootState } from '../../../types/store';
import { reportPart } from '../../../services/partReportService';
import { PartReport } from '../../../utils/partReports';
import ReportButton from '../Study/ReportButton';

const mapStateToProps = (state: RootState) => ({ userId: state.auth.userId });

const connector = connect(mapStateToProps);

type Props = ConnectedProps<typeof connector> & { report: PartReport };

/**
 * Report a wrong meaning on the line of a tapped part (#533). With no account
 * there is nowhere to save the report, so the button does not show.
 */
const ReportPartButton: React.FC<Props> = ({ userId, report }) => {
  if (!userId) return null;

  return (
    <ReportButton
      send={() => reportPart(userId, report)}
      labels={{
        report: copy.test.reportPart,
        reported: copy.test.partReported,
        failed: copy.test.partReportFailed,
      }}
      feature="part-report"
      sx={{ px: 1 }}
    />
  );
};

export default connector(ReportPartButton);
