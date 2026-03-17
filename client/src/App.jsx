import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import { useState, useCallback, useMemo } from "react";
import {
  Box, Container, Typography, Alert,
  Tabs, Tab, Paper, Chip, TextField, MenuItem,
} from "@mui/material";
import LocalGasStationIcon from "@mui/icons-material/LocalGasStation";
import BarChartIcon from "@mui/icons-material/BarChart";
import SearchIcon from "@mui/icons-material/Search";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

import api from "./api/combustivel";
import { FILTROS_INICIAIS, TIPOS_COMBUSTIVEL } from "./constants/combustiveis";
import MUNICIPIOS from "./constants/municipios";
import FiltrosBar from "./components/FiltrosBar";
import ExportBar from "./components/ExportBar";
import ListaPostos from "./components/ListaPostos";
import StatusModal from "./components/StatusModal";
import Dashboard from "./pages/Dashboard";

const normalizar = (texto = "") =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const formatarUltimaAtualizacao = (iso) => {
  if (!iso) return null;
  const data = new Date(iso);
  const agora = new Date();
  const diffMin = Math.floor((agora - data) / 60000);
  const diffHoras = Math.floor(diffMin / 60);
  if (diffMin < 1) return "atualizado agora";
  if (diffMin < 60) return `atualizado há ${diffMin} min`;
  if (diffHoras < 24) return `atualizado hoje às ${data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  return `atualizado em ${data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

export default function App() {
  const location = useLocation();
  const tabValue = location.pathname === "/dashboard" ? 1 : 0;
  const isPesquisa = location.pathname === "/";
  const isDashboard = location.pathname === "/dashboard";

  // ── Estado pesquisa ──────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [bandeiraFiltro, setBandeiraFiltro] = useState("");
  const [postoFiltro, setPostoFiltro] = useState("");
  const [aviso, setAviso] = useState(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  // ── Estado dashboard ─────────────────────────────────────
  const [dashTipo, setDashTipo] = useState(1);
  const [dashIBGE, setDashIBGE] = useState(2704302);

  const filtroAtivo = bandeiraFiltro.trim() !== "" || postoFiltro.trim() !== "";

  const bandeirasDisponiveis = useMemo(() => {
    const set = new Set();
    dados.forEach((item) => {
      const b = item.estabelecimento.bandeira;
      if (b && b !== "—") set.add(b);
    });
    return Array.from(set).sort();
  }, [dados]);

  const buscar = useCallback(
    async (novaPagina = 1, diasOverride = null) => {
      setLoading(true);
      setAviso(null);
      setBandeiraFiltro("");
      try {
        const diasUsado = diasOverride ?? filtros.dias;
        const res = await api.post("/combustivel", {
          ...filtros,
          dias: diasUsado,
          pagina: novaPagina,
        });
        const conteudo = res.data.conteudo || [];
        if (conteudo.length === 0 && diasUsado === 1) {
          setAviso({
            severity: "warning",
            message: "Nenhum registro encontrado no último dia. Mostrando dados dos últimos 5 dias.",
          });
          setFiltros((prev) => ({ ...prev, dias: 5 }));
          return buscar(1, 5);
        }
        setDados(conteudo);
        setPagina(res.data.pagina);
        setTotalPaginas(res.data.totalPaginas);
        setUltimaAtualizacao(res.data.ultimaAtualizacao || null);
      } catch {
        setAviso({
          severity: "error",
          message: "Erro ao buscar dados. Verifique sua conexão e tente novamente.",
        });
      } finally {
        setLoading(false);
      }
    },
    [filtros]
  );

  const handleFiltroChange = useCallback((campo, valor) => {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
  }, []);

  const dadosFiltrados = dados.filter((item) => {
    const posto = normalizar(item.estabelecimento.nomeFantasia || item.estabelecimento.razaoSocial);
    const bandeira = item.estabelecimento.bandeira || "";
    return (
      (!bandeiraFiltro || bandeira === bandeiraFiltro) &&
      (!postoFiltro || posto.includes(normalizar(postoFiltro)))
    );
  });

  const textoAtualizacao = formatarUltimaAtualizacao(ultimaAtualizacao);

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      {/* CARD BRANCO PRINCIPAL */}
      <Paper elevation={0} sx={{ mb: 3, p: 2, borderRadius: 2, border: "1px solid", borderColor: "grey.200" }}>

        {/* CABEÇALHO */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <LocalGasStationIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>Combustíveis AL</Typography>
          </Box>
          <StatusModal />
        </Box>

        {/* TABS */}
        <Tabs value={tabValue} sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
          <Tab icon={<SearchIcon fontSize="small" />} iconPosition="start" label="Pesquisa" component={NavLink} to="/" />
          <Tab icon={<BarChartIcon fontSize="small" />} iconPosition="start" label="Dashboard" component={NavLink} to="/dashboard" />
        </Tabs>

        {/* FILTROS PESQUISA — dentro do card */}
        {isPesquisa && (
          <>
            <FiltrosBar
              filtros={filtros}
              bandeiraFiltro={bandeiraFiltro}
              postoFiltro={postoFiltro}
              bandeirasDisponiveis={bandeirasDisponiveis}
              loading={loading}
              onFiltroChange={handleFiltroChange}
              onBandeiraChange={setBandeiraFiltro}
              onPostoChange={setPostoFiltro}
              onBuscar={buscar}
            />
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mt: 1 }}>
              <ExportBar filtros={filtros} pagina={pagina} />
              {textoAtualizacao && (
                <Chip
                  icon={<AccessTimeIcon fontSize="small" />}
                  label={textoAtualizacao}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: 11, color: "text.secondary", borderColor: "grey.300" }}
                />
              )}
            </Box>
          </>
        )}

        {/* FILTROS DASHBOARD — dentro do card */}
        {isDashboard && (
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <TextField
              select
              label="Combustível"
              size="small"
              sx={{ minWidth: 180 }}
              value={dashTipo}
              onChange={(e) => setDashTipo(e.target.value)}
            >
              {TIPOS_COMBUSTIVEL.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Município"
              size="small"
              sx={{ minWidth: 200 }}
              value={dashIBGE}
              onChange={(e) => setDashIBGE(Number(e.target.value))}
            >
              {MUNICIPIOS.map((m) => (
                <MenuItem key={m.ibge} value={m.ibge}>{m.nome}</MenuItem>
              ))}
            </TextField>
          </Box>
        )}
      </Paper>

      {/* AVISOS */}
      {aviso && (
        <Alert severity={aviso.severity} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}

      {/* CONTEÚDO FORA DO CARD */}
      <Routes>
        <Route
          path="/"
          element={
            <ListaPostos
              dados={dadosFiltrados}
              loading={loading}
              pagina={pagina}
              totalPaginas={totalPaginas}
              filtroAtivo={filtroAtivo}
              onPageChange={buscar}
              tipoCombustivel={filtros.tipoCombustivel}
            />
          }
        />
        <Route
          path="/dashboard"
          element={<Dashboard tipoCombustivel={dashTipo} codigoIBGE={dashIBGE} />}
        />
      </Routes>
    </Container>
  );
}
