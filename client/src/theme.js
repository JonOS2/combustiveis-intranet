import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#294D80",       // azul escuro
      light: "#C4D2DE",      // azul claro
    },
    secondary: {
      main: "#E02F52",       // vermelho
    },
    background: {
      default: "transparent",
    },
  },

  typography: {
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },

  shape: {
    borderRadius: 10,
  },

  components: {
    // Todos os Cards e Papers com borda sutil
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    // Botões sem text-transform (evita LETRAS MAIÚSCULAS por padrão)
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
        },
      },
    },
    // Chips mais compactos
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
  },
});

export default theme;
