import {
  Box,
  TextField,
  MenuItem,
  Button,
  InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import municipiosAL from "../constants/municipios";
import {
  TIPOS_COMBUSTIVEL,
  OPCOES_DIAS,
  OPCOES_ORDENACAO,
} from "../constants/combustiveis";

export default function FiltrosBar({
  filtros,
  bandeiraFiltro,
  postoFiltro,
  bandeirasDisponiveis,
  loading,
  onFiltroChange,
  onBandeiraChange,
  onPostoChange,
  onBuscar,
}) {
  const handleOrdenacaoChange = (e) => {
    onFiltroChange("ordenarPor", e.target.value);
    onBuscar(1);
  };

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "1fr 1fr",
          md: "repeat(3, 1fr)",
        },
        gap: 1.5,
        mb: 2,
      }}
    >
      {/* TIPO DE COMBUSTÍVEL */}
      <TextField
        select
        label="Combustível"
        size="small"
        value={filtros.tipoCombustivel}
        onChange={(e) => onFiltroChange("tipoCombustivel", +e.target.value)}
      >
        {TIPOS_COMBUSTIVEL.map((op) => (
          <MenuItem key={op.value} value={op.value}>
            {op.label}
          </MenuItem>
        ))}
      </TextField>

      {/* PERÍODO */}
      <TextField
        select
        label="Período"
        size="small"
        value={filtros.dias}
        onChange={(e) => onFiltroChange("dias", +e.target.value)}
      >
        {OPCOES_DIAS.map((op) => (
          <MenuItem key={op.value} value={op.value}>
            {op.label}
          </MenuItem>
        ))}
      </TextField>

      {/* MUNICÍPIO */}
      <TextField
        select
        label="Município"
        size="small"
        value={filtros.codigoIBGE}
        onChange={(e) => onFiltroChange("codigoIBGE", +e.target.value)}
      >
        {municipiosAL.map((m) => (
          <MenuItem key={m.ibge} value={m.ibge}>
            {m.nome}
          </MenuItem>
        ))}
      </TextField>

      {/* ORDENAÇÃO */}
      <TextField
        select
        label="Ordenar por"
        size="small"
        value={filtros.ordenarPor}
        onChange={handleOrdenacaoChange}
      >
        {OPCOES_ORDENACAO.map((op) => (
          <MenuItem key={op.value} value={op.value}>
            {op.label}
          </MenuItem>
        ))}
      </TextField>

      {/* FILTRO DE BANDEIRA */}
      <TextField
        select
        label="Filtrar por bandeira"
        size="small"
        value={bandeiraFiltro}
        onChange={(e) => onBandeiraChange(e.target.value)}
        disabled={bandeirasDisponiveis.length === 0}
      >
        <MenuItem value="">Todas as bandeiras</MenuItem>
        {bandeirasDisponiveis.map((b) => (
          <MenuItem key={b} value={b}>
            {b}
          </MenuItem>
        ))}
      </TextField>

      {/* FILTRO DE POSTO */}
      <TextField
        label="Buscar posto"
        size="small"
        value={postoFiltro}
        onChange={(e) => onPostoChange(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {/* BOTÃO BUSCAR */}
      <Button
        variant="contained"
        onClick={() => onBuscar(1)}
        disabled={loading}
        startIcon={<SearchIcon />}
        sx={{ gridColumn: { xs: "1fr", sm: "span 2", md: "span 3" } }}
      >
        {loading ? "Buscando..." : "Buscar"}
      </Button>
    </Box>
  );
}
