import { createTheme } from '@mui/material/styles';

export const colors = {
  primary: '#efdece', // beige
  primaryDark: '#1a5c40', // green
  primaryLight: '#df566e', // vermillion
  charcoal: '#36454f',
  white: '#ffffff',
  text: '#2d2d2d',
  error: '#cc0000',
  success: '#00A86B',
  // The amber of a lapse, and of the "Incorrect tones" feedback line. It is the
  // value MUI gave `warning.main` by default, named here so that a component
  // that reads `colors` and one that reads the palette agree.
  warning: '#ed6c02',
  divider: '#e0e0e0',
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
    text: { primary: colors.text },
    divider: colors.divider,
    background: {
      default: colors.white,
      paper: colors.white,
    },
  },
  typography: {
    fontFamily: "'Cabin', sans-serif",
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
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: colors.white,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: colors.white,
          color: colors.text,
          borderRadius: 12,
        },
      },
    },
  },
});

export default theme;
