import { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { Box, Typography, Paper, Chip, CircularProgress, Alert } from "@mui/material";
import "leaflet/dist/leaflet.css";
import api from "../api/combustivel";

const fmt = (v) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

// Retorna cor do pin baseado na posição do preço entre min e max
const corPin = (valor, min, max) => {
  if (!valor || min === max) return "#9e9e9e";
  const ratio = (valor - min) / (max - min);
  if (ratio <= 0.33) return "#2e7d32"; // verde — barato
  if (ratio <= 0.66) return "#f57c00"; // laranja — médio
  return "#c62828";                    // vermelho — caro
};

const CENTRO_MACEIO = [-9.6658, -35.7350];

export default function MapaPostos({ tipoCombustivel = 1, codigoIBGE = 2704302 }) {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const buscar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await api.get(`/combustivel/mapa?tipoCombustivel=${tipoCombustivel}&codigoIBGE=${codigoIBGE}`);
      setDados(res.data);
    } catch {
      setErro("Erro ao carregar dados do mapa.");
    } finally {
      setLoading(false);
    }
  }, [tipoCombustivel, codigoIBGE]);

  useEffect(() => { buscar(); }, [buscar]);

  return (
    <Box>
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}

      {!loading && dados && (
        <>
          {/* LEGENDA + STATS */}
          <Paper elevation={0} sx={{ p: 2, mb: 2, border: "1px solid", borderColor: "grey.200", borderRadius: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
              <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
                {[
                  { cor: "#2e7d32", label: "Abaixo da Média" },
                  { cor: "#f57c00", label: "Na Média" },
                  { cor: "#c62828", label: "Acima da Média" },
                  { cor: "#9e9e9e", label: "Sem preço" },
                ].map(({ cor, label }) => (
                  <Box key={label} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: cor }} />
                    <Typography variant="caption">{label}</Typography>
                  </Box>
                ))}
              </Box>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                <Chip size="small" label={`${dados.stats.total} postos`} variant="outlined" />
                <Chip size="small" label={`Mín: ${fmt(dados.stats.minPreco)}`} sx={{ color: "#2e7d32", borderColor: "#2e7d32" }} variant="outlined" />
                <Chip size="small" label={`Média: ${fmt(dados.stats.mediaPreco)}`} sx={{ color: "#f57c00", borderColor: "#f57c00" }} variant="outlined" />
                <Chip size="small" label={`Máx: ${fmt(dados.stats.maxPreco)}`} sx={{ color: "#c62828", borderColor: "#c62828" }} variant="outlined" />
              </Box>
            </Box>
          </Paper>

          {/* MAPA */}
          <Paper elevation={0} sx={{ border: "1px solid", borderColor: "grey.200", borderRadius: 2, overflow: "hidden" }}>
            <MapContainer
              center={CENTRO_MACEIO}
              zoom={12}
              style={{ height: "520px", width: "100%" }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {dados.postos.map((posto) => (
                <CircleMarker
                  key={posto.cnpj}
                  center={[posto.latitude, posto.longitude]}
                  radius={8}
                  pathOptions={{
                    fillColor: corPin(posto.valorDeclarado, dados.stats.minPreco, dados.stats.maxPreco),
                    fillOpacity: 0.85,
                    color: "#fff",
                    weight: 1.5,
                  }}
                >
                  <Popup minWidth={200}>
                    <Box sx={{ fontSize: 13 }}>
                      <Typography fontWeight={700} variant="body2" gutterBottom>
                        {posto.nome}
                      </Typography>
                      {posto.bandeira && (
                        <Chip label={posto.bandeira} size="small" variant="outlined" sx={{ mb: 0.5, fontSize: 11 }} />
                      )}
                      <Box sx={{ mt: 0.5 }}>
                        <strong>Declarado:</strong> {fmt(posto.valorDeclarado)}
                      </Box>
                      <Box>
                        <strong>Venda:</strong> {fmt(posto.valorVenda)}
                      </Box>
                      <Box sx={{ color: "text.secondary", mt: 0.5, fontSize: 12 }}>
                        {posto.bairro && <div>{posto.bairro}</div>}
                        {posto.endereco && <div>{posto.endereco}</div>}
                      </Box>
                      <Box sx={{ color: "text.secondary", fontSize: 11, mt: 0.5 }}>
                        {new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(posto.dataVenda))}
                      </Box>
                    </Box>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </Paper>

          {dados.stats.total === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Nenhum posto com coordenadas encontrado para este município e período.
            </Alert>
          )}
        </>
      )}
    </Box>
  );
}
