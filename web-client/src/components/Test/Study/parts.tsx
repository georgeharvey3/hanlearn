/**
 * The parts every study screen is built from: the card, the buttons, the
 * microphone and the status line. The vocabulary test and both sentence
 * stages read them, so that the three look like one session.
 */
import React from 'react';
import { Box, ButtonBase, CircularProgress, SxProps, Theme } from '@mui/material';
import MicNoneOutlinedIcon from '@mui/icons-material/MicNoneOutlined';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';

import { copy } from '../../../copy';
import { colors, fonts, shadows } from '../../../theme';

const font = { fontFamily: fonts.body } as const;

type ButtonVariant = 'primary' | 'ghost';

interface StudyButtonProps {
  variant?: ButtonVariant;
  /** A toggle that is on: a hint that shows, a pinyin line that shows. */
  pressed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  id?: string;
  'aria-label'?: string;
  'aria-expanded'?: boolean;
  sx?: SxProps<Theme>;
  children: React.ReactNode;
}

/** A full-width button of the study screens: Check, Continue, Show hint. */
export const StudyButton: React.FC<StudyButtonProps> = ({
  variant = 'ghost',
  pressed,
  disabled,
  onClick,
  sx,
  children,
  ...rest
}) => {
  const primary = variant === 'primary';
  return (
    <ButtonBase
      {...rest}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={pressed}
      sx={[
        {
          ...font,
          // Full width in a column; buttons in a row share it equally.
          width: '100%',
          flexShrink: 1,
          height: primary ? 52 : 48,
          borderRadius: 1,
          fontSize: primary ? 17 : 16,
          fontWeight: 600,
          gap: 1,
          transition: 'background-color 150ms ease, border-color 150ms ease',
        },
        primary
          ? {
              bgcolor: disabled ? colors.divider : colors.primaryDark,
              color: colors.white,
              '&:hover': { bgcolor: colors.primaryDarkHover },
            }
          : pressed
            ? {
                border: `1px solid ${colors.primaryDark}`,
                bgcolor: colors.successSurface,
                color: colors.primaryDark,
              }
            : {
                border: `1px solid ${disabled ? colors.divider : colors.borderStrong}`,
                bgcolor: 'transparent',
                color: disabled ? colors.disabledText : colors.text,
                '&:hover': { borderColor: colors.textSecondary },
              },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </ButtonBase>
  );
};

/** A small rounded toggle on the card: Show pinyin, Show character. */
export const PillToggle: React.FC<{
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ pressed, onClick, children }) => (
  <ButtonBase
    onClick={onClick}
    aria-pressed={pressed}
    sx={{
      ...font,
      height: 36,
      px: 1.75,
      borderRadius: '18px',
      fontSize: 14,
      fontWeight: pressed ? 600 : 400,
      border: `1px solid ${pressed ? colors.primaryDark : colors.borderStrong}`,
      bgcolor: pressed ? colors.successSurface : colors.card,
      color: pressed ? colors.primaryDark : colors.text,
    }}
  >
    {children}
  </ButtonBase>
);

/** A borderless green text button: Show components. */
export const TextButton: React.FC<{
  onClick: () => void;
  icon?: React.ReactNode;
  'aria-expanded'?: boolean;
  children: React.ReactNode;
}> = ({ onClick, icon, children, ...rest }) => (
  <ButtonBase
    {...rest}
    onClick={onClick}
    sx={{
      ...font,
      alignSelf: 'center',
      mt: 1,
      height: 44,
      px: 1.75,
      gap: 0.75,
      borderRadius: 1,
      fontSize: 15,
      fontWeight: 600,
      color: colors.primaryDark,
    }}
  >
    {icon}
    {children}
  </ButtonBase>
);

interface MicButtonProps {
  listening: boolean;
  disabled?: boolean;
  onClick: () => void;
  sx?: SxProps<Theme>;
}

/**
 * The microphone: the main way to answer, so it is the largest control and
 * has a row of its own. A graded question keeps it in place, switched off, so
 * that nothing below it moves when the answer shows.
 */
export const MicButton: React.FC<MicButtonProps> = ({ listening, disabled, onClick, sx }) => (
  <ButtonBase
    onClick={onClick}
    disabled={disabled}
    aria-label={listening ? copy.test.stopRecording : copy.test.recordSpeech}
    aria-pressed={listening}
    sx={[
      {
        alignSelf: 'center',
        flex: 'none',
        width: 88,
        height: 88,
        borderRadius: '44px',
        color: colors.white,
        bgcolor: disabled ? colors.divider : colors.primaryLight,
        boxShadow: disabled
          ? 'none'
          : listening
            ? '0 0 0 10px rgba(184,50,63,0.22), 0 10px 24px -12px rgba(184,50,63,0.6)'
            : `0 0 0 6px ${colors.micRing}, 0 10px 24px -12px rgba(184,50,63,0.6)`,
        transition: 'box-shadow 200ms ease',
        '&:hover': { bgcolor: disabled ? colors.divider : colors.primaryLightHover },
      },
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
  >
    {listening ? (
      <StopRoundedIcon sx={{ fontSize: 36 }} />
    ) : (
      <MicNoneOutlinedIcon sx={{ fontSize: 36 }} />
    )}
  </ButtonBase>
);

/** The round green button that plays a word or a sentence. */
export const PlayButton: React.FC<{
  size: number;
  loading: boolean;
  onClick: () => void;
  label?: string;
}> = ({ size, loading, onClick, label = copy.test.playPronunciation }) => (
  <ButtonBase
    onClick={onClick}
    disabled={loading}
    aria-label={loading ? copy.test.loadingAudio : label}
    sx={{
      flex: 'none',
      width: size,
      height: size,
      borderRadius: `${size / 2}px`,
      bgcolor: loading ? colors.successSurface : colors.primaryDark,
      border: loading ? `2px solid ${colors.primaryDark}` : 'none',
      color: loading ? colors.primaryDark : colors.white,
      boxShadow: loading || size < 56 ? 'none' : '0 8px 20px -10px rgba(26,92,64,0.6)',
      '&:hover': { bgcolor: loading ? colors.successSurface : colors.primaryDarkHover },
    }}
  >
    {loading ? (
      <CircularProgress size={size / 3} color="inherit" />
    ) : (
      <VolumeUpRoundedIcon sx={{ fontSize: size * 0.42 }} />
    )}
  </ButtonBase>
);

/** The size of the card's text, so that it fits the card. */
export type CardSize = 'large' | 'medium' | 'small';

interface StudyCardProps {
  /** The fixed height of the card, in pixels, or undefined to fit the content. */
  height?: number;
  /** The lapse marker: the question can no longer count as known. */
  lapse?: boolean;
  /** Whether the seal sits in the corner. A card with a full reveal drops it. */
  seal?: boolean;
  /** A control pinned to a top corner, such as the pronunciation button. */
  corner?: React.ReactNode;
  sx?: SxProps<Theme>;
  children: React.ReactNode;
}

/** The white card the question sits on. */
export const StudyCard: React.FC<StudyCardProps> = ({
  height,
  lapse,
  seal = true,
  corner,
  sx,
  children,
}) => (
  <Box
    sx={[
      {
        position: 'relative',
        minHeight: height,
        boxSizing: 'border-box',
        p: 2.5,
        bgcolor: colors.card,
        border: `1px solid ${colors.divider}`,
        borderRadius: 1,
        boxShadow: shadows.card,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        textAlign: 'center',
        color: colors.text,
      },
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
  >
    {children}
    {corner}
    {lapse && (
      <Box
        role="img"
        data-testid="lapse-marker"
        aria-label={copy.test.lapseMarker}
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          width: 10,
          height: 10,
          borderRadius: '5px',
          bgcolor: colors.warning,
        }}
      />
    )}
    {seal && (
      <Box
        aria-hidden="true"
        sx={{
          position: 'absolute',
          right: 14,
          bottom: 14,
          width: 26,
          height: 26,
          boxSizing: 'border-box',
          border: `2px solid ${colors.primaryLight}`,
          borderRadius: '3px',
          color: colors.primaryLight,
          fontFamily: fonts.hanzi,
          fontSize: 14,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {copy.test.seal}
      </Box>
    )}
  </Box>
);

/** The thin rule between a question and its revealed answer. */
export const CardRule: React.FC = () => (
  <Box sx={{ width: '60%', height: '1px', bgcolor: colors.divider, my: 0.5 }} />
);

/** The line above the card: "What is the meaning for". */
export const Prompt: React.FC<{ sx?: SxProps<Theme>; children: React.ReactNode }> = ({
  sx,
  children,
}) => (
  <Box
    id="q-phrase-box"
    sx={[
      {
        mt: 3.5,
        mb: 1.75,
        textAlign: 'center',
        fontSize: 15,
        color: colors.textSecondary,
        '& em': { fontStyle: 'normal', color: colors.primaryLight, fontWeight: 600 },
      },
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
  >
    {children}
  </Box>
);

/** A small caps label over a list or a field: CHARACTERS, YOUR ANSWER. */
export const Overline: React.FC<{
  component?: React.ElementType;
  htmlFor?: string;
  sx?: SxProps<Theme>;
  children: React.ReactNode;
}> = ({ component = 'div', htmlFor, sx, children }) => (
  <Box
    component={component}
    htmlFor={htmlFor}
    sx={[
      {
        fontSize: 12,
        color: colors.textSecondary,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        textAlign: 'left',
      },
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
  >
    {children}
  </Box>
);

export type StatusTone = 'success' | 'warning' | 'error' | 'neutral';

const statusColor: Record<StatusTone, string> = {
  success: colors.success,
  warning: colors.warningText,
  error: colors.primaryLight,
  neutral: colors.textSecondary,
};

/**
 * The line under the card that says what happened. It keeps its height when
 * empty, so that the controls below it do not jump.
 */
export const StatusLine: React.FC<{
  tone: StatusTone;
  icon?: 'check' | 'retry' | 'dot';
  children?: React.ReactNode;
}> = ({ tone, icon, children }) => (
  <Box
    role="status"
    aria-live="polite"
    sx={{
      height: 28,
      mt: 1.75,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1,
      fontSize: tone === 'neutral' ? 15 : 16,
      fontWeight: tone === 'neutral' ? 500 : 600,
      color: statusColor[tone],
    }}
  >
    {children && icon === 'check' && <CheckRoundedIcon sx={{ fontSize: 18 }} />}
    {children && icon === 'retry' && <ReplayRoundedIcon sx={{ fontSize: 18 }} />}
    {children && icon === 'dot' && (
      <Box sx={{ width: 8, height: 8, borderRadius: '4px', bgcolor: colors.primaryLight }} />
    )}
    {children}
  </Box>
);

/** A spinner sized for a button label. */
export const ButtonSpinner: React.FC<{ label?: string }> = ({ label }) => (
  <CircularProgress size={16} color="inherit" aria-label={label} />
);

/** The props a hanzi line shares: the Kai face, at a size. */
export const hanziSx = (fontSize: number, extra?: object) => ({
  fontFamily: fonts.hanzi,
  fontSize,
  lineHeight: 1,
  fontWeight: 400,
  ...extra,
});

/**
 * Hanzi are the focus of a question, so they are as large as the card allows:
 * a four-character chengyu must still fit on one line of a phone-width card.
 */
export function hanziSize(text: string, scale: CardSize = 'large'): number {
  const base = text.length <= 2 ? 88 : text.length === 3 ? 72 : text.length === 4 ? 56 : 40;
  if (scale === 'medium') return Math.round(base * 0.82);
  if (scale === 'small') return Math.round(base * 0.64);
  return base;
}
