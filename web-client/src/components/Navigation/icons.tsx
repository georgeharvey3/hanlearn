import React from 'react';

// The stroke icons of the shell, drawn on a 24 px grid as the canvas draws
// them. Each takes the colour of its text.
const Stroke: React.FC<{ size?: number; width?: number; children: React.ReactNode }> = ({
  size = 24,
  width = 1.8,
  children,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={width}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

interface IconProps {
  size?: number;
}

export const HomeIcon: React.FC<IconProps> = ({ size }) => (
  <Stroke size={size}>
    <path d="M3 10.5L12 3l9 7.5" />
    <path d="M5 9.5V20h5v-6h4v6h5V9.5" />
  </Stroke>
);

export const AddIcon: React.FC<IconProps> = ({ size }) => (
  <Stroke size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </Stroke>
);

export const StudyIcon: React.FC<IconProps> = ({ size }) => (
  <Stroke size={size}>
    <path d="M2 9l10-5 10 5-10 5z" />
    <path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
    <path d="M22 9v6" />
  </Stroke>
);

// A cog with six teeth: the outline of Lucide's "settings" icon (ISC licence).
export const SettingsIcon: React.FC<IconProps> = ({ size }) => (
  <Stroke size={size}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </Stroke>
);

export const ShortcutsIcon: React.FC<IconProps> = ({ size }) => (
  <Stroke size={size}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
  </Stroke>
);

export const LogoutIcon: React.FC<IconProps> = ({ size }) => (
  <Stroke size={size}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </Stroke>
);

export const CollapseIcon: React.FC<IconProps> = ({ size }) => (
  <Stroke size={size}>
    <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
  </Stroke>
);

export const ExpandIcon: React.FC<IconProps> = ({ size }) => (
  <Stroke size={size}>
    <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
  </Stroke>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 18 }) => (
  <Stroke size={size} width={2.4}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Stroke>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 18 }) => (
  <Stroke size={size} width={2.2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Stroke>
);

export const MoreIcon: React.FC<IconProps> = ({ size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="5" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="19" cy="12" r="1.6" />
  </svg>
);
