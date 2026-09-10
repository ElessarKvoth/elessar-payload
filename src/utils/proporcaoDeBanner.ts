/**
 * A especificação das artes de banner, em UM lugar só.
 *
 * Estes números aparecem em três lugares que precisam concordar: a descrição
 * que o admin lê no painel, o aviso quando a arte está fora do formato, e o
 * recorte que o site pede ao Cloudinary. Enquanto estavam digitados
 * separadamente, a descrição dizia 2400x1200 e o site pedia outra coisa — e
 * ninguém percebia, porque nada quebra: a imagem só fica cortada errado.
 *
 * O documento para quem produz a arte é o BANNERS.md, na raiz do repositório.
 * Se mudar algo aqui, mude lá também.
 */

export interface EspecificacaoDeArte {
  /** Nome que aparece para o admin. */
  contexto: string
  largura: number
  altura: number
  /** Como a proporção se escreve para gente ("8:3"). */
  proporcao: string
  /** Peso máximo do arquivo, em KB. */
  pesoMaximoKB: number
}

/**
 * Desktop: 8:3.
 *
 * NÃO é 16:5 (o formato de banner mais comum na internet) de propósito: este
 * hero também exibe TEXTO por cima — título grande, subtítulo e botão. Em 16:5
 * num notebook de 1280px de largura a faixa fica com 400px de altura, e o bloco
 * de texto não cabe sem encolher a tipografia a ponto de descaracterizar o
 * projeto. Em 8:3 o mesmo notebook dá 480px, e um monitor de 1440px dá 540px.
 */
export const BANNER_DESKTOP: EspecificacaoDeArte = {
  contexto: 'computador',
  largura: 2560,
  altura: 960,
  proporcao: '8:3',
  pesoMaximoKB: 500,
}

/**
 * Celular: 4:5.
 *
 * É o formato retrato do Instagram. A escolha é deliberada: quem produz a arte
 * já tem gabarito, hábito e olho treinado nesse formato, então a chance de a
 * peça chegar certa na primeira é muito maior do que num formato inventado por
 * nós. Também é mais baixo que o 2:3 que estava documentado antes, o que deixa
 * a primeira fileira de discos assomar na borda inferior da tela.
 */
export const BANNER_MOBILE: EspecificacaoDeArte = {
  contexto: 'celular',
  largura: 1080,
  altura: 1350,
  proporcao: '4:5',
  pesoMaximoKB: 300,
}

/**
 * Quanto a arte pode fugir da proporção antes de valer um aviso.
 *
 * 4% absorve o arredondamento de quem exporta em 2559x960 ou redimensiona no
 * olho, e ainda pega qualquer engano de verdade — mandar a arte de celular no
 * campo do computador erra a proporção em mais de 100%.
 */
const TOLERANCIA = 0.04

/** Texto pronto para o `admin.description` do campo de upload. */
export function descricaoDaArte(spec: EspecificacaoDeArte): string {
  return (
    `TAMANHO EXATO: ${spec.largura} x ${spec.altura} pixels (proporção ${spec.proporcao}). ` +
    `Formato JPG ou WebP, no máximo ${spec.pesoMaximoKB} KB.\n\n` +
    'ZONA SEGURA: deixe texto, logo e botão dentro dos 80% do meio da arte. ' +
    'As bordas podem ser cortadas em telas muito largas ou muito estreitas — ' +
    'o que estiver na beirada some.\n\n' +
    'Se a arte sair de outro tamanho, o site ainda mostra, mas recorta sozinho ' +
    'e o resultado é imprevisível. Use o tamanho exato.'
  )
}

interface DimensoesDaMidia {
  width?: number | null
  height?: number | null
}

/**
 * Confere a proporção da arte enviada e devolve um aviso em português — ou
 * `null` quando está tudo certo.
 *
 * AVISA, NÃO BLOQUEIA. Uma arte fora do formato ainda funciona: o site recorta.
 * Barrar o cadastro por isso deixaria o admin sem banner nenhum no ar às vezes
 * por 20 pixels de diferença, o que é pior que um banner um pouco torto.
 */
export function avisoDeProporcao(
  midia: DimensoesDaMidia | null | undefined,
  spec: EspecificacaoDeArte,
): string | null {
  const largura = Number(midia?.width)
  const altura = Number(midia?.height)

  if (!Number.isFinite(largura) || !Number.isFinite(altura) || largura <= 0 || altura <= 0) {
    return null
  }

  const esperada = spec.largura / spec.altura
  const enviada = largura / altura
  const desvio = Math.abs(enviada - esperada) / esperada

  if (desvio <= TOLERANCIA) {
    // Proporção certa, mas arte pequena: esticar borra. O tamanho exato é o
    // ideal; abaixo dele avisamos, acima está ótimo (o site reduz sem perda).
    if (largura < spec.largura * 0.9) {
      return (
        `A proporção está certa, mas a arte tem só ${largura} x ${altura} pixels — ` +
        `menos que os ${spec.largura} x ${spec.altura} recomendados. ` +
        'Ela pode aparecer borrada em telas grandes. Se puder, exporte maior.'
      )
    }
    return null
  }

  // O engano mais comum e mais fácil de descrever: trocar os dois campos.
  const outra = spec === BANNER_DESKTOP ? BANNER_MOBILE : BANNER_DESKTOP
  const pareceAOutra =
    Math.abs(enviada - outra.largura / outra.altura) / (outra.largura / outra.altura) <= TOLERANCIA

  if (pareceAOutra) {
    return (
      `Esta arte tem ${largura} x ${altura} pixels, que é o formato do ${outra.contexto}, ` +
      `não do ${spec.contexto}. Parece que as duas imagens foram trocadas de campo. ` +
      `Aqui vai a de ${spec.largura} x ${spec.altura} pixels (${spec.proporcao}).`
    )
  }

  const orientacao = enviada > esperada ? 'mais deitada' : 'mais em pé'

  return (
    `Esta arte tem ${largura} x ${altura} pixels e o formato pedido é ` +
    `${spec.largura} x ${spec.altura} (${spec.proporcao}) — ela está ${orientacao} que o esperado. ` +
    'O site vai recortar as sobras sozinho, e o que estiver perto da borda pode sumir. ' +
    'Para o banner sair exatamente como você desenhou, exporte no tamanho pedido.'
  )
}
