import { createTheme } from "@mui/material/styles";

// Google AI Studio-inspired theme with premium aesthetics
const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1a73e8", // Google Blue
      light: "#4285f4",
      dark: "#1557b0",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#5f6368", // Google Gray
      light: "#80868b",
      dark: "#3c4043",
      contrastText: "#ffffff",
    },
    background: {
      default: "#f8f9fa", // Light gray background
      paper: "#ffffff",
    },
    text: {
      primary: "#202124", // Google Dark Gray
      secondary: "#5f6368", // Google Medium Gray
    },
    success: {
      main: "#1e8e3e", // Google Green
      light: "#34a853",
      dark: "#137333",
    },
    warning: {
      main: "#f9ab00", // Google Yellow
      light: "#fbbc04",
      dark: "#ea8600",
    },
    error: {
      main: "#d93025", // Google Red
      light: "#ea4335",
      dark: "#c5221f",
    },
    info: {
      main: "#1a73e8",
      light: "#4285f4",
      dark: "#1557b0",
    },
    divider: "#dadce0",
  },
  typography: {
    fontFamily:
      '"DM Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
    h1: {
      fontSize: "3rem",
      fontWeight: 700,
      letterSpacing: "-0.03em",
      lineHeight: 1.2,
      fontFamily: '"DM Sans", sans-serif',
    },
    h2: {
      fontSize: "2.5rem",
      fontWeight: 700,
      letterSpacing: "-0.02em",
      lineHeight: 1.25,
      fontFamily: '"DM Sans", sans-serif',
    },
    h3: {
      fontSize: "2rem",
      fontWeight: 600,
      letterSpacing: "-0.01em",
      lineHeight: 1.3,
      fontFamily: '"DM Sans", sans-serif',
    },
    h4: {
      fontSize: "1.5rem",
      fontWeight: 600,
      letterSpacing: "-0.01em",
      lineHeight: 1.35,
      fontFamily: '"DM Sans", sans-serif',
    },
    h5: {
      fontSize: "1.25rem",
      fontWeight: 600,
      lineHeight: 1.4,
      fontFamily: '"DM Sans", sans-serif',
    },
    h6: {
      fontSize: "1.125rem",
      fontWeight: 600,
      lineHeight: 1.4,
      fontFamily: '"DM Sans", sans-serif',
    },
    body1: {
      fontSize: "1rem",
      lineHeight: 1.6,
      letterSpacing: "0.01em",
    },
    body2: {
      fontSize: "0.875rem",
      lineHeight: 1.5,
      letterSpacing: "0.01em",
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
      fontSize: "0.9375rem",
      letterSpacing: "0.02em",
    },
    caption: {
      fontSize: "0.75rem",
      lineHeight: 1.4,
      letterSpacing: "0.03em",
    },
  },
  shape: {
    borderRadius: 12,
  },
  shadows: [
    "none",
    "0px 1px 2px rgba(60, 64, 67, 0.1), 0px 1px 3px rgba(60, 64, 67, 0.15)",
    "0px 1px 2px rgba(60, 64, 67, 0.15), 0px 2px 6px rgba(60, 64, 67, 0.15)",
    "0px 4px 8px rgba(60, 64, 67, 0.15), 0px 1px 3px rgba(60, 64, 67, 0.3)",
    "0px 6px 10px rgba(60, 64, 67, 0.15), 0px 2px 3px rgba(60, 64, 67, 0.3)",
    "0px 8px 12px rgba(60, 64, 67, 0.15), 0px 4px 4px rgba(60, 64, 67, 0.3)",
    "0px 12px 16px rgba(60, 64, 67, 0.15), 0px 4px 6px rgba(60, 64, 67, 0.3)",
    "0px 16px 20px rgba(60, 64, 67, 0.15), 0px 6px 8px rgba(60, 64, 67, 0.3)",
    "0px 20px 24px rgba(60, 64, 67, 0.15), 0px 8px 10px rgba(60, 64, 67, 0.3)",
    "0px 24px 32px rgba(60, 64, 67, 0.15), 0px 12px 16px rgba(60, 64, 67, 0.3)",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: "thin",
          scrollbarColor: "#dadce0 transparent",
          "&::-webkit-scrollbar": {
            width: "8px",
            height: "8px",
          },
          "&::-webkit-scrollbar-track": {
            background: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "#dadce0",
            borderRadius: "8px",
            "&:hover": {
              backgroundColor: "#bdc1c6",
            },
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: "24px",
          padding: "10px 24px",
          fontWeight: 600,
          fontSize: "0.9375rem",
          boxShadow: "none",
          textTransform: "none",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          "&:hover": {
            boxShadow:
              "0px 1px 2px rgba(60, 64, 67, 0.3), 0px 1px 3px rgba(60, 64, 67, 0.15)",
            transform: "translateY(-1px)",
          },
          "&:active": {
            transform: "translateY(0)",
          },
        },
        contained: {
          boxShadow:
            "0px 1px 2px rgba(26, 115, 232, 0.3), 0px 1px 3px rgba(26, 115, 232, 0.15)",
          "&:hover": {
            boxShadow:
              "0px 2px 4px rgba(26, 115, 232, 0.3), 0px 2px 6px rgba(26, 115, 232, 0.15)",
          },
        },
        containedPrimary: {
          background: "linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)",
          "&:hover": {
            background: "linear-gradient(135deg, #1557b0 0%, #1a73e8 100%)",
          },
        },
        outlined: {
          borderWidth: "1.5px",
          "&:hover": {
            borderWidth: "1.5px",
            backgroundColor: "rgba(26, 115, 232, 0.04)",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
        elevation0: {
          boxShadow: "none",
        },
        elevation1: {
          boxShadow:
            "0px 1px 2px rgba(60, 64, 67, 0.1), 0px 1px 3px rgba(60, 64, 67, 0.15)",
        },
        elevation2: {
          boxShadow:
            "0px 1px 2px rgba(60, 64, 67, 0.15), 0px 2px 6px rgba(60, 64, 67, 0.15)",
        },
        elevation3: {
          boxShadow:
            "0px 4px 8px rgba(60, 64, 67, 0.15), 0px 1px 3px rgba(60, 64, 67, 0.3)",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: "8px",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            "& fieldset": {
              borderColor: "#dadce0",
              borderWidth: "1.5px",
            },
            "&:hover fieldset": {
              borderColor: "#bdc1c6",
            },
            "&.Mui-focused fieldset": {
              borderColor: "#1a73e8",
              borderWidth: "2px",
            },
            "&.Mui-focused": {
              boxShadow: "0 0 0 3px rgba(26, 115, 232, 0.1)",
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          borderRadius: "16px",
        },
        outlined: {
          borderWidth: "1.5px",
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          "&:hover": {
            backgroundColor: "rgba(26, 115, 232, 0.08)",
          },
        },
      },
    },
  },
});

export default theme;
