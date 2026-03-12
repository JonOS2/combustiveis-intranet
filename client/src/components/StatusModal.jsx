import { useState } from "react";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  CircularProgress,
  Divider,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import api from "../api/combustivel";

const formatarData = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const Linha = ({ label, value }) => (
  <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.75 }}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="body2" fontWeight={600}>{value}</Typography>
  </Box>
);

export default function StatusModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const abrirModal = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const res = await api.get("/combustivel/status");
      setStatus(res.data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        size="small"
        variant="text"
        color="inherit"
        startIcon={<InfoOutlinedIcon fontSize="small" />}
        onClick={abrirModal}
        sx={{ opacity: 0.7, "&:hover": { opacity: 1 } }}
      >
        Status
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CheckCircleOutlineIcon color="success" />
          Status do Sistema
        </DialogTitle>

        <DialogContent>
          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={32} />
            </Box>
          )}

          {!loading && !status && (
            <Typography color="error" variant="body2">
              Não foi possível carregar o status.
            </Typography>
          )}

          {!loading && status && (
            <>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                Sincronização
              </Typography>
              <Linha label="Última sincronização" value={formatarData(status.ultimaSincronizacao)} />
              <Linha label="Dados mais recentes" value={formatarData(status.ultimaDataVenda)} />

              <Divider sx={{ my: 1.5 }} />

              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                Banco de Dados
              </Typography>
              <Linha label="Municípios" value={status.totalMunicipios} />
              <Linha label="Postos cadastrados" value={status.totalPostos} />
              <Linha label="Registros de preço" value={status.totalPrecos.toLocaleString("pt-BR")} />
              <Linha label="Postos sem bandeira" value={status.postosSemBandeira} />
            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)} size="small">Fechar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
