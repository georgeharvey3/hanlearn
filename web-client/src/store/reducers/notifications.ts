import * as actionTypes from '../actions/actionTypes';
import { NotificationAction } from '../../types/actions';
import { NotificationsState } from '../../types/store';

const initialState: NotificationsState = {
  queue: [],
};

const notificationsReducer = (
  state: NotificationsState = initialState,
  action: NotificationAction,
): NotificationsState => {
  switch (action.type) {
    case actionTypes.SHOW_NOTIFICATION:
      return {
        ...state,
        queue: [...state.queue, action.notification],
      };
    case actionTypes.DISMISS_NOTIFICATION:
      return {
        ...state,
        queue: state.queue.filter((n) => n.id !== action.id),
      };
    default:
      return state;
  }
};

export default notificationsReducer;
