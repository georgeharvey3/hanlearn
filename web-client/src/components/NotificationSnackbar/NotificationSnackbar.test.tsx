import { describe, it, expect, vi } from 'vitest';
import { screen, act } from '@testing-library/react';
import { renderWithProviders, createTestStore } from '../../test/utils';
import NotificationSnackbar from './NotificationSnackbar';
import { SHOW_NOTIFICATION } from '../../store/actions/actionTypes';

describe('NotificationSnackbar', () => {
  it('renders nothing when queue is empty', () => {
    renderWithProviders(<NotificationSnackbar />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders alert with correct message when queue has an item', () => {
    const store = createTestStore();
    store.dispatch({
      type: SHOW_NOTIFICATION,
      notification: { id: '1', message: 'Word added', severity: 'success' },
    });
    renderWithProviders(<NotificationSnackbar />, { store });
    expect(screen.getByRole('alert')).toHaveTextContent('Word added');
  });

  it('renders with error severity', () => {
    const store = createTestStore();
    store.dispatch({
      type: SHOW_NOTIFICATION,
      notification: { id: '1', message: 'Failed to add word', severity: 'error' },
    });
    renderWithProviders(<NotificationSnackbar />, { store });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Failed to add word');
  });

  it('dismisses notification on close and shows next', async () => {
    vi.useFakeTimers();
    const store = createTestStore();
    store.dispatch({
      type: SHOW_NOTIFICATION,
      notification: { id: '1', message: 'First', severity: 'success', duration: 100 },
    });
    store.dispatch({
      type: SHOW_NOTIFICATION,
      notification: { id: '2', message: 'Second', severity: 'info', duration: 100 },
    });

    renderWithProviders(<NotificationSnackbar />, { store });
    expect(screen.getByRole('alert')).toHaveTextContent('First');

    // Advance past the auto-hide duration
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // After dismissal, the queue should have shifted
    expect(store.getState().notifications.queue).toHaveLength(1);
    expect(store.getState().notifications.queue[0].message).toBe('Second');

    vi.useRealTimers();
  });
});
