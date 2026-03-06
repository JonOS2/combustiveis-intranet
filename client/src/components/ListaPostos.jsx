import { Box, Typography, Pagination, Alert, Skeleton } from "@mui/material";
import PostoCard from "./PostoCard";

/* =========================
   SKELETONS DE LOADING
   (melhor UX do que "Carregando...")
========================= */
function PostoSkeleton() {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "grey.200",
        borderRadius: "12px",
        p: 2,
        mb: 1,
      }}
    >
      <Skeleton variant="text" width="40%" height={24} />
      <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
        <Skeleton variant="rounded" width={120} height={24} />
        <Skeleton variant="rounded" width={120} height={24} />
      </Box>
    </Box>
  );
}

/* =========================
   COMPONENTE PRINCIPAL
========================= */
export default function ListaPostos({
  dados,
  loading,
  pagina,
  totalPaginas,
  filtroAtivo,
  onPageChange,
}) {
  // Loading: mostra 5 skeletons
  if (loading) {
    return (
      <Box sx={{ mt: 2 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <PostoSkeleton key={i} />
        ))}
      </Box>
    );
  }

  // Nenhum resultado
  if (!loading && dados.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        Nenhum posto encontrado. Tente ampliar o período ou mudar os filtros.
      </Alert>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      {/* LISTA DE CARDS */}
      {/* ✅ BUG CORRIGIDO: key agora usa cnpj ao invés do índice */}
      {dados.map((item) => (
        <PostoCard key={item.estabelecimento.cnpj} item={item} />
      ))}

      {/* PAGINAÇÃO — só aparece se não houver filtro ativo */}
      {!filtroAtivo && totalPaginas > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
          <Pagination
            count={totalPaginas}
            page={pagina}
            onChange={(_, novaPagina) => onPageChange(novaPagina)}
            color="primary"
            shape="rounded"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Box>
  );
}
