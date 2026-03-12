import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import { useState, useCallback } from "react";
import {
  Box, Container, Typography, Alert, Divider,
  Tabs, Tab, Paper,
} from "@mui/material";
import LocalGasStationIcon from "@mui/icons-material/LocalGasStation";
import BarChartIcon from "@mui/icons-material/BarChart";
import SearchIcon from "@mui/icons-material/Search";

import api from "./api/combustivel";
import { FILTROS_INICIAIS } from "./constants/combustiveis";
import FiltrosBar from "./components/FiltrosBar";
import ExportBar from "./components/ExportBar";
import ListaPostos from "./components/ListaPostos";
import StatusModal from "./components/StatusModal";
import Dashboard from "./pages/Dashboard";

const normalizar = (texto = "") =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/* =========================
   TELA DE PESQUISA
========================= */
function PesquisaPage() {
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [bairroFiltro, setBairroFiltro] = useState("");
  const [postoFiltro, setPostoFiltro] = useState("");
  const [aviso, setAviso] = useState(null);

  const filtroAtivo = bairroFiltro.trim() !== "" || postoFiltro.trim() !== "";

  const buscar = useCallback(
    async (novaPagina = 1, diasOverride = null) => {
      setLoading(true);
      setAviso(null);
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
    const bairro = normalizar(item.estabelecimento.endereco.bairro);
    const posto = normalizar(item.estabelecimento.nomeFantasia || item.estabelecimento.razaoSocial);
    return (
      (!bairroFiltro || bairro.includes(normalizar(bairroFiltro))) &&
      (!postoFiltro || posto.includes(normalizar(postoFiltro)))
    );
  });

  return (
    <>
      <FiltrosBar
        filtros={filtros}
        bairroFiltro={bairroFiltro}
        postoFiltro={postoFiltro}
        loading={loading}
        onFiltroChange={handleFiltroChange}
        onBairroChange={setBairroFiltro}
        onPostoChange={setPostoFiltro}
        onBuscar={buscar}
      />
      <ExportBar filtros={filtros} pagina={pagina} />
      <Divider sx={{ my: 2 }} />
      {aviso && (
        <Alert severity={aviso.severity} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}
      <ListaPostos
        dados={dadosFiltrados}
        loading={loading}
        pagina={pagina}
        totalPaginas={totalPaginas}
        filtroAtivo={filtroAtivo}
        onPageChange={buscar}
      />
    </>
  );
}

/* =========================
   APP PRINCIPAL
========================= */
export default function App() {
  const location = useLocation();
  const tabValue = location.pathname === "/dashboard" ? 1 : 0;

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      {/* HEADER */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <LocalGasStationIcon color="primary" fontSize="large" />
        <Typography variant="h5" fontWeight={700}>
          AMGESP — Combustíveis
        </Typography>
        <Box sx={{ ml: "auto" }}>
          <StatusModal />
        </Box>
      </Box>

      {/* NAVEGAÇÃO */}
      <Paper elevation={0} sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs value={tabValue} indicatorColor="primary" textColor="primary">
          <Tab
            icon={<SearchIcon fontSize="small" />}
            iconPosition="start"
            label="Pesquisa"
            component={NavLink}
            to="/"
          />
          <Tab
            icon={<BarChartIcon fontSize="small" />}
            iconPosition="start"
            label="Dashboard"
            component={NavLink}
            to="/dashboard"
          />
        </Tabs>
      </Paper>

      {/* ROTAS */}
      <Routes>
        <Route path="/" element={<PesquisaPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Container>
  );
}
