import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import { keyframes } from '@mui/material/styles';

import { CheckIcon, CloseIcon } from '../Navigation/icons';
import { dismissNotification } from '../../store/actions/notifications';
import { Notification, RootState } from '../../types/store';
import { AppDispatch } from '../../types/actions';
import { colors, fonts } from '../../theme';
import { copy } from '../../copy';

const SUCCESS_DURATION = 4000;

const tones: Record<Notification['severity'], { bg: string; fg: string }> = {
  success: { bg: colors.primaryDark, fg: colors.white },
  error: { bg: colors.primaryLight, fg: colors.white },
  info: { bg: colors.text, fg: colors.paper },
  warning: { bg: colors.warningSurface, fg: colors.warningText },
};

const rise = keyframes`
  from { opacity: 0; transform: translate(-50%, 8px); }
  to { opacity: 1; transform: translate(-50%, 0); }
`;

interface Props {
  /** The distance from the bottom of the window, as CSS. */
  bottom: string;
  /** The horizontal centre of the page area, as CSS. */
  centre: string;
}

/**
 * A pill at the bottom centre of the page. A toast closes by itself after 4
 * seconds, but an error stays until the learner dismisses it, so that a slow
 * reader does not miss it.
 */
const NotificationSnackbar: React.FC<Props> = ({ bottom, centre }) => {
  const dispatch = useDispatch<AppDispatch>();
  const current = useSelector((state: RootState) => state.notifications.queue[0] ?? null);
  const persistent = current?.severity === 'error';

  useEffect(() => {
    if (!current || persistent) return;
    const timer = setTimeout(
      () => dispatch(dismissNotification(current.id)),
      current.duration ?? SUCCESS_DURATION,
    );
    return () => clearTimeout(timer);
  }, [current, persistent, dispatch]);

  if (!current) return null;
  const tone = tones[current.severity];

  return (
    <Box
      key={current.id}
      role={persistent ? 'alert' : 'status'}
      sx={{
        position: 'fixed',
        left: centre,
        bottom,
        zIndex: 1400,
        transform: 'translateX(-50%)',
        animation: `${rise} 160ms ease-out`,
        maxWidth: 'calc(100% - 32px)',
        width: 'max-content',
        boxSizing: 'border-box',
        minHeight: 44,
        pl: 2.5,
        pr: persistent ? 0 : 2.5,
        borderRadius: 1,
        bgcolor: tone.bg,
        color: tone.fg,
        boxShadow: '0 8px 24px -8px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: persistent ? 0.5 : 1,
        fontFamily: fonts.body,
        fontSize: 15,
        fontWeight: 600,
        textAlign: 'left',
      }}
    >
      {current.severity === 'success' && <CheckIcon />}
      <Box component="span" sx={{ py: 1.25 }}>
        {current.message}
      </Box>
      {persistent && (
        <ButtonBase
          aria-label={copy.shell.dismiss}
          onClick={() => dispatch(dismissNotification(current.id))}
          sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: '50%', color: 'inherit' }}
        >
          <CloseIcon />
        </ButtonBase>
      )}
    </Box>
  );
};

export default NotificationSnackbar;
