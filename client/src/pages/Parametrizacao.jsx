import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import MUNICIPIOS from "../constants/municipios";
import api from "../api/combustivel";

const MUNICIPIO_PADRAO = 2704302;

const PLANOS = [
  { key: "gasolina", titulo: "Gasolina Comum", combustivelId: 1, cor: "#294D80" },
  { key: "etanol", titulo: "Etanol", combustivelId: 3, cor: "#2e7d32" },
  { key: "diesel", titulo: "Diesel S10", combustivelId: 5, cor: "#f57c00", divergenciaBase: 0.0543 },
];

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

function formatarMoedaCurta(valor) {
  return formatarMoeda(valor);
}

function tratarCreditoLivre(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 0;
  return Math.abs(numero);
}

function criarEstadoValoresPlano() {
  return Object.fromEntries(
    PLANOS.map((plano) => [
      plano.key,
      {
        valor: 0,
        historico: [],
        loading: true,
        erro: null,
      },
    ])
  );
}

function calcularPythonFitcard({ valorVistaBase, selic, prazoDias, ciclo, descontoFitcard }) {
  const taxaPeriodo = (selic / 100) * (prazoDias / 100);
  const fatorCorrecao = (1 + taxaPeriodo) ** (1 / ciclo);
  const valorMaximoFitcard = valorVistaBase > 0 ? valorVistaBase * fatorCorrecao : 0;
  const precoFitcard = valorVistaBase > 0 ? valorVistaBase * fatorCorrecao * descontoFitcard : 0;

  return {
    taxaPeriodo,
    ciclo,
    fatorCorrecao,
    valorMaximoFitcard,
    precoFitcard,
    precoMaximoPermitido: valorMaximoFitcard,
  };
}

function calcularDieselExcel({ valorVistaBase, selic, creditoLivreTratado, prazoDias, divergenciaBase }) {
  const indiceAjuste = (selic * creditoLivreTratado) / 100;
  const periodo = prazoDias / 252;
  const valorMaximoFitcard = valorVistaBase > 0 ? valorVistaBase * ((1 + indiceAjuste) ** periodo) : 0;
  const taxaParametrizacao = valorVistaBase > 0 ? (valorMaximoFitcard / valorVistaBase) - 1 : 0;
  const divergencia = taxaParametrizacao - divergenciaBase;
  const taxaAbsoluta = Math.abs(divergencia);
  const coeficienteCorrecao = 1 - taxaAbsoluta;
  const precoFitcard = valorMaximoFitcard > 0 ? valorMaximoFitcard * coeficienteCorrecao : 0;

  return {
    divergenciaBase,
    indiceAjuste,
    periodo,
    valorMaximoFitcard,
    precoFitcard,
    precoMaximoPermitido: valorMaximoFitcard,
    taxaParametrizacao,
    divergencia,
    taxaAbsoluta,
    coeficienteCorrecao,
  };
}

function calcularSeriePlano(plano, valorVistaBase, prazoDias, selic, creditoLivreTratado, ciclo, descontoFitcard) {
  if (plano.key === "diesel") {
    const indiceAjuste = (selic * creditoLivreTratado) / 100;
    const periodo = prazoDias / 252;
    const valorMaximoFitcard = valorVistaBase > 0 ? valorVistaBase * ((1 + indiceAjuste) ** periodo) : 0;
    const fatorCorrecao = valorVistaBase > 0 ? valorMaximoFitcard / valorVistaBase : 0;
    const coeficienteCorrecao = 1 - Math.abs((fatorCorrecao - 1) - plano.divergenciaBase);
    const precoFitcard = valorMaximoFitcard > 0 ? valorMaximoFitcard * coeficienteCorrecao : 0;

    return {
      valorMaximoPermitido: valorMaximoFitcard,
      precoFitcard,
      fatorCorrecao: coeficienteCorrecao,
    };
  }

  const taxaPeriodo = (selic / 100) * (prazoDias / 100);
  const fatorCorrecao = (1 + taxaPeriodo) ** (1 / ciclo);
  const valorMaximoPermitido = valorVistaBase > 0 ? valorVistaBase * fatorCorrecao : 0;
  const precoFitcard = valorVistaBase > 0 ? valorVistaBase * fatorCorrecao * descontoFitcard : 0;

  return {
    valorMaximoPermitido,
    precoFitcard,
    fatorCorrecao,
  };
}

