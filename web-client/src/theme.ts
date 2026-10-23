import { createTheme } from '@mui/material/styles';

// The "Ink & Paper" look: warm paper grounds, near-black ink, one green for
// actions and one seal red for accents.
export const colors = {
  primary: '#efdece', // beige
  primaryDark: '#1a5c40', // green
  primaryDarkHover: '#145233',
  // A seal red. It is darker than the old vermillion (#df566e) so that white
  // text on it passes 4.5:1.
  primaryLight: '#b8323f',
  primaryLightHover: '#9c2a35',
  charcoal: '#36454f',
  white: '#ffffff',
  paper: '#faf8f5', // the page ground: an off-white
  card: '#ffffff', // a surface that sits on the paper
  text: '#2b2622', // ink
  textSecondary: '#6b6158',
  error: '#cc0000',
  // The brand green, so that "Correct" and the actions agree. It passes 4.5:1
  // on the paper, which the old #00A86B did not.
  success: '#1a5c40',
  // A pale wash of the green: a pressed toggle, a correct answer field.
  successSurface: '#eef4f0',
  // A pale wash of the seal red: the pressed "No" grade, the mic's ring.
  errorSurface: '#fbeced',
  micRing: '#f6e3e4',
  // The amber of a lapse, and of the "Incorrect tones" feedback line. It is the
  // value MUI gave `warning.main` by default, named here so that a component
  // that reads `colors` and one that reads the palette agree.
  warning: '#ed6c02',
  // The amber as text. #ed6c02 is too light for words on the paper.
  warningText: '#b25000',
  warningSurface: '#fbf0e6',
  // Text on a control that is off.
  disabledText: '#c9bfb3',
  placeholder: '#9a8f82',
  // The faint character of a stroke outline, and the guides of the
  // handwriting box.
  outline: '#e6dccf',
  gridLine: '#e8b9bd',
  divider: '#e4d8c6',
  borderStrong: '#d6c8b4', // the outline of a control, where a divider is too faint
  // The pale block a widget shows in place of its content while it loads.
  skeleton: '#efe9e1',
  // A calendar day with no study, and a day ahead.
  blankDay: '#f6f2ec',
} as const;

// The green ink of the five levels, palest for New and darkest for Mastered:
// the level bar of the five skills. Each step is darker, so the levels differ
// in lightness and not in hue alone.
export const levelInk = ['#c5d8cc', '#9dbfad', '#6d9f86', '#3c7a5c', '#1a5c40'] as const;

// The progress chart's line for levels 2 to 5. Mastered takes the seal red so
// the top line stands out from the greens.
export const levelLine: Record<number, string> = {
  2: '#9a8f82',
  3: '#6d9f86',
  4: '#1a5c40',
  5: '#b8323f',
};

export const fonts = {
  body: "'Cabin', sans-serif",
  // The wordmark. Only "HanLearn" is set in it, so index.html loads just those
  // glyphs (Google Fonts' `text=`).
  brand: "'Young Serif', Georgia, serif",
  // The Arphic Kai faces that Hanzi Writer's strokes trace, so a printed
  // character matches the animated one. The app serves them
  // (public/fonts/hanzi, built by migration/build-hanzi-font.py); a character
  // outside them falls back to a device Kai face, then Noto Serif SC.
  hanzi:
    "'HanLearn Kai', 'Kaiti SC', 'STKaiti', 'KaiTi', 'Noto Serif SC', 'Noto Serif CJK SC', serif",
} as const;

export const shadows = {
  card: `0 1px 0 ${colors.divider}, 0 12px 32px -18px rgba(70, 50, 30, 0.35)`,
  dialog: '0 20px 48px -20px rgba(70, 50, 30, 0.45)',
} as const;

// The ink wash behind a dialog or a sheet.
export const scrim = 'rgba(43, 38, 34, 0.42)';

const theme = createTheme({
  palette: {
    primary: {
      main: colors.primary,
      dark: colors.primaryDark,
      light: colors.primaryLight,
    },
    secondary: { main: colors.white },
    error: { main: colors.error },
    success: { main: colors.success },
    warning: { main: colors.warning },
    text: { primary: colors.text, secondary: colors.textSecondary },
    divider: colors.divider,
    background: {
      default: colors.paper,
      paper: colors.card,
    },
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: fonts.body,
    button: { fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*, *::before, *::after': {
          '&:focus-visible': {
            outline: `2px solid ${colors.primaryDark}`,
            outlineOffset: '2px',
          },
        },
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          '&:focus-visible': {
            outline: `2px solid ${colors.primaryDark}`,
            outlineOffset: '2px',
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: colors.card,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.borderStrong },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colors.textSecondary },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: colors.primaryDark },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: colors.card,
          color: colors.text,
          borderRadius: 8,
        },
      },
    },
  },
});

export default theme;
