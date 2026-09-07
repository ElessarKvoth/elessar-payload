/**
 * Construção de conteúdo Lexical (o formato do campo de texto formatado).
 *
 * O Payload guarda texto rico como uma árvore JSON com uma forma bem
 * específica: faltando `version`, `direction` ou `format` num nó, o editor
 * abre em branco ou quebra ao salvar. Estes ajudantes existem para que o
 * conteúdo escrito em `content/minutasLegais.ts` saia sempre na forma certa,
 * em vez de espalhar JSON cru por lá.
 *
 * Só produz o que o editor do painel aceita (ver fields/editorDeTexto.ts):
 * parágrafo, h2, h3, negrito, itálico, sublinhado e as duas listas. Assim tudo
 * que este arquivo gera continua editável na tela depois de carregado.
 */

interface NoTexto {
  type: 'text'
  text: string
  detail: 0
  format: number
  mode: 'normal'
  style: ''
  version: 1
}

interface NoBloco {
  type: string
  children: unknown[]
  direction: 'ltr'
  format: ''
  indent: 0
  version: 1
  [extra: string]: unknown
}

/** Bits de formatação do Lexical. */
const NEGRITO = 1

/**
 * Converte `texto com **negrito**` na sequência de nós de texto equivalente.
 * É a única marcação aceita — o resto do conteúdo é escrito em texto puro.
 */
function fatiarNegrito(bruto: string): NoTexto[] {
  const partes = bruto.split(/\*\*(.+?)\*\*/g)
  const nos: NoTexto[] = []

  partes.forEach((parte, indice) => {
    if (!parte) return
    nos.push({
      type: 'text',
      text: parte,
      detail: 0,
      // Índices ímpares são o conteúdo capturado entre os asteriscos.
      format: indice % 2 === 1 ? NEGRITO : 0,
      mode: 'normal',
      style: '',
      version: 1,
    })
  })

  return nos.length > 0 ? nos : [{ type: 'text', text: '', detail: 0, format: 0, mode: 'normal', style: '', version: 1 }]
}

export const paragrafo = (texto: string): NoBloco => ({
  type: 'paragraph',
  children: fatiarNegrito(texto),
  direction: 'ltr',
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
  version: 1,
})

export const titulo = (texto: string, tag: 'h2' | 'h3' = 'h2'): NoBloco => ({
  type: 'heading',
  tag,
  children: fatiarNegrito(texto),
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
})

const item = (texto: string, valor: number): NoBloco => ({
  type: 'listitem',
  value: valor,
  children: fatiarNegrito(texto),
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
})

export const lista = (itens: string[], ordenada = false): NoBloco => ({
  type: 'list',
  listType: ordenada ? 'number' : 'bullet',
  tag: ordenada ? 'ol' : 'ul',
  start: 1,
  children: itens.map((t, i) => item(t, i + 1)),
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
})

/** Embrulha os blocos na raiz que o campo `richText` espera receber. */
export function documento(blocos: NoBloco[]): { root: NoBloco } {
  return {
    root: {
      type: 'root',
      children: blocos,
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}
