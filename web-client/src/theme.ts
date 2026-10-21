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
  success: '#00A86B',
  // The amber of a lapse, and of the "Incorrect tones" feedback line. It is the
  // value MUI gave `warning.main` by default, named here so that a component
  // that reads `colors` and one that reads the palette agree.
  warning: '#ed6c02',
  divider: '#e4d8c6',
  borderStrong: '#d6c8b4', // the outline of a control, where a divider is too faint
} as const;

export const fonts = {
  body: "'Cabin', sans-serif",
  // The Arphic Kai faces that Hanzi Writer's strokes trace, so a printed
  // character matches the animated one. The app serves them
  // (public/fonts/hanzi, built by migration/build-hanzi-font.py); a character
  // outside them falls back to a device Kai face, then Noto Serif SC.
  hanzi:
    "'HanLearn Kai', 'Kaiti SC', 'STKaiti', 'KaiTi', 'Noto Serif SC', 'Noto Serif CJK SC', serif",
} as const;

export const shadows = {
  card: `0 1px 0 ${colors.divider}, 0 12px 32px -18px rgba(70, 50, 30, 0.35)`,
} as const;

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
