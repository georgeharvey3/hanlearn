import React from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { createStore, applyMiddleware, combineReducers } from 'redux';
import thunk from 'redux-thunk';

import App from './App';
import wordsReducer from './store/reducers/addWords';
import authReducer from './store/reducers/auth';
import settingsReducer from './store/reducers/settings';

const rootReducer = combineReducers({
  addWords: wordsReducer,
  auth: authReducer,
  settings: settingsReducer,
});

const store = createStore(rootReducer, applyMiddleware(thunk));

test('renders app without crashing', () => {
  render(
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  );
});
