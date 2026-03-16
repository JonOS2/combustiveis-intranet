import { useState, useEffect, useCallback } from "react";
import {
  Box, Grid, Typography, Paper, Chip, CircularProgress, Alert,
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  Cell, ReferenceLine,
} from "recharts";
import api from "../api/combustivel";

const fmt = (v) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const fmtPct = (v) =>
  v != null ? `${v > 0 ? "+" : ""}${v.toFixed(2)}%` : "—";

const CORES = ["#294D80", "#E02F52", "#4CAF50", "#FF9800", "#9C27B0", "#00BCD4", "#C4D2DE"];

// Cor baseada no índice etanol/gasolina
const corIndice = (indice) => {
  if (indice <= 70) return "#2e7d32"; // verde — vale etanol
  if (indice <= 75) return "#f57c00"; // laranja — zona cinza
  return "#c62828";                   // vermelho — não vale
};

function MetricCard({ titulo, valor, subtitulo, tendencia, chip }) {
  const icone =
    tendencia > 0 ? <TrendingUpIcon fontSize="small" sx={{ color: "error.main" }} />
    : tendencia < 0 ? <TrendingDownIcon fontSize="small" sx={{ color: "success.main" }} />
    : <TrendingFlatIcon fontSize="small" sx={{ color: "text.secondary" }} />;

  return (
    <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "grey.200", borderRadius: 3, height: "100%" }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
        {titulo}
      </Typography>
      <Typography variant="h4" fontWeight={700} sx={{ my: 0.5, color: "primary.main" }}>
        {valor}
      </Typography>
      {subtitulo && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {tendencia != null && icone}
          <Typography variant="body2" color="text.secondary">{subtitulo}</Typography>
        </Box>
      )}
      {chip && <Chip label={chip} size="small" sx={{ mt: 1 }} />}
    </Paper>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <Paper elevation={3} sx={{ p: 1.5, fontSize: 13 }}>
      <Typography variant="caption" fontWeight={700}>{label}</Typography>
      {payload.map((p) => (
        <Box key={p.dataKey} sx={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </Box>
      ))}
    </Paper>
  );
}

function TooltipIndice({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <Paper elevation={3} sx={{ p: 1.5, fontSize: 13, minWidth: 180 }}>
      <Typography variant="caption" fontWeight={700} display="block">{d.posto}</Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>{d.bairro}</Typography>
      <Box>Gasolina: {fmt(d.gasolina)}</Box>
      <Box>Etanol: {fmt(d.etanol)}</Box>
      <Box fontWeight={700} sx={{ color: corIndice(d.indice), mt: 0.5 }}>
        Índice: {d.indice}% {d.indice <= 70 ? "✓ vale etanol" : d.indice <= 75 ? "⚠ zona cinza" : "✗ não vale"}
      </Box>
    </Paper>
  );
}

