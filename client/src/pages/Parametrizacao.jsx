import { useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
} from "@mui/material";
import MUNICIPIOS from "../constants/municipios";

const MUNICIPIO_PADRAO = 2704302;
const DIAS_UTEIS_ANO = 252;
function truncar(valor, casas = 2) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 0;
  const fator = 10 ** casas;
  return Math.trunc(numero * fator) / fator;
}

function arredondar(valor, casas = 2) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 0;
  const fator = 10 ** casas;
  return Math.round((numero + Number.EPSILON) * fator) / fator;
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(arredondar(valor, 2));
}

function formatarNumero(valor, casas = 2) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(arredondar(valor, casas));
}

function formatarPercentual(valor, casas = 2) {
  return `${formatarNumero((valor || 0) * 100, casas)}%`;
}

function tratarCreditoLivre(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 0;
  return Math.abs(numero);
}

function LinhaPlanilha({ label, value, highlight, labelColor = "text.primary", valueColor = "text.primary", renderValue }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 190px",
        alignItems: "center",
        borderBottom: "1px solid #222",
        backgroundColor: highlight || "transparent",
        minHeight: 44,
      }}
    >
      <Box
        sx={{
          gridColumn: "1 / span 2",
          px: 2,
          py: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRight: "1px solid #222",
          backgroundColor: highlight || "transparent",
        }}
      >
        <Typography fontWeight={700} color={labelColor} align="center">
          {label}
        </Typography>
      </Box>
      <Box
        sx={{
          px: 2,
          py: 1,
          minHeight: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          backgroundColor: highlight || "transparent",
        }}
      >
        {renderValue || <Typography fontWeight={700} color={valueColor}>{value}</Typography>}
      </Box>
    </Box>
  );
}

function LinhaTitulo({ children, backgroundColor = "#fff" }) {
  return (
    <Box
      sx={{
        gridColumn: "1 / -1",
        px: 2,
        py: 1.25,
        borderBottom: "1px solid #222",
        textAlign: "center",
        backgroundColor,
      }}
    >
      <Typography fontWeight={800} fontSize={18}>
        {children}
      </Typography>
    </Box>
  );
}

function LinhaSubtitulo({ children }) {
  return (
    <Box
      sx={{
        gridColumn: "1 / -1",
        px: 2,
        py: 0.75,
        borderBottom: "1px solid #222",
        textAlign: "center",
        backgroundColor: "#fff",
      }}
    >
      <Typography fontWeight={800} fontSize={15}>
        {children}
      </Typography>
    </Box>
  );
}

function CelulaTexto({ value, loading = false, error = null }) {
  return (
    <Box sx={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.25 }}>
      <Typography fontWeight={700} color="text.primary">
        {loading ? "..." : value}
      </Typography>
      {error && (
        <Typography variant="caption" color="error.main">
          {error}
        </Typography>
      )}
    </Box>
  );
}

function MetricCard({ titulo, valor, subtitulo, cor = "#294D80", loading = false }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.25,
        border: "1px solid",
        borderColor: "grey.200",
        borderRadius: 3,
        background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,252,255,0.98) 100%)",
        minHeight: 132,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
        {titulo}
      </Typography>
      <Typography variant="h5" fontWeight={800} sx={{ color: cor, mt: 0.75, lineHeight: 1.15 }}>
        {loading ? "..." : valor}
      </Typography>
      {subtitulo && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {subtitulo}
        </Typography>
      )}
    </Paper>
  );
}

