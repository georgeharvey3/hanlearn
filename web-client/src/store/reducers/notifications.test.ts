import { describe, it, expect } from 'vitest';
import notificationsReducer from './notifications';
import { SHOW_NOTIFICATION, DISMISS_NOTIFICATION } from '../actions/actionTypes';
import { ShowNotificationAction, DismissNotificationAction } from '../../types/actions';

describe('notifications reducer', () => {
  it('returns initial state', () => {
    const state = notificationsReducer(undefined, {} as any);
    expect(state).toEqual({ queue: [] });
  });

  it('appends notification on SHOW_NOTIFICATION', () => {
    const notification = { id: '1', message: 'Hello', severity: 'success' as const };
    const action: ShowNotificationAction = {
      type: SHOW_NOTIFICATION,
      notification,
    };
    const state = notificationsReducer({ queue: [] }, action);
    expect(state.queue).toEqual([notification]);
  });

  it('maintains queue order (FIFO)', () => {
    const n1 = { id: '1', message: 'First', severity: 'success' as const };
    const n2 = { id: '2', message: 'Second', severity: 'info' as const };
    let state = notificationsReducer({ queue: [] }, { type: SHOW_NOTIFICATION, notification: n1 });
    state = notificationsReducer(state, { type: SHOW_NOTIFICATION, notification: n2 });
    expect(state.queue).toEqual([n1, n2]);
  });

  it('removes correct notification on DISMISS_NOTIFICATION', () => {
    const n1 = { id: '1', message: 'First', severity: 'success' as const };
    const n2 = { id: '2', message: 'Second', severity: 'info' as const };
    const action: DismissNotificationAction = { type: DISMISS_NOTIFICATION, id: '1' };
    const state = notificationsReducer({ queue: [n1, n2] }, action);
    expect(state.queue).toEqual([n2]);
  });

  it('is a no-op when dismissing non-existent id', () => {
    const n1 = { id: '1', message: 'First', severity: 'success' as const };
    const action: DismissNotificationAction = { type: DISMISS_NOTIFICATION, id: '999' };
    const state = notificationsReducer({ queue: [n1] }, action);
    expect(state.queue).toEqual([n1]);
  });
});
