import { useState } from "react";
import axios from "axios";
import "./App.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAnglesRight, faAnglesDown } from "@fortawesome/free-solid-svg-icons";

/* =========================
   API
========================= */
const api = axios.create({
  //baseURL: "http://localhost:3000/api"
  baseURL: "/api"
});

/* =========================
   MUNICÍPIOS DE ALAGOAS
========================= */
const municipiosAL = [
  { ibge: 2700102, nome: "Água Branca" },
  { ibge: 2700201, nome: "Anadia" },
  { ibge: 2700300, nome: "Arapiraca" },
  { ibge: 2700409, nome: "Atalaia" },
  { ibge: 2700508, nome: "Barra de Santo Antônio" },
  { ibge: 2700607, nome: "Barra de São Miguel" },
  { ibge: 2700706, nome: "Batalha" },
  { ibge: 2700805, nome: "Belém" },
  { ibge: 2700904, nome: "Belo Monte" },
  { ibge: 2701001, nome: "Boca da Mata" },
  { ibge: 2701100, nome: "Branquinha" },
  { ibge: 2701209, nome: "Cacimbinhas" },
  { ibge: 2701308, nome: "Cajueiro" },
  { ibge: 2701357, nome: "Campestre" },
  { ibge: 2701407, nome: "Campo Alegre" },
  { ibge: 2701506, nome: "Campo Grande" },
  { ibge: 2701605, nome: "Canapi" },
  { ibge: 2701704, nome: "Capela" },
  { ibge: 2701803, nome: "Carneiros" },
  { ibge: 2701902, nome: "Chã Preta" },
  { ibge: 2702009, nome: "Coité do Nóia" },
  { ibge: 2702108, nome: "Colônia Leopoldina" },
  { ibge: 2702207, nome: "Coqueiro Seco" },
  { ibge: 2702306, nome: "Coruripe" },
  { ibge: 2702355, nome: "Craíbas" },
  { ibge: 2702405, nome: "Delmiro Gouveia" },
  { ibge: 2702504, nome: "Dois Riachos" },
  { ibge: 2702553, nome: "Estrela de Alagoas" },
  { ibge: 2702603, nome: "Feira Grande" },
  { ibge: 2702702, nome: "Feliz Deserto" },
  { ibge: 2702801, nome: "Flexeiras" },
  { ibge: 2702900, nome: "Girau do Ponciano" },
  { ibge: 2703007, nome: "Ibateguara" },
  { ibge: 2703106, nome: "Igaci" },
  { ibge: 2703205, nome: "Igreja Nova" },
  { ibge: 2703304, nome: "Inhapi" },
  { ibge: 2703403, nome: "Jacaré dos Homens" },
  { ibge: 2703502, nome: "Jacuípe" },
  { ibge: 2703601, nome: "Japaratinga" },
  { ibge: 2703700, nome: "Jaramataia" },
  { ibge: 2703759, nome: "Jequiá da Praia" },
  { ibge: 2703809, nome: "Joaquim Gomes" },
  { ibge: 2703908, nome: "Jundiá" },
  { ibge: 2704005, nome: "Junqueiro" },
  { ibge: 2704104, nome: "Lagoa da Canoa" },
  { ibge: 2704203, nome: "Limoeiro de Anadia" },
  { ibge: 2704302, nome: "Maceió" },
  { ibge: 2704401, nome: "Major Isidoro" },
  { ibge: 2704500, nome: "Maragogi" },
  { ibge: 2704609, nome: "Maravilha" },
  { ibge: 2704708, nome: "Marechal Deodoro" },
  { ibge: 2704807, nome: "Maribondo" },
  { ibge: 2704906, nome: "Mar Vermelho" },
  { ibge: 2705002, nome: "Mata Grande" },
  { ibge: 2705101, nome: "Matriz de Camaragibe" },
  { ibge: 2705200, nome: "Messias" },
  { ibge: 2705309, nome: "Minador do Negrão" },
  { ibge: 2705408, nome: "Monteirópolis" },
  { ibge: 2705507, nome: "Murici" },
  { ibge: 2705606, nome: "Novo Lino" },
  { ibge: 2705705, nome: "Olho d'Água das Flores" },
  { ibge: 2705804, nome: "Olho d'Água do Casado" },
  { ibge: 2705903, nome: "Olho d'Água Grande" },
  { ibge: 2706000, nome: "Olivença" },
  { ibge: 2706109, nome: "Ouro Branco" },
  { ibge: 2706208, nome: "Palestina" },
  { ibge: 2706307, nome: "Palmeira dos Índios" },
  { ibge: 2706406, nome: "Pão de Açúcar" },
  { ibge: 2706422, nome: "Pariconha" },
  { ibge: 2706448, nome: "Paripueira" },
  { ibge: 2706505, nome: "Passo de Camaragibe" },
  { ibge: 2706604, nome: "Paulo Jacinto" },
  { ibge: 2706703, nome: "Penedo" },
  { ibge: 2706802, nome: "Piaçabuçu" },
  { ibge: 2706901, nome: "Pilar" },
  { ibge: 2707008, nome: "Pindoba" },
  { ibge: 2707107, nome: "Piranhas" },
  { ibge: 2707206, nome: "Poço das Trincheiras" },
  { ibge: 2707305, nome: "Porto Calvo" },
  { ibge: 2707404, nome: "Porto de Pedras" },
  { ibge: 2707503, nome: "Porto Real do Colégio" },
  { ibge: 2707602, nome: "Quebrangulo" },
  { ibge: 2707701, nome: "Rio Largo" },
  { ibge: 2707800, nome: "Roteiro" },
  { ibge: 2707909, nome: "Santa Luzia do Norte" },
  { ibge: 2708006, nome: "Santana do Ipanema" },
  { ibge: 2708105, nome: "Santana do Mundaú" },
  { ibge: 2708204, nome: "São Brás" },
  { ibge: 2708303, nome: "São José da Laje" },
  { ibge: 2708402, nome: "São José da Tapera" },
  { ibge: 2708501, nome: "São Luís do Quitunde" },
  { ibge: 2708600, nome: "São Miguel dos Campos" },
  { ibge: 2708709, nome: "São Miguel dos Milagres" },
  { ibge: 2708808, nome: "São Sebastião" },
  { ibge: 2708907, nome: "Satuba" },
  { ibge: 2708956, nome: "Senador Rui Palmeira" },
  { ibge: 2709004, nome: "Tanque d'Arca" },
  { ibge: 2709103, nome: "Taquarana" },
  { ibge: 2709152, nome: "Teotônio Vilela" },
  { ibge: 2709202, nome: "Traipu" },
  { ibge: 2709301, nome: "União dos Palmares" },
  { ibge: 2709400, nome: "Viçosa" },
];

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
function App() {
  const [loading, setLoading] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [dados, setDados] = useState([]);
  const [postoAberto, setPostoAberto] = useState(null);

  const [bairroFiltro, setBairroFiltro] = useState("");
  const [postoFiltro, setPostoFiltro] = useState("");
  const [mensagemAviso, setMensagemAviso] = useState("");

  const [filtros, setFiltros] = useState({
    tipoCombustivel: 1,
    dias: 1,
    codigoIBGE: 2704302,
    ordenarPor: 'declarado'
  });

  // 🔴 detecta se existe filtro ativo
  const filtroAtivo = bairroFiltro.trim() !== "" || postoFiltro.trim() !== "";

  const buscar = async (novaPagina = 1, diasOverride = null) => {
    setLoading(true);
    setMensagemAviso("");

    try {
      const diasUsado = diasOverride ?? filtros.dias;

      const res = await api.post("/combustivel", {
        ...filtros,
        dias: diasUsado,
        pagina: novaPagina,
      });

      const conteudo = res.data.conteudo || [];

      // 🔹 Se veio vazio e estamos buscando apenas 1 dia
      if (conteudo.length === 0 && diasUsado === 1) {
        setMensagemAviso(
          "⚠️ Nenhum registro encontrado no último dia. Mostrando dados dos últimos 5 dias.",
        );
        alert(
          "⚠️ Nenhum registro encontrado no último dia. Mostrando dados dos últimos 5 dias.",
        );
        // Atualiza filtro internamente
        setFiltros((prev) => ({ ...prev, dias: 5 }));

        // Faz nova busca automática com 5 dias
        return buscar(1, 5);
      }

      setDados(conteudo);
      setPagina(res.data.pagina);
      setTotalPaginas(res.data.totalPaginas);
    } catch {
      alert("Erro ao buscar dados");
    } finally {
      setLoading(false);
    }
  };

  const gerarLinkMaps = (item) => {
    const e = item.estabelecimento.endereco;
    if (e.latitude && e.longitude && e.latitude !== 0 && e.longitude !== 0) {
      return `https://www.google.com/maps?q=${e.latitude},${e.longitude}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${e.nomeLogradouro || ""} ${e.numeroImovel || ""}, ${e.bairro || ""}, ${e.cep || ""}`,
    )}`;
  };

  const dadosFiltrados = dados
    .filter((item) => {
      const bairro = normalizar(item.estabelecimento.endereco.bairro);
      const posto = normalizar(
        item.estabelecimento.nomeFantasia || item.estabelecimento.razaoSocial,
      );
      return (
        (!bairroFiltro || bairro.includes(normalizar(bairroFiltro))) &&
        (!postoFiltro || posto.includes(normalizar(postoFiltro)))
      );
    })
    .sort(
      (a, b) =>
        a.produto.venda.valorDeclarado -
        b.produto.venda.valorDeclarado,
    );

  const exportarPaginaAtual = () => {
    exportarExcel("pagina");
  };

  const exportarTudoMunicipio = () => {
    if (!window.confirm("Isso pode demorar alguns segundos. Deseja continuar?"))
      return;
    exportarExcel("tudo");
  };

  const exportarExcel = async (modo = "pagina") => {
    try {
      const response = await api.post(
        "/combustivel/excel",
        {
          ...filtros,
          pagina,
          modo,
        },
        {
          responseType: "blob",
        },
      );

      const disposition = response.headers["content-disposition"];
      let nomeArquivo = "combustiveis.xlsx";

      if (disposition) {
        const match = disposition.match(/filename="(.+)"/);
        if (match?.[1]) {
          nomeArquivo = match[1];
        }
      }

      const url = window.URL.createObjectURL(
        new Blob([response.data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );

      const link = document.createElement("a");
      link.href = url;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Erro ao exportar Excel");
    }
  };

  return (
    <div className="card wide">
      <h2>⛽ Pesquisa de Combustíveis – AL</h2>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <select
          value={filtros.tipoCombustivel}
          onChange={(e) =>
            setFiltros({ ...filtros, tipoCombustivel: +e.target.value })
          }
        >
          <option value={1}>Gasolina Comum</option>
          <option value={2}>Gasolina Aditivada</option>
          <option value={3}>Etanol</option>
          <option value={4}>Diesel Comum</option>
          <option value={5}>Diesel S10</option>
          <option value={6}>GNV</option>
          <option value={7}>Diesel S10 Aditivada</option>
        </select>

        <select
          value={filtros.dias}
          onChange={(e) => setFiltros({ ...filtros, dias: +e.target.value })}
        >
          <option value={1}>Último dia</option>
          <option value={5}>Últimos 5 dias</option>
          <option value={10}>Últimos 10 dias</option>
        </select>

        <select
          value={filtros.codigoIBGE}
          onChange={(e) =>
            setFiltros({ ...filtros, codigoIBGE: +e.target.value })
          }
        >
          {municipiosAL.map((m) => (
            <option key={m.ibge} value={m.ibge}>
              {m.nome}
            </option>
          ))}
        </select>

        <select
          value={filtros.ordenarPor}
          onChange={(e) => {
            const novoValor = e.target.value;

            setFiltros({ ...filtros, ordenarPor: novoValor });

            buscar(1); // 🔥 força nova busca
          }}
        >
          <option value="declarado">Ordenar por Valor Declarado</option>
          <option value="venda">Ordenar por Valor de Venda</option>
        </select>

        <input
          placeholder="Filtrar bairro"
          value={bairroFiltro}
          onChange={(e) => {
            setBairroFiltro(e.target.value);
            setPagina(1); // 🔴 força página 1 ao filtrar
          }}
        />

        <input
          placeholder="Buscar posto"
          value={postoFiltro}
          onChange={(e) => {
            setPostoFiltro(e.target.value);
            setPagina(1); // 🔴 força página 1 ao filtrar
          }}
        />

        <button onClick={() => buscar(1)}>🔍 Buscar</button>
        <button className="btn-export" onClick={exportarPaginaAtual}>
          Exportar página atual
        </button>
        <button className="btn-export" onClick={exportarTudoMunicipio}>
          Exportar TODO município
        </button>
      </div>

      {mensagemAviso && <div className="aviso">{mensagemAviso}</div>}

      {loading && <p>Carregando...</p>}

      {!loading &&
        dadosFiltrados.map((item, i) => {
          const aberto = postoAberto === i;
          const postoNome =
            item.estabelecimento.nomeFantasia ||
            item.estabelecimento.razaoSocial;

          return (
            <div key={i} className={`posto-card ${aberto ? "aberto" : ""}`}>
              <div
                className="posto-header"
                onClick={() => setPostoAberto(aberto ? null : i)}
              >
                <span className="seta">
                  {aberto ? (
                    <FontAwesomeIcon icon={faAnglesDown} />
                  ) : (
                    <FontAwesomeIcon icon={faAnglesRight} />
                  )}
                </span>

                <div className="posto-info">
                  <strong>{postoNome}</strong>
                  <div className="resumo">
                    Venda: R$
                    {item.produto.venda.valorVenda.toFixed(2)} | Declarado: R$
                    {item.produto.venda.valorDeclarado.toFixed(2)} | Bandeira:{" "}
                    {item.estabelecimento.bandeira || "—"}
                  </div>
                </div>
              </div>

              {aberto && (
                <div className="posto-detalhes">
                  <p>
                    <strong>Produto:</strong> {item.produto.descricao}
                  </p>
                  <p>
                    <strong>Data:</strong>{" "}
                    {new Date(item.produto.venda.dataVenda).toLocaleDateString(
                      "pt-BR",
                    )}
                  </p>
                  <p>
                    <strong>Telefone:</strong>{" "}
                    {item.estabelecimento.telefone || "Não informado"}
                  </p>
                  <p>
                    <strong>CNPJ:</strong> {item.estabelecimento.cnpj}
                  </p>
                  <p>
                    <strong>Endereço:</strong>{" "}
                    <a
                      href={gerarLinkMaps(item)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.estabelecimento.endereco.nomeLogradouro},{" "}
                      {item.estabelecimento.endereco.numeroImovel} –{" "}
                      {item.estabelecimento.endereco.bairro}
                    </a>
                  </p>
                </div>
              )}
            </div>
          );
        })}

      {/* 🔴 paginação só aparece se NÃO houver filtro */}
      {!filtroAtivo && totalPaginas > 1 && (
        <div className="pagination">
          <button
            disabled={pagina === 1 || loading}
            onClick={() => buscar(pagina - 1)}
          >
            ◀ Anterior
          </button>
          <span>
            Página <strong>{pagina}</strong> de <strong>{totalPaginas}</strong>
          </span>
          <button
            disabled={pagina === totalPaginas || loading}
            onClick={() => buscar(pagina + 1)}
          >
            Próxima ▶
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