export default function Parametrizacao({
  municipio = MUNICIPIO_PADRAO,
  dias = 30,
  selic = 14.75,
  creditoLivre = 7.31,
  planoAtivo = "gasolina",
  valorVista = 0,
  selicLoading = false,
  selicErro = null,
  creditoLivreLoading = false,
  creditoLivreErro = null,
  valorVistaLoading = false,
  valorVistaErro = null,
}) {
  const municipioAtual = useMemo(
    () => MUNICIPIOS.find((item) => item.ibge === municipio) ?? null,
    [municipio]
  );
  const creditoLivreTratado = tratarCreditoLivre(creditoLivre);

  const planoSelecionado = {
    gasolina: { titulo: 'Gasolina Comum', combustivelId: 1, divergenciaBase: 0.07 },
    etanol: { titulo: 'Etanol', combustivelId: 3, divergenciaBase: 0.07 },
    diesel: { titulo: 'Diesel S10', combustivelId: 5, divergenciaBase: 0.0543 },
  }[planoAtivo] || { titulo: 'Gasolina Comum', combustivelId: 1, divergenciaBase: 0.07 };
  const planoAtual = planoSelecionado;

  const calculos = useMemo(() => {
    const divergenciaBase = planoSelecionado.divergenciaBase;
    const indiceAjuste = (selic * creditoLivreTratado) / 100;
    const periodo = dias / DIAS_UTEIS_ANO;
    const valorVistaBase = Number(valorVista) || 0;
    const valorMaximoFitcardBruto = valorVistaBase > 0 ? valorVistaBase * ((1 + indiceAjuste) ** periodo) : 0;
    const taxaParametrizacaoBruta = valorVistaBase > 0 ? (valorMaximoFitcardBruto / valorVistaBase) - 1 : 0;
    const divergenciaBruta = taxaParametrizacaoBruta - divergenciaBase;
    const taxaAbsolutaBruta = Math.abs(divergenciaBruta);
    const coeficienteCorrecaoBruto = 1 - taxaAbsolutaBruta;
    const precoFitcardBruto = valorMaximoFitcardBruto > 0 ? valorMaximoFitcardBruto * coeficienteCorrecaoBruto : 0;

    return {
      divergenciaBase,
      indiceAjuste,
      periodo,
      valorVistaBase,
      valorMaximoFitcard: valorMaximoFitcardBruto,
      precoFitcard: truncar(precoFitcardBruto, 2),
      taxaParametrizacao: taxaParametrizacaoBruta,
      divergencia: divergenciaBruta,
      taxaAbsoluta: taxaAbsolutaBruta,
      coeficienteCorrecao: coeficienteCorrecaoBruto,
    };
  }, [selic, creditoLivreTratado, dias, valorVista, planoSelecionado.divergenciaBase]);

  return (
    <Box sx={{ mt: 2.5, display: "grid", gap: 3.5 }}>
      {(creditoLivreErro || selicErro || valorVistaErro) && (
        <Box sx={{ display: "grid", gap: 1 }}>
          {creditoLivreErro && <Alert severity="warning">{creditoLivreErro}</Alert>}
          {selicErro && <Alert severity="warning">{selicErro}</Alert>}
          {valorVistaErro && <Alert severity="warning">{valorVistaErro}</Alert>}
        </Box>
      )}

      {(creditoLivreLoading || selicLoading || valorVistaLoading) && (
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <CircularProgress size={20} />
        </Box>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
        <MetricCard
          titulo="Valor a vista"
          valor={formatarMoeda(valorVista)}
          subtitulo={`${municipioAtual?.nome || "Município"} · ${planoAtual.titulo}`}
          cor="#294D80"
          loading={valorVistaLoading}
        />
        <MetricCard
          titulo="Valor máximo aceitável"
          valor={formatarMoeda(calculos.valorMaximoFitcard)}
          subtitulo={`Base de divergência: ${formatarPercentual(planoAtual.divergenciaBase)}`}
          cor="#2e7d32"
        />
        <MetricCard
          titulo="Preço FitCard"
          valor={formatarMoeda(calculos.precoFitcard)}
          subtitulo="Valor final truncado em 2 casas"
          cor="#f57c00"
        />
        <MetricCard
          titulo="Coeficiente de correção"
          valor={formatarNumero(calculos.coeficienteCorrecao, 9)}
          subtitulo={`Taxa absoluta: ${formatarNumero(calculos.taxaAbsoluta, 9)}`}
          cor="#c62828"
        />
      </Box>

      <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "grey.200", borderRadius: 3 }}>
        <Typography variant="subtitle1" fontWeight={800} gutterBottom>
          Como o cálculo funciona
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          O valor a vista vem da média atual do combustível selecionado no município escolhido. A partir dele, combinamos os indicadores carregados do BCB com a base de divergência da planilha.
        </Typography>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 1.5 }}>
          <Paper elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "grey.200", borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase" }}>Índice de ajuste</Typography>
            <Typography fontWeight={700}>R = {formatarNumero(calculos.indiceAjuste, 6)}</Typography>
          </Paper>

          <Paper elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "grey.200", borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase" }}>Período</Typography>
            <Typography fontWeight={700}>t = {formatarNumero(calculos.periodo, 9)}</Typography>
          </Paper>

          <Paper elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "grey.200", borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase" }}>Taxa de parametrização</Typography>
            <Typography fontWeight={700}>{formatarPercentual(calculos.taxaParametrizacao)}</Typography>
          </Paper>

          <Paper elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "grey.200", borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase" }}>Divergência</Typography>
            <Typography fontWeight={700}>{formatarPercentual(calculos.divergencia)}</Typography>
          </Paper>
        </Box>
      </Paper>
    </Box>
  );
}