import React, { useCallback } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Slide, { SlideProps } from '@mui/material/Slide';
import { connect, ConnectedProps } from 'react-redux';
import { RootState } from '../../types/store';
import { dismissNotification } from '../../store/actions/notifications';

function SlideDown(props: SlideProps) {
  return <Slide {...props} direction="down" />;
}

const mapStateToProps = (state: RootState) => ({
  current: state.notifications.queue[0] ?? null,
});

const mapDispatchToProps = {
  onDismiss: dismissNotification,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type Props = ConnectedProps<typeof connector>;

const NotificationSnackbar: React.FC<Props> = ({ current, onDismiss }) => {
  const handleClose = useCallback(
    (_event?: React.SyntheticEvent | Event, reason?: string) => {
      if (reason === 'clickaway') return;
      if (current) onDismiss(current.id);
    },
    [current, onDismiss],
  );

  return (
    <Snackbar
      open={!!current}
      autoHideDuration={current?.duration ?? 4000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      TransitionComponent={SlideDown}
    >
      {current ? (
        <Alert severity={current.severity} onClose={handleClose} variant="filled">
          {current.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  );
};

export default connector(NotificationSnackbar);
