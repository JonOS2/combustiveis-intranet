import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box, Container, Typography, Alert,
  Tabs, Tab, Paper, Chip, TextField, MenuItem,
} from "@mui/material";
import LocalGasStationIcon from "@mui/icons-material/LocalGasStation";
import BarChartIcon from "@mui/icons-material/BarChart";
import SearchIcon from "@mui/icons-material/Search";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import MapIcon from "@mui/icons-material/Map";
import TuneIcon from "@mui/icons-material/Tune";

import api from "./api/combustivel";
import { FILTROS_INICIAIS, TIPOS_COMBUSTIVEL } from "./constants/combustiveis";
import MUNICIPIOS from "./constants/municipios";
import { isCredenciado } from "./constants/credenciados";
import FiltrosBar from "./components/FiltrosBar";
import ExportBar from "./components/ExportBar";
import ParametrizacaoBar from "./components/ParametrizacaoBar";
import ListaPostos from "./components/ListaPostos";
import StatusModal from "./components/StatusModal";
import Dashboard from "./pages/Dashboard";
import MapaPostos from "./pages/MapaPostos";
import Parametrizacao from "./pages/Parametrizacao";

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
  const tabValue = location.pathname === "/dashboard" ? 1 : location.pathname === "/mapa" ? 2 : location.pathname === "/parametrizacao" ? 3 : 0;
  const isPesquisa = location.pathname === "/";
  const isDashboard = location.pathname === "/dashboard";
  const isMapa = location.pathname === "/mapa";
  const isParametrizacao = location.pathname === "/parametrizacao";

  // ── Estado pesquisa ──────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [bandeiraFiltro, setBandeiraFiltro] = useState([]);
  const [credenciadoFiltro, setCredenciadoFiltro] = useState("");
  const [aviso, setAviso] = useState(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  // ── Estado dashboard ─────────────────────────────────────
  const [dashTipo, setDashTipo] = useState(1);
  const [dashIBGE, setDashIBGE] = useState(2704302);

  // ── Estado parametrização ────────────────────────────────
  const [paramMunicipio, setParamMunicipio] = useState(2704302);
  const [paramDias, setParamDias] = useState(30);
  const [paramSelic, setParamSelic] = useState(14.75);
  const [paramCreditoLivre, setParamCreditoLivre] = useState(7.31);
  const [paramPlanoAtivo, setParamPlanoAtivo] = useState("gasolina");
  const [paramSelicLoading, setParamSelicLoading] = useState(false);
  const [paramSelicErro, setParamSelicErro] = useState(null);
  const [paramCreditoLivreLoading, setParamCreditoLivreLoading] = useState(false);
  const [paramCreditoLivreErro, setParamCreditoLivreErro] = useState(null);
  const [paramValorVista, setParamValorVista] = useState(0);
  const [paramValorVistaLoading, setParamValorVistaLoading] = useState(false);
  const [paramValorVistaErro, setParamValorVistaErro] = useState(null);

  const paramPlanoSelecionado = {
    gasolina: { combustivelId: 1 },
    etanol: { combustivelId: 3 },
    diesel: { combustivelId: 5 },
  }[paramPlanoAtivo] || { combustivelId: 1 };

  const filtroAtivo = bandeiraFiltro.length > 0 || credenciadoFiltro.trim() !== "";

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
      setBandeiraFiltro([]);
      setCredenciadoFiltro("");
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
    const bandeira = item.estabelecimento.bandeira || "";
    const cred = isCredenciado(item.estabelecimento.cnpj);
    return (
      (bandeiraFiltro.length === 0 || bandeiraFiltro.includes(bandeira)) &&
      (!credenciadoFiltro || (credenciadoFiltro === "sim" ? cred : !cred))
    );
  });

  const textoAtualizacao = formatarUltimaAtualizacao(ultimaAtualizacao);

  useEffect(() => {
    let ativo = true;

    const carregarIndicadores = async () => {
      setParamSelicLoading(true);
      setParamCreditoLivreLoading(true);
      setParamSelicErro(null);
      setParamCreditoLivreErro(null);

      try {
        const [selicRes, creditoRes] = await Promise.all([
          api.get("/parametrizacao/serie/432?nome=SELIC"),
          api.get("/parametrizacao/serie/20635?nome=CRÉDITO LIVRE (%)"),
        ]);

        if (!ativo) return;

        setParamSelic(Number(selicRes.data.valor ?? 0));
        setParamCreditoLivre(Number(creditoRes.data.valor ?? 0));
      } catch {
        if (!ativo) return;
        setParamSelicErro("Não foi possível carregar a SELIC do BCB.");
        setParamCreditoLivreErro("Não foi possível carregar o crédito livre do BCB.");
      } finally {
        if (ativo) {
          setParamSelicLoading(false);
          setParamCreditoLivreLoading(false);
        }
      }
    };

    carregarIndicadores();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;

    const carregarValorVista = async () => {
      setParamValorVistaLoading(true);
      setParamValorVistaErro(null);

      try {
        const res = await api.get(`/dashboard?tipoCombustivel=${paramPlanoSelecionado.combustivelId}&codigoIBGE=${paramMunicipio}`);
        if (!ativo) return;

        const mediaAtual = Number(res.data?.metricas?.mediaAtual ?? 0);
        setParamValorVista(mediaAtual);
      } catch {
        if (!ativo) return;
        setParamValorVistaErro("Não foi possível carregar a média atual do combustível selecionado.");
      } finally {
        if (ativo) setParamValorVistaLoading(false);
      }
    };

    carregarValorVista();

    return () => {
      ativo = false;
    };
  }, [paramMunicipio, paramPlanoSelecionado.combustivelId]);

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      {/* CARD BRANCO PRINCIPAL */}
      <Paper elevation={0} sx={{ mb: isParametrizacao ? 0 : 3, p: 2, borderRadius: 2, border: "1px solid", borderColor: "grey.200" }}>

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
          <Tab icon={<MapIcon fontSize="small" />} iconPosition="start" label="Mapa" component={NavLink} to="/mapa" />
          <Tab icon={<TuneIcon fontSize="small" />} iconPosition="start" label="Parametrização" component={NavLink} to="/parametrizacao" />
        </Tabs>

        {/* FILTROS PESQUISA — dentro do card */}
        {isPesquisa && (
          <>
            <FiltrosBar
              filtros={filtros}
              bandeiraFiltro={bandeiraFiltro}
              credenciadoFiltro={credenciadoFiltro}
              bandeirasDisponiveis={bandeirasDisponiveis}
              loading={loading}
              onFiltroChange={handleFiltroChange}
              onBandeiraChange={setBandeiraFiltro}
              onCredenciadoChange={setCredenciadoFiltro}
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
            <TextField select label="Combustível" size="small" sx={{ minWidth: 180 }} value={dashTipo} onChange={(e) => setDashTipo(e.target.value)}>
              {TIPOS_COMBUSTIVEL.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
            <TextField select label="Município" size="small" sx={{ minWidth: 200 }} value={dashIBGE} onChange={(e) => setDashIBGE(Number(e.target.value))}>
              {MUNICIPIOS.map((m) => <MenuItem key={m.ibge} value={m.ibge}>{m.nome}</MenuItem>)}
            </TextField>
          </Box>
        )}

        {/* FILTROS MAPA — dentro do card */}
        {isMapa && (
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <TextField select label="Combustível" size="small" sx={{ minWidth: 180 }} value={dashTipo} onChange={(e) => setDashTipo(e.target.value)}>
              {TIPOS_COMBUSTIVEL.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
            <TextField select label="Município" size="small" sx={{ minWidth: 200 }} value={dashIBGE} onChange={(e) => setDashIBGE(Number(e.target.value))}>
              {MUNICIPIOS.map((m) => <MenuItem key={m.ibge} value={m.ibge}>{m.nome}</MenuItem>)}
            </TextField>
          </Box>
        )}

        {isParametrizacao && (
          <ParametrizacaoBar
            municipio={paramMunicipio}
            dias={paramDias}
            selic={paramSelic}
            creditoLivre={paramCreditoLivre}
            planoAtivo={paramPlanoAtivo}
            onMunicipioChange={setParamMunicipio}
            onDiasChange={setParamDias}
            onSelicChange={setParamSelic}
            onCreditoLivreChange={setParamCreditoLivre}
            onPlanoChange={setParamPlanoAtivo}
          />
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
        <Route
          path="/mapa"
          element={<MapaPostos tipoCombustivel={dashTipo} codigoIBGE={dashIBGE} />}
        />
        <Route
          path="/parametrizacao"
          element={
            <Parametrizacao
              municipio={paramMunicipio}
              dias={paramDias}
              selic={paramSelic}
              creditoLivre={paramCreditoLivre}
              planoAtivo={paramPlanoAtivo}
              valorVista={paramValorVista}
              selicLoading={paramSelicLoading}
              selicErro={paramSelicErro}
              creditoLivreLoading={paramCreditoLivreLoading}
              creditoLivreErro={paramCreditoLivreErro}
              valorVistaLoading={paramValorVistaLoading}
              valorVistaErro={paramValorVistaErro}
            />
          }
        />
      </Routes>
    </Container>
  );
}
