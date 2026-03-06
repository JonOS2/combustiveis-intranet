import { useState, useCallback } from "react";
import {
  Box,
  Container,
  Typography,
  Alert,
  Divider,
} from "@mui/material";
import LocalGasStationIcon from "@mui/icons-material/LocalGasStation";

import api from "./api/combustivel";
import { FILTROS_INICIAIS } from "./constants/combustiveis";
import FiltrosBar from "./components/FiltrosBar";
import ExportBar from "./components/ExportBar";
import ListaPostos from "./components/ListaPostos";

/* =========================
   UTIL
========================= */
const normalizar = (texto = "") =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/* =========================
   APP
========================= */
export default function App() {
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [bairroFiltro, setBairroFiltro] = useState("");
  const [postoFiltro, setPostoFiltro] = useState("");
  const [aviso, setAviso] = useState(null); // { severity, message }

  // Detecta se há filtro local ativo (bairro ou posto)
  const filtroAtivo =
    bairroFiltro.trim() !== "" || postoFiltro.trim() !== "";

  /* =========================
     BUSCA PRINCIPAL
  ========================= */
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

        // Se não encontrou nada no último dia, expande para 5 dias automaticamente
        if (conteudo.length === 0 && diasUsado === 1) {
          setAviso({
            severity: "warning",
            message:
              "Nenhum registro encontrado no último dia. Mostrando dados dos últimos 5 dias.",
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

  /* =========================
     HANDLERS
  ========================= */
  // Atualiza um campo específico dos filtros principais
  const handleFiltroChange = useCallback((campo, valor) => {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
  }, []);

  /* =========================
     FILTRAGEM LOCAL
     (bairro e posto — feita no frontend, sem nova requisição)
     BUG CORRIGIDO: removida a re-ordenação aqui, pois o backend
     já retorna os dados ordenados pela escolha do usuário
  ========================= */
  const dadosFiltrados = dados.filter((item) => {
    const bairro = normalizar(item.estabelecimento.endereco.bairro);
    const posto = normalizar(
      item.estabelecimento.nomeFantasia || item.estabelecimento.razaoSocial
    );
    return (
      (!bairroFiltro || bairro.includes(normalizar(bairroFiltro))) &&
      (!postoFiltro || posto.includes(normalizar(postoFiltro)))
    );
  });

  /* =========================
     RENDER
  ========================= */
  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      {/* HEADER */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <LocalGasStationIcon color="primary" fontSize="large" />
        <Typography variant="h5" fontWeight={700}>
          Pesquisa de Combustíveis – AL
        </Typography>
      </Box>

      {/* FILTROS */}
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

      {/* EXPORTAÇÃO */}
      <ExportBar filtros={filtros} pagina={pagina} />

      <Divider sx={{ my: 2 }} />

      {/* AVISO (warning ou error) */}
      {aviso && (
        <Alert severity={aviso.severity} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}

      {/* LISTA DE POSTOS */}
      <ListaPostos
        dados={dadosFiltrados}
        loading={loading}
        pagina={pagina}
        totalPaginas={totalPaginas}
        filtroAtivo={filtroAtivo}
        onPageChange={buscar}
      />
    </Container>
  );
}
