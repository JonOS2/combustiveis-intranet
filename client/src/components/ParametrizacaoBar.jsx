import {
  Box,
  Paper,
  Typography,
  TextField,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import MUNICIPIOS from "../constants/municipios";

const PLANOS = {
  gasolina: { titulo: 'Gasolina Comum', combustivelId: 1, divergenciaBase: 0.07 },
  etanol: { titulo: 'Etanol', combustivelId: 3, divergenciaBase: 0.07 },
  diesel: { titulo: 'Diesel S10', combustivelId: 5, divergenciaBase: 0.0543 },
};

function formatarPercentual(valor, casas = 2) {
  const numero = Number(valor || 0) * 100;
  return `${numero.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

function formatarNumero(valor, casas = 2) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export default function ParametrizacaoBar({
  municipio,
  dias,
  selic,
  creditoLivre,
  planoAtivo,
  onMunicipioChange,
  onDiasChange,
  onSelicChange,
  onCreditoLivreChange,
  onPlanoChange,
}) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "grey.200" }}>
      <Box sx={{ display: "grid", gap: 1.5 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" }, gap: 2, alignItems: "start" }}>
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
            label="Dias"
            size="small"
            type="number"
            value={dias}
            onChange={(e) => onDiasChange(Number(e.target.value))}
            inputProps={{ min: 1, step: 1 }}
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

        <Box sx={{ display: "grid", gap: 1 }}>
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={planoAtivo}
            onChange={(_, value) => {
              if (value) onPlanoChange(value);
            }}
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
              gap: 1,
              "& .MuiToggleButtonGroup-grouped": {
                border: "1px solid",
                borderColor: "grey.200",
                borderRadius: 2,
                textTransform: "none",
                alignItems: "flex-start",
                justifyContent: "center",
                px: 2,
                py: 1.5,
                minHeight: 74,
                backgroundColor: "#fff",
                color: "text.primary",
              },
              "& .MuiToggleButtonGroup-grouped.Mui-selected": {
                backgroundColor: "primary.main",
                color: "primary.contrastText",
                borderColor: "primary.main",
              },
            }}
          >
            {Object.entries(PLANOS).map(([key, plano]) => (
              <ToggleButton key={key} value={key}>
                <Box sx={{ textAlign: "left", width: "100%" }}>
                  <Typography fontWeight={800}>{plano.titulo}</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.85, display: "block", mt: 0.25 }}>
                    combustível {plano.combustivelId === 1 ? 'Gasolina' : plano.combustivelId === 3 ? 'Etanol' : 'Diesel'} · base {formatarPercentual(plano.divergenciaBase)}
                  </Typography>
                </Box>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>
    </Paper>
  );
}