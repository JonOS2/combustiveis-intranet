selic: float = 14.75
credito_livre: float = 6.25
preco_vista: float = 6.89


def tratar_credito_livre (credito_livre: float) -> float:
    """
    Aplica as regras de tratamento para a Taxa de Crédito Livre.

    Regras:

    = 0 → usa 1 (neutro)

    <0 → usa o valor absoluto

    > 0 → usa normalmente

    Retorna:

    Valor tratado (float)
    """
    if credito_livre == 0:

        return 1.0

    elif credito_livre < 0:

        return abs(credito_livre)

    else:

        return credito_livre


def calcular_fator_correcao(selic: float, prazo_dias: float = 7.31, ciclo: float = 0.119) -> float:
    """
    Calcula o fator de correção monetária com base na Selic.

    Parâmetros:

    selic

    : Taxa Selic em % ao ano (ex: 10.5 para 10,5%) prazo_dias: Prazo médio de recebimento em dias úteis (padrão: 7,31)

    ciclo

    : Ciclo financeiro em anos (padrão: 0,119 43 dias)

    Retorna:

    Fator de correção (float)
    """

    taxa_periodo = (selic / 100) * (prazo_dias / 100) 
    fator = (1 + taxa_periodo) ** (1 / ciclo)

    return fator


def calcular_precos (preco_vista: float, fator_correcao: float, desconto_fitcard: float = 0.977):

    """
    Calcula o preço ajustado para Fit Card e o preço máximo permitido.

    Parâmetros:

    preco_vista

    : Preço original à vista (R$)

    fator_correcao

    : Fator calculado pela Selic

    desconto_fitcard: Fator de desconto Fit Card (padrão: 0,977 = 2,3% de

    desconto)

    Retorna:

    Tupla (preco_fitcard, preco_maximo)
    """
    preco_fitcard = preco_vista * fator_correcao * desconto_fitcard
    preco_maximo = preco_fitcard / desconto_fitcard
    return preco_fitcard, preco_maximo


def exibir_resultados (selic, credito_livre_original, credito_livre_tratado, preco_vista, fator, preco_fitcard, preco_maximo):

    """Exibe os resultados formatados no terminal."""

    # Monta a descrição do tratamento aplicado ao crédito livre

    if credito_livre_original == 0:

        obs_cl = "zero informado aplicado 1 (neutro)" 
    elif credito_livre_original < 0:

        obs_cl = f"negativo informado aplicado valor absoluto ( {credito_livre_tratado:.2f})"

    else:

        obs_cl = "valor normal"

    print("\n" + "=" * 52)

    print("       RESULTADO - FIT CARD")

    print("=" * 52)

    print(f" Selic informada : {selic:.2f}% a.a.")

    print(f" Crédito Livre informado: {credito_livre_original:.2f}% a.a. ({obs_cl})")

    print(f" Preço à vista : R$ {preco_vista:.2f}")
    print("-" * 52)

    print(f" Fator de correção : {fator:.4f}")

    print(f" Preço Fit Card : R$ {preco_fitcard:.2f}")

    print(f" Preço máximo permitido : R$ {preco_maximo:.2f}")
    print("=" * 52)


def main():

    print("\n=== CALCULADORA FIT CARD ===\n")

    credito_livre_tratado = tratar_credito_livre (credito_livre)

    fator = calcular_fator_correcao(selic)

    preco_fitcard, preco_maximo = calcular_precos (preco_vista, fator)

    exibir_resultados (selic, credito_livre, credito_livre_tratado, preco_vista, fator, preco_fitcard, preco_maximo)


if __name__ == "__main__": 
    main()