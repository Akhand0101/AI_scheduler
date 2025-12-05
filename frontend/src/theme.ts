import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#0F766E", // Teal 700
      light: "#2DD4BF", // Teal 400
      dark: "#0F5132",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#64748B", // Slate 500
      light: "#94A3B8",
      dark: "#334155",
      contrastText: "#ffffff",
    },
    background: {
      default: "#F8FAFC", // Slate 50
      paper: "#ffffff",
    },
    text: {
      primary: "#1E293B", // Slate 800
      secondary: "#475569", // Slate 600
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: "2.5rem",
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    h2: {
      fontSize: "2rem",
      fontWeight: 600,
      letterSpacing: "-0.01em",
    },
    body1: {
      fontSize: "1rem",
      lineHeight: 1.6,
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: "8px",
          padding: "8px 16px",
          boxShadow: "none",
          "&:hover": {
            boxShadow: "0px 2px 4px rgba(0,0,0,0.1)",
          },
        },
        containedPrimary: {
          background: "linear-gradient(45deg, #0F766E 30%, #2DD4BF 90%)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: "0px 4px 20px rgba(0,0,0,0.05)",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: "12px",
          },
        },
      },
    },
  },
});

export default theme;
