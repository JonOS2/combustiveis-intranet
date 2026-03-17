import { useState, useEffect, startTransition } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, CircularProgress, Alert, Chip,
} from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import api from "../api/combustivel";

const fmt = (v) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ background: "#fff", border: "1px solid #eee", borderRadius: 1, p: 1.5, fontSize: 13 }}>
      <Typography variant="caption" fontWeight={700} display="block">{label}</Typography>
      {payload.map((p) => (
        <Box key={p.dataKey} sx={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </Box>
      ))}
    </Box>
  );
}

export default function HistoricoModal({ open, onClose, cnpj, tipoCombustivel, nomePostoFallback }) {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!open || !cnpj) return;

    startTransition(() => {
      setLoading(true);
      setErro(null);
      setDados(null);
    });

    api.get(`/combustivel/historico/${cnpj}?tipoCombustivel=${tipoCombustivel}`)
      .then((res) => startTransition(() => setDados(res.data)))
      .catch(() => startTransition(() => setErro("Não foi possível carregar o histórico.")))
      .finally(() => startTransition(() => setLoading(false)));
  }, [open, cnpj, tipoCombustivel]);

  const nomePosto = dados?.posto?.nome || nomePostoFallback || "Posto";

  // Calcula média para linha de referência
  const media = dados?.historico?.length
    ? dados.historico.reduce((acc, d) => acc + (d.declarado ?? 0), 0) / dados.historico.length
    : null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1 }}>
        <HistoryIcon color="primary" />
        <Box>
          <Typography fontWeight={700} lineHeight={1.2}>{nomePosto}</Typography>
          {dados?.posto?.bairro && (
            <Typography variant="caption" color="text.secondary">{dados.posto.bairro}</Typography>
          )}
        </Box>
        {dados?.posto?.bandeira && (
          <Chip label={dados.posto.bandeira} size="small" variant="outlined" color="secondary" sx={{ ml: "auto" }} />
        )}
      </DialogTitle>

      <DialogContent>
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {erro && <Alert severity="error">{erro}</Alert>}

        {!loading && dados && dados.historico.length === 0 && (
          <Alert severity="info">Sem histórico de preços nos últimos 30 dias.</Alert>
        )}

        {!loading && dados && dados.historico.length > 0 && (
          <>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Evolução dos últimos 30 dias — linha tracejada = média do período ({fmt(media)})
            </Typography>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dados.historico} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `R$${v.toFixed(2)}`}
                  domain={["auto", "auto"]}
                />
                <Tooltip content={<CustomTooltip />} />
                {media && (
                  <ReferenceLine
                    y={media}
                    stroke="#9e9e9e"
                    strokeDasharray="4 2"
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="declarado"
                  name="Declarado"
                  stroke="#294D80"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="venda"
                  name="Venda"
                  stroke="#C4D2DE"
                  strokeWidth={1.5}
                  dot={false}
                  strokeDasharray="4 2"
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Mini resumo */}
            <Box sx={{ display: "flex", gap: 2, mt: 1.5, flexWrap: "wrap" }}>
              {[
                { label: "Mínimo", value: Math.min(...dados.historico.map(d => d.declarado ?? Infinity)) },
                { label: "Máximo", value: Math.max(...dados.historico.map(d => d.declarado ?? -Infinity)) },
                { label: "Média", value: media },
                { label: "Registros", value: `${dados.historico.length} dias` },
              ].map(({ label, value }) => (
                <Box key={label} sx={{ textAlign: "center", minWidth: 70 }}>
                  <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {typeof value === "number" ? fmt(value) : value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} size="small">Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}
