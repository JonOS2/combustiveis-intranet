import { useState } from "react";
import { Box, Button, CircularProgress, Snackbar, Alert } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import api from "../api/combustivel";

/* =========================
   COMPONENTE
========================= */
export default function ExportBar({ filtros, pagina }) {
  const [loadingPagina, setLoadingPagina] = useState(false);
  const [loadingTudo, setLoadingTudo] = useState(false);
  const [erro, setErro] = useState(null);

  const exportar = async (modo) => {
    const setLoading = modo === "pagina" ? setLoadingPagina : setLoadingTudo;

    if (
      modo === "tudo" &&
      !window.confirm("Isso pode demorar alguns segundos. Deseja continuar?")
    ) {
      return;
    }

    setLoading(true);
    setErro(null);

    try {
      const response = await api.post(
        "/combustivel/excel",
        { ...filtros, pagina, modo },
        { responseType: "blob" }
      );

      // Extrai nome do arquivo do header Content-Disposition
      const disposition = response.headers["content-disposition"];
      let nomeArquivo = "combustiveis.xlsx";
      if (disposition) {
        const match = disposition.match(/filename="(.+)"/);
        if (match?.[1]) nomeArquivo = match[1];
      }

      // Dispara o download no browser
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
      setLoading(false);
    }
  };

  return (
    <>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
        <Button
          variant="outlined"
          color="success"
          size="small"
          startIcon={
            loadingPagina
              ? <CircularProgress size={14} color="inherit" />
              : <DownloadIcon />
          }
          disabled={loadingPagina || loadingTudo}
          onClick={() => exportar("pagina")}
        >
          Exportar página atual
        </Button>

        <Button
          variant="outlined"
          color="success"
          size="small"
          startIcon={
            loadingTudo
              ? <CircularProgress size={14} color="inherit" />
              : <DownloadIcon />
          }
          disabled={loadingPagina || loadingTudo}
          onClick={() => exportar("tudo")}
        >
          Exportar todo município
        </Button>
      </Box>

      {/* FEEDBACK DE ERRO */}
      <Snackbar
        open={!!erro}
        autoHideDuration={4000}
        onClose={() => setErro(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setErro(null)}>
          {erro}
        </Alert>
      </Snackbar>
    </>
  );
}
