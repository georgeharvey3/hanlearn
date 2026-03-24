import * as actionTypes from './actionTypes';
import { ShowNotificationAction, DismissNotificationAction } from '../../types/actions';

let notificationId = 0;

export const showNotification = (
  message: string,
  severity: 'success' | 'error' | 'info' | 'warning' = 'success',
  duration?: number,
): ShowNotificationAction => ({
  type: actionTypes.SHOW_NOTIFICATION,
  notification: {
    id: String(++notificationId),
    message,
    severity,
    duration,
  },
});

export const dismissNotification = (id: string): DismissNotificationAction => ({
  type: actionTypes.DISMISS_NOTIFICATION,
  id,
});
