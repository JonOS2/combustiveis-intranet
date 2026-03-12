import { useState, useEffect, useCallback } from "react";
import {
  Box, Grid, Typography, Paper, Select, MenuItem,
  FormControl, InputLabel, CircularProgress, Alert,
  Chip,
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
import { TIPOS_COMBUSTIVEL } from "../constants/combustiveis";
import MUNICIPIOS from "../constants/municipios";

const fmt = (v) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const fmtPct = (v) =>
  v != null ? `${v > 0 ? "+" : ""}${v.toFixed(2)}%` : "—";

const CORES = ["#294D80", "#E02F52", "#4CAF50", "#FF9800", "#9C27B0", "#00BCD4", "#C4D2DE"];

/* =========================
   CARD DE MÉTRICA
========================= */
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

/* =========================
   TOOLTIP CUSTOMIZADO
========================= */
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

/* =========================
   WRAPPER DE GRÁFICO
========================= */
function GraficoCard({ titulo, subtitulo, height = 280, children }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "grey.200", borderRadius: 3, height: "100%" }}>
      <Typography variant="subtitle1" fontWeight={700}>{titulo}</Typography>
      {subtitulo && <Typography variant="caption" color="text.secondary">{subtitulo}</Typography>}
      <Box sx={{ mt: subtitulo ? 1 : 0.5 }}>
        <ResponsiveContainer width="100%" height={height}>
          {children}
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
}

/* =========================
   DASHBOARD
========================= */
export default function Dashboard() {
  const [tipoCombustivel, setTipoCombustivel] = useState(1);
  const [codigoIBGE, setCodigoIBGE] = useState(2704302);
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

  return (
    <Box>
      {/* FILTROS */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Combustível</InputLabel>
          <Select value={tipoCombustivel} label="Combustível" onChange={(e) => setTipoCombustivel(e.target.value)}>
            {TIPOS_COMBUSTIVEL.map((t) => (
              <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Município</InputLabel>
          <Select value={codigoIBGE} label="Município" onChange={(e) => setCodigoIBGE(Number(e.target.value))}>
            {MUNICIPIOS.map((m) => (
              <MenuItem key={m.ibge} value={m.ibge}>{m.nome}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {erro && <Alert severity="error">{erro}</Alert>}

      {!loading && dados && (
        <>
          {/* CARDS DE MÉTRICAS */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <MetricCard titulo="Menor Preço" valor={fmt(m.menorPreco)} subtitulo="preço mais baixo hoje" />
            </Grid>
            <Grid item xs={6} sm={3}>
              <MetricCard
                titulo="Média Atual"
                valor={fmt(m.mediaAtual)}
                subtitulo={m.variacaoMedia != null ? `${fmtPct(m.variacaoMedia)} vs semana anterior` : "sem dados anteriores"}
                tendencia={m.variacaoMedia}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <MetricCard titulo="Maior Preço" valor={fmt(m.maiorPreco)} subtitulo="preço mais alto hoje" />
            </Grid>
            <Grid item xs={6} sm={3}>
              <MetricCard
                titulo="Postos Acima da Média"
                valor={`${m.percentualAcimaMedia.toFixed(0)}%`}
                subtitulo={`${m.postosAcimaMedia} de ${m.totalPostos} postos`}
                chip={m.percentualAcimaMedia > 50 ? "Maioria cara" : "Maioria em conta"}
              />
            </Grid>
          </Grid>

          {/* EVOLUÇÃO */}
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

          {/* GRADE 2x2 */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {/* TOP 10 MENORES PREÇOS */}
            <Grid item xs={12} md={6}>
              <GraficoCard titulo="Top 10 Menores Preços" subtitulo="linha vermelha = média atual">
                <BarChart data={dados.top10} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v.toFixed(2)}`} domain={["auto", "auto"]} />
                  <YAxis type="category" dataKey="posto" tick={{ fontSize: 10 }} width={120}
                    tickFormatter={(v) => v.length > 18 ? v.slice(0, 18) + "…" : v} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <ReferenceLine x={m.mediaAtual} stroke="#E02F52" strokeDasharray="4 2"
                    label={{ value: "Média", position: "top", fontSize: 10, fill: "#E02F52" }} />
                  <Bar dataKey="valorDeclarado" name="Preço declarado" radius={[0, 4, 4, 0]}>
                    {dados.top10.map((entry, i) => (
                      <Cell key={i} fill={entry.valorDeclarado <= m.mediaAtual ? "#4CAF50" : "#294D80"} />
                    ))}
                  </Bar>
                </BarChart>
              </GraficoCard>
            </Grid>

            {/* MÉDIA POR BANDEIRA */}
            <Grid item xs={12} md={6}>
              <GraficoCard titulo="Média por Bandeira" subtitulo="últimos 7 dias">
                <BarChart data={dados.porBandeira} margin={{ top: 0, right: 10, bottom: 40, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="bandeira" tick={{ fontSize: 10, angle: -35, textAnchor: "end" }}
                    tickFormatter={(v) => v.length > 12 ? v.slice(0, 12) + "…" : v} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v.toFixed(2)}`} domain={["auto", "auto"]} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="media" name="Média de preço" radius={[4, 4, 0, 0]}>
                    {dados.porBandeira.map((_, i) => (
                      <Cell key={i} fill={CORES[i % CORES.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </GraficoCard>
            </Grid>

            {/* MÉDIA POR MUNICÍPIO */}
            <Grid item xs={12} md={6}>
              <GraficoCard titulo="10 Municípios Mais Baratos" subtitulo="média dos últimos 7 dias — mín. 2 postos">
                <BarChart data={dados.porMunicipio} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v.toFixed(2)}`} domain={["auto", "auto"]} />
                  <YAxis type="category" dataKey="municipio" tick={{ fontSize: 10 }} width={130}
                    tickFormatter={(v) => v.length > 20 ? v.slice(0, 20) + "…" : v} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="media" name="Média" radius={[0, 4, 4, 0]}>
                    {dados.porMunicipio.map((_, i) => (
                      <Cell key={i} fill={CORES[i % CORES.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </GraficoCard>
            </Grid>

            {/* CONCENTRAÇÃO POR BAIRRO */}
            <Grid item xs={12} md={6}>
              <GraficoCard titulo="Postos por Bairro" subtitulo="top 12 bairros com mais postos">
                <BarChart data={dados.porBairro} margin={{ top: 0, right: 10, bottom: 50, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="bairro" tick={{ fontSize: 10, angle: -40, textAnchor: "end" }}
                    tickFormatter={(v) => v.length > 10 ? v.slice(0, 10) + "…" : v} />
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
              </GraficoCard>
            </Grid>
          </Grid>

          {/* DISTRIBUIÇÃO */}
          <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "grey.200", borderRadius: 3, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Distribuição de Preços — quantos postos por faixa
            </Typography>
            <ResponsiveContainer width="100%" height={200}>
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
                      <td style={{ padding: "8px 6px" }}>
                        {p.bandeira ? <Chip label={p.bandeira} size="small" variant="outlined" color="secondary" /> : "—"}
                      </td>
                      <td style={{ padding: "8px 6px", color: p.valorDeclarado <= m.mediaAtual ? "#4CAF50" : "#E02F52", fontWeight: 600 }}>
                        {fmt(p.valorDeclarado)}
                      </td>
                      <td style={{ padding: "8px 6px" }}>{fmt(p.valorVenda)}</td>
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
