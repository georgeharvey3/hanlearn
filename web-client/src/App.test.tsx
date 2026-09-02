import { vi } from 'vitest';

vi.mock('./firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('./firebase/auth', () => ({
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  logoutUser: vi.fn(),
  signInWithGoogle: vi.fn(),
  subscribeToAuthChanges: vi.fn(() => vi.fn()),
  getCurrentUser: vi.fn(() => null),
}));
vi.mock('./services/wordService');
vi.mock('./services/streakService', () => ({
  recordTestCompletion: vi.fn(),
  getStreakData: vi.fn().mockResolvedValue([]),
  calculateStreak: vi.fn().mockReturnValue(0),
}));
vi.mock('./services/dashboardService', () => ({
  getDashboardStats: vi.fn().mockResolvedValue({
    totalWords: 0,
    dueWords: 0,
    streak: 0,
    levelDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    directionDistribution: {},
    masteredCount: 0,
  }),
}));
vi.mock('./services/sentenceService', () => ({
  checkSentenceAvailability: vi.fn().mockResolvedValue(false),
  getHintSentence: vi.fn().mockResolvedValue(null),
}));
vi.mock('./services/analyticsService', () => ({
  trackPageView: vi.fn(),
  trackFeatureUsage: vi.fn(),
}));

import React from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';

import App from './App';
import rootReducer from './store/rootReducer';

const store = createStore(rootReducer, applyMiddleware(thunk));

test('renders app without crashing', () => {
  render(
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>,
  );
});
