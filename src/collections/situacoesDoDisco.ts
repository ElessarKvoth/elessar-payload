/**
 * Situações fixas do disco (Raro, Lacrado…). Arquivo próprio, só com dados,
 * porque é lido em dois lugares: na collection `Records` (servidor) e no
 * seletor "Etiqueta no card" do painel (componente de navegador), que não pode
 * importar a collection inteira.
 */
export const SITUACOES_DO_DISCO = [
  { label: 'Raro', value: 'rare' },
  { label: 'Importado', value: 'imported' },
  { label: 'Lacrado', value: 'sealed' },
  { label: 'Colecionável', value: 'collectible' },
  { label: 'Edição Limitada', value: 'limited_edition' },
  { label: 'Edição de Aniversário', value: 'anniversary_edition' },
  { label: 'Remasterizado', value: 'remastered' },
  { label: 'Colorido', value: 'colored_vinyl' },
] as const

/**
 * Como a escolha do card é gravada em `etiquetaDoCard`:
 *   vazio               → automático (a loja escolhe, como sempre foi)
 *   "nenhuma"           → card sem etiqueta
 *   "situacao:<valor>"  → uma das situações acima (ex: situacao:limited_edition)
 *   "texto:<etiqueta>"  → uma das etiquetas digitadas (ex: texto:Gatefold branco)
 * O prefixo evita confundir uma etiqueta digitada "Raro" com a situação Raro.
 */
export const ETIQUETA_NENHUMA = 'nenhuma'
export const PREFIXO_SITUACAO = 'situacao:'
export const PREFIXO_TEXTO = 'texto:'

/** Limite de cada etiqueta digitada: o chip do card tem uma linha só. */
export const TAMANHO_MAXIMO_DA_ETIQUETA = 30