export default function Dashboard({ tipoCombustivel = 1, codigoIBGE = 2704302 }) {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const buscar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await api.get(`/dashboard?tipoCombustivel=${tipoCombustivel}&codigoIBGE=${codigoIBGE}`);
      setDados(res.data);
    } catch {
      setErro("Erro ao carregar dados do dashboard.");
    } finally {
      setLoading(false);
    }
  }, [tipoCombustivel, codigoIBGE]);

  useEffect(() => { buscar(); }, [buscar]);

  const m = dados?.metricas;
  const temIndice = dados?.indiceEtanol?.length > 0;

  return (
    <Box>
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      )}
      {erro && <Alert severity="error">{erro}</Alert>}

      {!loading && dados && (
        <>
          {/* CARDS MÉTRICAS */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { titulo: "Menor Preço", valor: fmt(m.menorPreco), subtitulo: "preço mais baixo hoje" },
              {
                titulo: "Média Atual", valor: fmt(m.mediaAtual),
                subtitulo: m.variacaoMedia != null ? `${fmtPct(m.variacaoMedia)} vs semana anterior` : "sem dados anteriores",
                tendencia: m.variacaoMedia,
              },
              { titulo: "Maior Preço", valor: fmt(m.maiorPreco), subtitulo: "preço mais alto hoje" },
              {
                titulo: "Postos Acima da Média", valor: `${m.percentualAcimaMedia.toFixed(0)}%`,
                subtitulo: `${m.postosAcimaMedia} de ${m.totalPostos} postos`,
                chip: m.percentualAcimaMedia > 50 ? "Maioria cara" : "Maioria em conta",
              },
            ].map((card) => (
              <Grid item xs={6} sm={3} key={card.titulo}>
                <MetricCard {...card} />
              </Grid>
            ))}
          </Grid>

          {/* EVOLUÇÃO 30 DIAS */}
          <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "grey.200", borderRadius: 3, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Evolução da Média — últimos 30 dias
            </Typography>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dados.historico} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v.toFixed(2)}`} domain={["auto", "auto"]} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="media" name="Média" stroke="#294D80" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="minimo" name="Mínimo" stroke="#4CAF50" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="maximo" name="Máximo" stroke="#E02F52" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </Paper>

          {/* 3 COLUNAS */}
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2, mb: 3 }}>

            {/* ÍNDICE ETANOL/GASOLINA */}
            <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "grey.200", borderRadius: 3 }}>
              <Typography variant="subtitle1" fontWeight={700}>Índice Etanol / Gasolina</Typography>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1 }}>
                <Typography variant="caption" sx={{ color: "#2e7d32", fontWeight: 600 }}>■ ≤70% vale</Typography>
                <Typography variant="caption" sx={{ color: "#f57c00", fontWeight: 600 }}>■ 70-75% cinza</Typography>
                <Typography variant="caption" sx={{ color: "#c62828", fontWeight: 600 }}>■ &gt;75% não vale</Typography>
              </Box>
              {!temIndice ? (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 260 }}>
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    Sem dados suficientes.<br />Requer gasolina e etanol no mesmo município.
                  </Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dados.indiceEtanol} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[50, 90]} />
                    <YAxis type="category" dataKey="posto" tick={{ fontSize: 9 }} width={110}
                      tickFormatter={(v) => v.length > 15 ? v.slice(0, 12) + "…" : v} />
                    <RechartsTooltip content={<TooltipIndice />} />
                    <ReferenceLine x={70} stroke="#2e7d32" strokeDasharray="4 2" label={{ value: "70%", position: "top", fontSize: 10, fill: "#2e7d32" }} />
                    <ReferenceLine x={75} stroke="#c62828" strokeDasharray="4 2" label={{ value: "75%", position: "top", fontSize: 10, fill: "#c62828" }} />
                    <Bar dataKey="indice" name="Índice" radius={[0, 4, 4, 0]}>
                      {dados.indiceEtanol.map((entry, i) => (
                        <Cell key={i} fill={corIndice(entry.indice)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Paper>

            {/* MÉDIA POR BANDEIRA */}
            <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "grey.200", borderRadius: 3 }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Média por Bandeira</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dados.porBandeira} margin={{ top: 8, right: 8, bottom: 60, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="bandeira" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${v.toFixed(2)}`} domain={["auto", "auto"]} />
                  <RechartsTooltip formatter={(v, n, p) => [fmt(v), `${p.payload.total} postos`]} />
                  <Bar dataKey="media" name="Média" radius={[4, 4, 0, 0]}>
                    {dados.porBandeira.map((_, i) => (
                      <Cell key={i} fill={CORES[i % CORES.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Paper>

            {/* MUNICÍPIOS MAIS BARATOS */}
            <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "grey.200", borderRadius: 3 }}>
              <Typography variant="subtitle1" fontWeight={700}>10 Municípios Mais Baratos</Typography>
              <Typography variant="caption" color="text.secondary">média dos últimos 7 dias</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dados.porMunicipio} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${v.toFixed(2)}`} domain={["auto", "auto"]} />
                  <YAxis type="category" dataKey="municipio" tick={{ fontSize: 9 }} width={110}
                    tickFormatter={(v) => v.length > 15 ? v.slice(0, 12) + "…" : v} />
                  <RechartsTooltip formatter={(v, n, p) => [fmt(v), `${p.payload.postos} postos`]} />
                  <Bar dataKey="media" name="Média" radius={[0, 4, 4, 0]}>
                    {dados.porMunicipio.map((_, i) => (
                      <Cell key={i} fill={CORES[i % CORES.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Box>

          {/* POSTOS POR BAIRRO */}
          <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "grey.200", borderRadius: 3, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Postos por Bairro — concentração e preço médio
            </Typography>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dados.porBairro} margin={{ top: 5, right: 20, bottom: 60, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="bairro" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0}
                  tickFormatter={(v) => v.length > 12 ? v.slice(0, 12) + "…" : v} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `R$${v.toFixed(2)}`} domain={["auto", "auto"]} />
                <RechartsTooltip
                  formatter={(value, name) =>
                    name === "Postos" ? [`${value} postos`, name] : [fmt(value), name]
                  }
                />
                <Legend />
                <Bar yAxisId="left" dataKey="postos" name="Postos" fill="#294D80" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="media" name="Média preço" fill="#C4D2DE" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>

          {/* DISTRIBUIÇÃO */}
          <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "grey.200", borderRadius: 3, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Distribuição de Preços — quantos postos por faixa
            </Typography>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dados.histograma} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="faixa" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <RechartsTooltip formatter={(v) => [`${v} postos`, "Quantidade"]} />
                <Bar dataKey="count" name="Postos" fill="#294D80" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>

          {/* TABELA TOP 10 */}
          <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "grey.200", borderRadius: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Detalhes — 10 menores preços
            </Typography>
            <Box sx={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #eee" }}>
                    {["#", "Posto", "Bairro", "Bandeira", "Declarado", "Venda"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 6px", color: "#666", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dados.top10.map((p, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f5f5f5" }}>
                      <td style={{ padding: "8px 6px", color: "#999" }}>{i + 1}</td>
                      <td style={{ padding: "8px 6px", fontWeight: 500 }}>{p.posto}</td>
                      <td style={{ padding: "8px 6px", color: "#666" }}>{p.bairro || "—"}</td>
                      <td style={{ padding: "8px 6px"}}>
                        {p.bandeira
                          ? <Chip label={p.bandeira} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                          : <span style={{ color: "#999" }}>—</span>}
                      </td>
                      <td style={{ padding: "8px 6px", fontWeight: 700, color: p.valorDeclarado < m.mediaAtual ? "#2e7d32" : "#c62828" }}>
                        {fmt(p.valorDeclarado)}
                      </td>
                      <td style={{ padding: "8px 6px", color: "#666" }}>{fmt(p.valorVenda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </Paper>
        </>
      )}
    </Box>
  );
}
