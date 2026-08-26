import './sentry';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware, compose, Store, StoreEnhancer } from 'redux';
import { thunk } from 'redux-thunk';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import rootReducer from './store/rootReducer';
import theme from './theme';

import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorker';
import { initPerformanceMonitoring } from './services/performanceService';
import { RootState } from './types/store';
import { AppAction } from './types/actions';

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: typeof compose;
  }
}

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

const store: Store<RootState, AppAction> = createStore<RootState, AppAction>(
  rootReducer,
  composeEnhancers(applyMiddleware(thunk)) as StoreEnhancer,
);

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  </React.StrictMode>,
);

initPerformanceMonitoring();

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