function MetricCard({ titulo, valor, subtitulo, cor = "#294D80", loading = false, error = null }) {
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
     {error && (
       <Typography variant="caption" color="error.main" sx={{ mt: 0.5 }}>
         {error}
       </Typography>
     )}
   </Paper>
  );
}

function BlocoFiltros({
  municipio,
  dias,
  selic,
  creditoLivre,
  onMunicipioChange,
  onDiasChange,
  onSelicChange,
  onCreditoLivreChange,
}) {
  return (
   <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25 }}>
     <TextField
       select
       label="Município"
       size="small"
       value={municipio}
       onChange={(e) => onMunicipioChange(Number(e.target.value))}
       fullWidth
     >
       {MUNICIPIOS.map((item) => (
         <MenuItem key={item.ibge} value={item.ibge}>
           {item.nome}
         </MenuItem>
       ))}
     </TextField>

     <TextField
       label="Prazo dias (Python)"
       size="small"
       type="number"
       value={dias}
       onChange={(e) => onDiasChange(Number(e.target.value))}
       inputProps={{ min: 0, step: 0.01 }}
       fullWidth
     />

     <TextField
       label="Taxa Selic"
       size="small"
       type="number"
       value={selic}
       onChange={(e) => onSelicChange(Number(e.target.value))}
       inputProps={{ min: 0, step: 0.01 }}
       fullWidth
     />

     <TextField
       label="Crédito Livre"
       size="small"
       type="number"
       value={creditoLivre}
       onChange={(e) => onCreditoLivreChange(Number(e.target.value))}
       inputProps={{ min: 0, step: 0.01 }}
       fullWidth
     />
   </Box>
  );
}

function DetalhesCalculo({ plano, calculos, municipioNome, creditoLivreTratado }) {
  const ehDiesel = plano.key === "diesel";

  return (
   <Box sx={{ display: "grid", gap: 2 }}>
     <Typography variant="body2" color="text.secondary">
       {ehDiesel
         ? "O Diesel S10 segue a estrutura do Excel: índice de ajuste, período, taxa de parametrização, divergência e coeficiente de correção."
         : "O valor médio declarado vem da média atual do combustível selecionado no município escolhido. A partir dele, aplicamos Selic, prazo dias e ciclo financeiro seguindo a mesma estrutura do cálculo em Python."}
     </Typography>

     <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 1.5 }}>
       {ehDiesel ? (
         <>
           <Paper elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "grey.200", borderRadius: 2 }}>
             <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase" }}>
               Índice de ajuste
             </Typography>
             <Typography fontWeight={700}>R = {formatarNumero(calculos.indiceAjuste, 6)}</Typography>
           </Paper>

           <Paper elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "grey.200", borderRadius: 2 }}>
             <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase" }}>
               Período
             </Typography>
             <Typography fontWeight={700}>t = {formatarNumero(calculos.periodo, 9)}</Typography>
           </Paper>

           <Paper elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "grey.200", borderRadius: 2 }}>
             <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase" }}>
               Taxa de parametrização
             </Typography>
             <Typography fontWeight={700}>{formatarPercentual(calculos.taxaParametrizacao)}</Typography>
           </Paper>

           <Paper elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "grey.200", borderRadius: 2 }}>
             <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase" }}>
               Divergência
             </Typography>
             <Typography fontWeight={700}>{formatarPercentual(calculos.divergencia)}</Typography>
           </Paper>
         </>
       ) : (
         <>
           <Paper elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "grey.200", borderRadius: 2 }}>
             <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase" }}>
               Taxa período
             </Typography>
             <Typography fontWeight={700}>R = {formatarNumero(calculos.taxaPeriodo, 6)}</Typography>
           </Paper>

           <Paper elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "grey.200", borderRadius: 2 }}>
             <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase" }}>
               Ciclo financeiro
             </Typography>
             <Typography fontWeight={700}>t = {formatarNumero(calculos.ciclo, 3)}</Typography>
           </Paper>

           <Paper elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "grey.200", borderRadius: 2 }}>
             <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase" }}>
               Crédito livre tratado
             </Typography>
             <Typography fontWeight={700}>{formatarNumero(creditoLivreTratado, 2)}</Typography>
           </Paper>

           <Paper elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "grey.200", borderRadius: 2 }}>
             <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase" }}>
               Desconto FitCard
             </Typography>
             <Typography fontWeight={700}>0,977</Typography>
           </Paper>
         </>
       )}
     </Box>

     <Typography variant="caption" color="text.secondary">
       Município de referência: {municipioNome}
     </Typography>
   </Box>
  );
}

