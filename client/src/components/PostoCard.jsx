import { useState } from "react";
import {
  Accordion, AccordionSummary, AccordionDetails,
  Typography, Box, Chip, Link, IconButton, Tooltip,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LocalGasStationIcon from "@mui/icons-material/LocalGasStation";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import HistoryIcon from "@mui/icons-material/History";
import HistoricoModal from "./HistoricoModal";
import { isCredenciado } from "../constants/credenciados";

const formatarMoeda = (valor) =>
  valor != null ? valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const formatarData = (data) =>
  data ? new Date(data).toLocaleDateString("pt-BR") : "—";

const gerarLinkMaps = (item) => {
  const e = item.estabelecimento.endereco;
  if (e.latitude && e.longitude && e.latitude !== 0 && e.longitude !== 0) {
    return `https://www.google.com/maps?q=${e.latitude},${e.longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${e.nomeLogradouro || ""} ${e.numeroImovel || ""}, ${e.bairro || ""}, ${e.cep || ""}`
  )}`;
};

function BadgeVariacao({ variacao }) {
  if (!variacao || Math.abs(variacao.pct) < 0.5) return null;
  const subiu = variacao.diff > 0;
  const cor = subiu ? "#c62828" : "#2e7d32";
  const bg = subiu ? "#ffebee" : "#e8f5e9";
  const Icon = subiu ? TrendingUpIcon : TrendingDownIcon;
  return (
    <Box
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, px: 0.8, py: 0.2,
        borderRadius: 1, backgroundColor: bg, color: cor, fontSize: 11, fontWeight: 700, ml: 0.5 }}
      title={`Anterior: ${formatarMoeda(variacao.anterior)}`}
    >
      <Icon sx={{ fontSize: 13 }} />
      {variacao.diff > 0 ? "+" : ""}{variacao.pct}%
    </Box>
  );
}

export default function PostoCard({ item, tipoCombustivel = 1 }) {
  const { estabelecimento, produto, variacao } = item;
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const credenciado = isCredenciado(estabelecimento.cnpj);

  const postoNome = estabelecimento.nomeFantasia || estabelecimento.razaoSocial || "Posto sem nome";
  const endereco = estabelecimento.endereco;

  return (
    <>
      <Accordion
        disableGutters
        elevation={0}
        sx={{
          border: "1px solid", borderColor: "grey.200",
          borderRadius: "12px !important", mb: 1,
          "&:before": { display: "none" },
          "&:hover": { borderColor: "primary.light", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" },
          transition: "box-shadow 0.2s ease, border-color 0.2s ease",
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%" }}>
            <LocalGasStationIcon color="primary" fontSize="small" />

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography fontWeight={600} noWrap>{postoNome}</Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5, alignItems: "center" }}>
                <Chip label={`Venda: ${formatarMoeda(produto.venda.valorVenda)}`} size="small" color="primary" variant="outlined" />
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <Chip label={`Declarado: ${formatarMoeda(produto.venda.valorDeclarado)}`} size="small" variant="outlined" />
                </Box>
                {estabelecimento.bandeira && (
                  <Chip label={estabelecimento.bandeira} size="small" color="secondary" variant="outlined" />
                )}
                <Chip
                  label={credenciado ? "Credenciado" : "Não credenciado"}
                  size="small"
                  sx={{
                    fontWeight: 600,
                    backgroundColor: credenciado ? "#e8f5e9" : "#fff3e0",
                    color: credenciado ? "#2e7d32" : "#e65100",
                    border: "1px solid",
                    borderColor: credenciado ? "#a5d6a7" : "#ffcc80",
                  }}
                />
                <BadgeVariacao variacao={variacao} />
              </Box>
            </Box>

            {/* BOTÃO HISTÓRICO */}
            <Tooltip title="Ver histórico de preços">
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); setHistoricoOpen(true); }}
                sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
              >
                <HistoryIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </AccordionSummary>

        <AccordionDetails sx={{ pt: 0 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1, fontSize: 14 }}>
            <Detail label="Produto" value={produto.descricao} />
            <Detail label="Data" value={formatarData(produto.venda.dataVenda)} />
            <Detail label="Telefone" value={estabelecimento.telefone || "Não informado"} />
            <Detail label="CNPJ" value={estabelecimento.cnpj} />
            {variacao && Math.abs(variacao.pct) >= 0.5 && (
              <Detail
                label="Preço anterior"
                value={`${formatarMoeda(variacao.anterior)} (${variacao.diff > 0 ? "+" : ""}${variacao.pct}%)`}
              />
            )}
            <Box sx={{ gridColumn: { sm: "1 / -1" } }}>
              <Typography variant="body2" color="text.secondary" component="span">
                <strong>Endereço: </strong>
                <Link href={gerarLinkMaps(item)} target="_blank" rel="noreferrer" underline="hover">
                  {endereco.nomeLogradouro}, {endereco.numeroImovel} – {endereco.bairro}
                </Link>
              </Typography>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      <HistoricoModal
        open={historicoOpen}
        onClose={() => setHistoricoOpen(false)}
        cnpj={estabelecimento.cnpj}
        tipoCombustivel={tipoCombustivel}
        nomePostoFallback={postoNome}
      />
    </>
  );
}

function Detail({ label, value }) {
  return (
    <Typography variant="body2" color="text.secondary">
      <strong>{label}: </strong>{value || "—"}
    </Typography>
  );
}
