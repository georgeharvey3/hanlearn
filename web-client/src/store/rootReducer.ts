import { combineReducers, Reducer } from 'redux';

import wordsReducer from './reducers/addWords';
import authReducer from './reducers/auth';
import settingsReducer from './reducers/settings';
import notificationsReducer from './reducers/notifications';

import { RootState } from '../types/store';
import { AppAction } from '../types/actions';

const combinedReducer = combineReducers({
  addWords: wordsReducer,
  auth: authReducer,
  settings: settingsReducer,
  notifications: notificationsReducer,
});

// Tests build a store from a few fields of a few slices, so each slice of the
// preloaded state is partial.
export type PreloadedRootState = { [K in keyof RootState]?: Partial<RootState[K]> };

// Redux 5 reads the shape of the preloaded state from reducers that accept
// UnknownAction. Each reducer here takes a narrow action union, so
// combineReducers gives every slice of the preloaded state the type never.
// This cast gives the preloaded state its real shape again.
const rootReducer = combinedReducer as Reducer<RootState, AppAction, PreloadedRootState>;

export default rootReducer;
