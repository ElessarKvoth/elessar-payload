// Cálculo do pacote consolidado para cotação de frete.
// Funções puras (sem I/O) para facilitar teste e raciocínio.

export interface DimensoesItem {
  height?: number | null
  width?: number | null
  depth?: number | null
}

export interface ItemPacote {
  /** Peso unitário do disco, em gramas (null/undefined => usa pesoPadraoItem). */
  pesoGramas?: number | null
  /** Dimensões do disco, em cm (se QUALQUER lado faltar, usa a caixa padrão). */
  dimensoes?: DimensoesItem | null
  quantidade: number
}

export interface CaixaPadrao {
  comprimento: number
  largura: number
  altura: number
}

export interface PacoteConsolidado {
  /** Peso total do pacote, em quilos. */
  weightKg: number
  /** Dimensões finais do pacote, em cm. */
  comprimento: number
  largura: number
  altura: number
}

// Limites dos Correios (via SuperFrete): cada lado <= 100 cm e a soma dos
// três lados <= 200 cm.
const LIMITE_LADO_CM = 100
const LIMITE_SOMA_CM = 200

/**
 * Consolida vários itens em UM único pacote.
 *
 * Peso: soma de (peso unitário, ou pesoPadraoItem) × quantidade, convertido para kg.
 *
 * Dimensões (heurística de empilhamento — discos empilham deitados): para cada
 * item, lê [height, width, depth] (ou a caixa padrão inteira se algum lado faltar)
 * e ordena ascendente em [thin, mid, big]. Então:
 *   - comprimento = max( maior `big` entre os itens , caixa.comprimento )
 *   - largura     = max( maior `mid` entre os itens , caixa.largura )
 *   - altura      = max( Σ(thin × quantidade)        , caixa.altura )
 */
export function montarPacote(
  itens: ItemPacote[],
  caixa: CaixaPadrao,
  pesoPadraoItem: number,
): PacoteConsolidado {
  let pesoTotalGramas = 0
  let maxBig = 0
  let maxMid = 0
  let somaThin = 0

  for (const item of itens) {
    const qtd = item.quantidade
    const peso = item.pesoGramas ?? pesoPadraoItem
    pesoTotalGramas += peso * qtd

    // Se QUALQUER lado do disco faltar, usa a caixa padrão inteira como triple.
    const d = item.dimensoes
    const temTodas = d != null && d.height != null && d.width != null && d.depth != null
    const triple: number[] = temTodas
      ? [d!.height as number, d!.width as number, d!.depth as number]
      : [caixa.comprimento, caixa.largura, caixa.altura]

    // Ordena ascendente -> [thin, mid, big].
    const [thin, mid, big] = [...triple].sort((a, b) => a - b)

    maxBig = Math.max(maxBig, big)
    maxMid = Math.max(maxMid, mid)
    somaThin += thin * qtd
  }

  const weightKg = Number((pesoTotalGramas / 1000).toFixed(3))

  // Piso de cada lado no tamanho da caixa padrão (tamanho mínimo do pacote).
  let comprimento = Math.max(maxBig, caixa.comprimento)
  let largura = Math.max(maxMid, caixa.largura)
  let altura = Math.max(somaThin, caixa.altura)

  // ── Clamp aos limites dos Correios ────────────────────────────────────────
  // 1) Cada lado no máximo 100 cm.
  comprimento = Math.min(comprimento, LIMITE_LADO_CM)
  largura = Math.min(largura, LIMITE_LADO_CM)
  altura = Math.min(altura, LIMITE_LADO_CM)

  // 2) Soma dos lados no máximo 200 cm. A altura é o eixo que cresce com o
  // empilhamento, então é ela que reduzimos — nunca abaixo do piso da caixa padrão.
  if (comprimento + largura + altura > LIMITE_SOMA_CM) {
    const alturaMax = LIMITE_SOMA_CM - comprimento - largura
    altura = Math.max(caixa.altura, Math.min(altura, alturaMax))
  }

  return { weightKg, comprimento, largura, altura }
}
