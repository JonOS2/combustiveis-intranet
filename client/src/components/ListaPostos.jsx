import { Box, Pagination, Alert, Skeleton } from "@mui/material";
import PostoCard from "./PostoCard";

function PostoSkeleton() {
  return (
    <Box sx={{ border: "1px solid", borderColor: "grey.200", borderRadius: "12px", p: 2, mb: 1 }}>
      <Skeleton variant="text" width="40%" height={24} />
      <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
        <Skeleton variant="rounded" width={120} height={24} />
        <Skeleton variant="rounded" width={120} height={24} />
      </Box>
    </Box>
  );
}

export default function ListaPostos({ dados, loading, pagina, totalPaginas, filtroAtivo, onPageChange, tipoCombustivel = 1 }) {
  if (loading) {
    return (
      <Box sx={{ mt: 2 }}>
        {Array.from({ length: 5 }).map((_, i) => <PostoSkeleton key={i} />)}
      </Box>
    );
  }

  if (!loading && dados.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        Nenhum posto encontrado. Tente ampliar o período ou mudar os filtros.
      </Alert>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      {dados.map((item) => (
        <PostoCard key={item.estabelecimento.cnpj} item={item} tipoCombustivel={tipoCombustivel} />
      ))}
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
