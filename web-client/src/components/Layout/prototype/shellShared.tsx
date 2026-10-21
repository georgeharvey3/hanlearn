// PROTOTYPE (#401): data and props the three app-shell variants share. Each
// variant owns its own layout; only the link list and the strings live here.
import React, { ReactNode } from 'react';
import { useSelector } from 'react-redux';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { RootState } from '../../../types/store';
import { Notification } from '../../../types/store';

export const shellCopy = {
  brand: 'HanLearn',
  home: 'Home',
  add: 'Add words',
  addShort: 'Add',
  study: 'Study',
  stats: 'Stats',
  settings: 'Settings',
  more: 'More',
  shortcuts: 'Shortcuts',
  logout: 'Log out',
  login: 'Log in',
  signUp: 'Sign up',
  menu: 'Menu',
  closeMenu: 'Close menu',
  collapse: 'Collapse',
  expand: 'Expand',
  studyNow: 'Study now',
  due: (n: number) => `${n} due`,
  loading: 'Loading',
  errorTitle: 'Something went wrong',
  errorBody: "This page didn't load.",
  tryAgain: 'Try again',
  goHome: 'Home',
  dismiss: 'Dismiss',
  account: 'Account',
};

export interface ShellLink {
  to: string;
  label: string;
  short: string;
  hanzi: string;
  icon: ReactNode;
}

export const shellLinks: ShellLink[] = [
  {
    to: '/',
    label: shellCopy.home,
    short: shellCopy.home,
    hanzi: '首页',
    icon: <HomeOutlinedIcon />,
  },
  {
    to: '/test-words',
    label: shellCopy.study,
    short: shellCopy.study,
    hanzi: '学习',
    icon: <SchoolOutlinedIcon />,
  },
  {
    to: '/add-words',
    label: shellCopy.add,
    short: shellCopy.addShort,
    hanzi: '加词',
    icon: <AddCircleOutlineIcon />,
  },
  {
    to: '/stats',
    label: shellCopy.stats,
    short: shellCopy.stats,
    hanzi: '统计',
    icon: <InsightsOutlinedIcon />,
  },
  {
    to: '/settings',
    label: shellCopy.settings,
    short: shellCopy.settings,
    hanzi: '设置',
    icon: <SettingsOutlinedIcon />,
  },
];

export const isActive = (pathname: string, to: string): boolean =>
  to === '/' ? pathname === '/' : pathname.startsWith(to);

export const pageTitle = (pathname: string): string =>
  shellLinks.find((l) => isActive(pathname, l.to))?.label ?? shellCopy.brand;

/** Words due across all lists, as the dashboard last counted them. */
export const useDueCount = (): number =>
  useSelector((s: RootState) =>
    Object.values(s.addWords.listStats).reduce((sum, st) => sum + st.due, 0),
  );

export interface ShellProps {
  isAuthenticated: boolean;
  /** The Test asks for focus on a phone: the shell hides. */
  focused: boolean;
  /** `?state=` preview: '' | 'loading' | 'error'. */
  previewState: string;
  notification: Notification | null;
  onDismissNotification: () => void;
  onOpenShortcuts: () => void;
  onLogout: () => void;
  onLogin: () => void;
  onRegister: () => void;
  children?: ReactNode;
}

export const toastColors: Record<Notification['severity'], { bg: string; fg: string }> = {
  success: { bg: '#1a5c40', fg: '#ffffff' },
  error: { bg: '#b8323f', fg: '#ffffff' },
  warning: { bg: '#fbf0e6', fg: '#b25000' },
  info: { bg: '#2b2622', fg: '#faf8f5' },
};