function TooltipGrafico({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
   <Paper elevation={3} sx={{ p: 1.5, fontSize: 13, minWidth: 180 }}>
     <Typography variant="caption" fontWeight={700} display="block">
       {label}
     </Typography>
     {payload.map((item) => (
       <Box key={item.dataKey} sx={{ color: item.color }}>
         {item.name}: {formatarMoedaCurta(item.value)}
       </Box>
     ))}
   </Paper>
  );
}

export default function Parametrizacao() {
  const [municipio, setMunicipio] = useState(MUNICIPIO_PADRAO);
  const [diasPorPlano, setDiasPorPlano] = useState({
    gasolina: 7.31,
    etanol: 7.31,
    diesel: 30,
  });
  const [selic, setSelic] = useState(14.75);
  const [creditoLivre, setCreditoLivre] = useState(7.31);
  const [selicLoading, setSelicLoading] = useState(false);
  const [selicErro, setSelicErro] = useState(null);
  const [creditoLivreLoading, setCreditoLivreLoading] = useState(false);
  const [creditoLivreErro, setCreditoLivreErro] = useState(null);
  const [valoresPlano, setValoresPlano] = useState(() => criarEstadoValoresPlano());
  const [planoModal, setPlanoModal] = useState(null);

  const municipioAtual = useMemo(
   () => MUNICIPIOS.find((item) => item.ibge === municipio) ?? null,
   [municipio]
  );
  const creditoLivreTratado = tratarCreditoLivre(creditoLivre);
  const ciclo = 0.119;
  const descontoFitcard = 0.977;

  useEffect(() => {
   let ativo = true;

   const carregarIndicadores = async () => {
     setSelicLoading(true);
     setCreditoLivreLoading(true);
     setSelicErro(null);
     setCreditoLivreErro(null);

     try {
       const [selicRes, creditoRes] = await Promise.all([
         api.get("/parametrizacao/serie/432?nome=SELIC"),
         api.get("/parametrizacao/serie/20635?nome=CRÉDITO LIVRE (%)"),
       ]);

       if (!ativo) return;

       setSelic(Number(selicRes.data.valor ?? 0));
       setCreditoLivre(Number(creditoRes.data.valor ?? 0));
     } catch {
       if (!ativo) return;
       setSelicErro("Não foi possível carregar a SELIC do BCB.");
       setCreditoLivreErro("Não foi possível carregar o crédito livre do BCB.");
     } finally {
       if (ativo) {
         setSelicLoading(false);
         setCreditoLivreLoading(false);
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

   const carregarValores = async () => {
     setValoresPlano((prev) => {
       const next = { ...prev };
       PLANOS.forEach((plano) => {
         next[plano.key] = { ...next[plano.key], loading: true, erro: null };
       });
       return next;
     });

     const resultados = await Promise.all(
       PLANOS.map(async (plano) => {
         try {
           const res = await api.get(`/dashboard?tipoCombustivel=${plano.combustivelId}&codigoIBGE=${municipio}`);
           return {
             key: plano.key,
             valor: Number(res.data?.metricas?.mediaAtual ?? 0),
             historico: Array.isArray(res.data?.historico) ? res.data.historico : [],
             erro: null,
           };
         } catch {
           return {
             key: plano.key,
             valor: 0,
             historico: [],
             erro: `Não foi possível carregar ${plano.titulo.toLowerCase()}.`,
           };
         }
       })
     );

     if (!ativo) return;

     setValoresPlano((prev) => {
       const next = { ...prev };
       resultados.forEach((item) => {
         next[item.key] = {
           valor: item.valor,
           historico: item.historico,
           loading: false,
           erro: item.erro,
         };
       });
       return next;
     });
   };

   carregarValores();

   return () => {
     ativo = false;
   };
  }, [municipio]);

  const calcularPlano = (plano, valorVistaBase, prazoDias) => {
   if (plano.key === "diesel") {
     return calcularDieselExcel({
       valorVistaBase,
       selic,
       creditoLivreTratado,
       prazoDias,
       divergenciaBase: plano.divergenciaBase,
     });
   }

   return calcularPythonFitcard({
     valorVistaBase,
     selic,
     prazoDias,
     ciclo,
     descontoFitcard,
   });
  };

  const abrirModal = (plano) => setPlanoModal(plano);
  const planoModalAtual = planoModal ? PLANOS.find((item) => item.key === planoModal) : null;
  const prazoModal = planoModalAtual
   ? Number(diasPorPlano[planoModalAtual.key] ?? (planoModalAtual.key === "diesel" ? 30 : 7.31)) || 0
   : 0;
  const calculosModal = planoModalAtual
   ? calcularPlano(planoModalAtual, Number(valoresPlano[planoModalAtual.key]?.valor ?? 0), prazoModal)
   : null;
  const dadosGraficoModal = useMemo(() => {
   const historicoModal = planoModalAtual ? (valoresPlano[planoModalAtual.key]?.historico || []) : [];
    if (!planoModalAtual || historicoModal.length === 0) return [];

    const prazoDias = Number(diasPorPlano[planoModalAtual.key] ?? (planoModalAtual.key === "diesel" ? 30 : 7.31)) || 0;

    return historicoModal.map((item) => {
      const valorVista = Number(item.media ?? 0);
      const serie = calcularSeriePlano(
        planoModalAtual,
        valorVista,
        prazoDias,
        selic,
        creditoLivreTratado,
        ciclo,
        descontoFitcard
      );

      return {
        data: item.data,
        valorVista,
        precoMaximoPermitido: serie.valorMaximoPermitido,
        precoFitcard: serie.precoFitcard,
      };
    });
  }, [planoModalAtual, valoresPlano, diasPorPlano, selic, creditoLivreTratado, ciclo, descontoFitcard]);

  return (
   <Box sx={{ mt: 2.5, display: "grid", gap: 3 }}>
     {(selicErro || creditoLivreErro) && (
       <Box sx={{ display: "grid", gap: 1 }}>
         {selicErro && <Alert severity="warning">{selicErro}</Alert>}
         {creditoLivreErro && <Alert severity="warning">{creditoLivreErro}</Alert>}
       </Box>
     )}

     {(selicLoading || creditoLivreLoading) && (
       <Box sx={{ display: "flex", justifyContent: "center" }}>
         <CircularProgress size={20} />
       </Box>
     )}

     <Box
       sx={{
         p: 2,
         borderRadius: 4,
         background: "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(245,249,255,0.96) 100%)",
         border: "1px solid",
         borderColor: "rgba(41,77,128,0.12)",
         boxShadow: "0 12px 30px rgba(41,77,128,0.08)",
       }}
     >
       <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(3, 1fr)" }, gap: 2 }}>
       {PLANOS.map((plano) => {
         const valorBase = Number(valoresPlano[plano.key]?.valor ?? 0);
         const prazoDias = Number(diasPorPlano[plano.key] ?? (plano.key === "diesel" ? 30 : 7.31)) || 0;
         const calculos = calcularPlano(plano, valorBase, prazoDias);
         const loading = valoresPlano[plano.key]?.loading;
         const erro = valoresPlano[plano.key]?.erro;
         const valorReferencia = formatarMoeda(valorBase);

         return (
           <Paper
             key={plano.key}
             elevation={0}
             sx={{
               p: 2,
               borderRadius: 3,
               border: "1px solid",
               borderColor: "grey.200",
               display: "grid",
               gap: 1.5,
             }}
           >
             <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
               <Box>
                 <Typography variant="subtitle1" fontWeight={800}>
                   {plano.titulo}
                 </Typography>
                 <Typography variant="caption" color="text.secondary">
                   {municipioAtual?.nome || "Município"}
                 </Typography>
               </Box>
               <Chip label={plano.key === "diesel" ? "Fitcard" : "Referência"} size="small" variant="outlined" />
             </Box>

             <BlocoFiltros
               municipio={municipio}
               dias={prazoDias}
               selic={selic}
               creditoLivre={creditoLivre}
               onMunicipioChange={setMunicipio}
               onDiasChange={(valor) => setDiasPorPlano((prev) => ({ ...prev, [plano.key]: valor }))}
               onSelicChange={setSelic}
               onCreditoLivreChange={setCreditoLivre}
             />

             <Box sx={{ display: "grid", gap: 1.25, mt: 0.5 }}>
               <MetricCard
                 titulo="Valor médio declarado"
                 valor={valorReferencia}
                 subtitulo={`${municipioAtual?.nome || "Município"} · ${plano.titulo}`}
                 cor={plano.cor}
                 loading={loading}
                 error={erro}
               />
               <MetricCard
                 titulo={plano.key === "diesel" ? "Valor máximo aceitável Fitcard" : "Preço máximo permitido"}
                 valor={formatarMoeda(calculos.precoMaximoPermitido)}
                 subtitulo={plano.key === "diesel" ? `t = ${formatarNumero(calculos.periodo, 9)}` : `ciclo: ${formatarNumero(calculos.ciclo, 3)}`}
                 cor="#2e7d32"
               />
               <MetricCard
                 titulo="Preço FitCard"
                 valor={formatarMoeda(calculos.precoFitcard)}
                 subtitulo={plano.key === "diesel" ? `coeficiente: ${formatarNumero(calculos.coeficienteCorrecao, 9)}` : "Valor final truncado em 2 casas"}
                 cor="#f57c00"
               />
               <MetricCard
                 titulo={plano.key === "diesel" ? "Coeficiente de correção" : "Fator de correção"}
                 valor={plano.key === "diesel" ? formatarNumero(calculos.coeficienteCorrecao, 9) : formatarNumero(calculos.fatorCorrecao, 4)}
                 subtitulo={plano.key === "diesel" ? `taxa absoluta: ${formatarNumero(calculos.taxaAbsoluta, 9)}` : `taxa período: ${formatarNumero(calculos.taxaPeriodo, 6)}`}
                 cor="#c62828"
               />
             </Box>

             <Button
               variant="outlined"
               startIcon={<InfoOutlinedIcon fontSize="small" />}
               onClick={() => abrirModal(plano.key)}
               sx={{ justifySelf: "start" }}
             >
               Como o cálculo funciona
             </Button>
           </Paper>
         );
       })}
       </Box>
     </Box>

     <Dialog open={Boolean(planoModalAtual)} onClose={() => setPlanoModal(null)} maxWidth="md" fullWidth>
       <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
         <InfoOutlinedIcon color="primary" />
         Como o cálculo funciona — {planoModalAtual?.titulo}
       </DialogTitle>
       <DialogContent dividers>
         {planoModalAtual && calculosModal && (
           <Box sx={{ display: "grid", gap: 2.5 }}>
             <DetalhesCalculo
               plano={planoModalAtual}
               calculos={calculosModal}
               municipioNome={municipioAtual?.nome || "Município"}
               creditoLivreTratado={creditoLivreTratado}
             />

             <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "grey.200", borderRadius: 3 }}>
               <Typography variant="subtitle1" fontWeight={800} gutterBottom>
                 Variação de preços — últimos 30 dias
               </Typography>
               <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                 Valor médio declarado, preço máximo permitido, preço Fitcard e fator de correção.
               </Typography>
               {dadosGraficoModal.length === 0 ? (
                 <Typography variant="body2" color="text.secondary">
                   Sem dados suficientes para montar o gráfico.
                 </Typography>
               ) : (
                 <Box sx={{ width: "100%", height: 320 }}>
                   <ResponsiveContainer width="100%" height="100%">
                       <LineChart data={dadosGraficoModal} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                       <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                       <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                       <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${Number(v).toFixed(2)}`} />
                       <RechartsTooltip content={<TooltipGrafico />} />
                       <Legend />
                       <Line yAxisId="left" type="monotone" dataKey="valorVista" name="Valor médio declarado" stroke="#294D80" strokeWidth={2} dot={false} />
                       <Line yAxisId="left" type="monotone" dataKey="precoMaximoPermitido" name="Preço máximo permitido" stroke="#2e7d32" strokeWidth={2} dot={false} />
                       <Line yAxisId="left" type="monotone" dataKey="precoFitcard" name="Preço Fitcard" stroke="#f57c00" strokeWidth={2} dot={false} />
                     </LineChart>
                   </ResponsiveContainer>
                 </Box>
               )}
             </Paper>
           </Box>
         )}
       </DialogContent>
       <DialogActions>
         <Button onClick={() => setPlanoModal(null)}>Fechar</Button>
       </DialogActions>
     </Dialog>
   </Box>
  );
}