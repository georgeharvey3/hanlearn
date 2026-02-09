import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: { main: '#AA381E' },
    secondary: { main: '#E6E0AE' },
    background: {
      default: 'transparent',
      paper: '#E6E0AE',
    },
  },
  typography: {
    fontFamily: "'Cabin', sans-serif",
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgb(46, 66, 66)',
          color: '#E6E0AE',
        },
      },
    },
  },
});

export default theme;
