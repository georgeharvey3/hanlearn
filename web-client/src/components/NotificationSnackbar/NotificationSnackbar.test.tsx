import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, act, fireEvent } from '@testing-library/react';
import { renderWithProviders, createTestStore } from '../../test/utils';
import NotificationSnackbar from './NotificationSnackbar';
import { showNotification } from '../../store/actions/notifications';

const renderWith = (...notifications: ReturnType<typeof showNotification>[]) => {
  const store = createTestStore();
  notifications.forEach((n) => store.dispatch(n));
  renderWithProviders(<NotificationSnackbar bottom="24px" centre="50%" />, { store });
  return store;
};

describe('NotificationSnackbar', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when the queue is empty', () => {
    renderWith();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('closes a success toast after 4 seconds, then shows the next', () => {
    vi.useFakeTimers();
    const store = renderWith(
      showNotification('Word added', 'success'),
      showNotification('Second', 'info'),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Word added');

    act(() => {
      vi.advanceTimersByTime(3900);
    });
    expect(store.getState().notifications.queue).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(store.getState().notifications.queue.map((n) => n.message)).toEqual(['Second']);
  });

  it('keeps an error toast until the learner dismisses it', () => {
    vi.useFakeTimers();
    const store = renderWith(showNotification('Failed to add word', 'error', 1000));
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to add word');

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(store.getState().notifications.queue).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(store.getState().notifications.queue).toHaveLength(0);
  });
});
