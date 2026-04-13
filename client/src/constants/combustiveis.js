export const TIPOS_COMBUSTIVEL = [
  { value: 1, label: "Gasolina Comum" },
  { value: 2, label: "Gasolina Aditivada" },
  { value: 3, label: "Etanol" },
  { value: 4, label: "Diesel Comum" },
  { value: 5, label: "Diesel S10" },
  { value: 6, label: "GNV" },
  { value: 7, label: "Aditivado" },
];

export const OPCOES_DIAS = [
  { value: 1, label: "Último dia" },
  { value: 5, label: "Últimos 5 dias" },
  { value: 10, label: "Últimos 10 dias" },
];

export const OPCOES_ORDENACAO = [
  { value: "declarado", label: "Ordenar por Valor Declarado" },
  { value: "venda", label: "Ordenar por Valor de Venda" },
];

export const FILTROS_INICIAIS = {
  tipoCombustivel: 1,
  dias: 1,
  codigoIBGE: 2704302,
  ordenarPor: "declarado",
};