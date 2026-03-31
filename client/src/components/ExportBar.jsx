import { useState } from "react";
import { Box, Button, CircularProgress, Snackbar, Alert } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import api from "../api/combustivel";

export default function ExportBar({ filtros, pagina }) {
  const [loading, setLoading] = useState({ pagina: false, tudo: false, estado: false });
  const [erro, setErro] = useState(null);

  const exportar = async (modo) => {
    if (
      (modo === "tudo" || modo === "estado") &&
      !window.confirm(
        modo === "estado"
          ? "Isso vai exportar todos os municípios de Alagoas e pode demorar alguns segundos. Deseja continuar?"
          : "Isso pode demorar alguns segundos. Deseja continuar?"
      )
    ) return;

    setLoading((prev) => ({ ...prev, [modo]: true }));
    setErro(null);

    try {
      const response = await api.post(
        "/combustivel/excel",
        { ...filtros, pagina, modo },
        { responseType: "blob" }
      );

      const disposition = response.headers["content-disposition"];
      let nomeArquivo = "combustiveis.xlsx";
      if (disposition) {
        const match = disposition.match(/filename="(.+)"/);
        if (match?.[1]) nomeArquivo = match[1];
      }

      const url = window.URL.createObjectURL(
        new Blob([response.data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
      setErro("Erro ao exportar. Tente novamente.");
    } finally {
      setLoading((prev) => ({ ...prev, [modo]: false }));
    }
  };

  const anyLoading = Object.values(loading).some(Boolean);

  return (
    <>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>

        {/* Página atual — contained verde, texto branco */}
        <Button
          variant="contained"
          size="small"
          startIcon={loading.pagina ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon />}
          disabled={anyLoading}
          onClick={() => exportar("pagina")}
          sx={{
            backgroundColor: "#43a047",
            color: "#fff",
            "&:hover": { backgroundColor: "#2e7d32" },
            "&:disabled": { backgroundColor: "#a5d6a7", color: "#fff" },
          }}
        >
          Exportar página atual
        </Button>

        {/* Todo município — contained verde, texto branco */}
        <Button
          variant="contained"
          size="small"
          startIcon={loading.tudo ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon />}
          disabled={anyLoading}
          onClick={() => exportar("tudo")}
          sx={{
            backgroundColor: "#43a047",
            color: "#fff",
            "&:hover": { backgroundColor: "#2e7d32" },
            "&:disabled": { backgroundColor: "#a5d6a7", color: "#fff" },
          }}
        >
          Exportar todo município
        </Button>

        {/* Estado inteiro — contained azul, texto branco */}
        <Button
          variant="contained"
          size="small"
          startIcon={loading.estado ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon />}
          disabled={anyLoading}
          onClick={() => exportar("estado")}
          sx={{
            backgroundColor: "#1976d2",
            color: "#fff",
            "&:hover": { backgroundColor: "#1565c0" },
            "&:disabled": { backgroundColor: "#90caf9", color: "#fff" },
          }}
        >
          Exportar estado inteiro
        </Button>
      </Box>

      <Snackbar
        open={!!erro}
        autoHideDuration={4000}
        onClose={() => setErro(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setErro(null)}>{erro}</Alert>
      </Snackbar>
    </>
  );
}
