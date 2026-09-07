import {
  lexicalEditor,
  BoldFeature,
  FixedToolbarFeature,
  HeadingFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  UnderlineFeature,
  UnorderedListFeature,
} from '@payloadcms/richtext-lexical'

/**
 * Editor de texto formatado, versão enxuta.
 *
 * O editor padrão do Payload liga dezenas de recursos — blocos, tabelas,
 * relacionamentos, upload embutido, código, sobrescrito, alinhamento. Quem não
 * é da área abre isso e não sabe onde clicar, e a maioria desses recursos não
 * tem uso nenhum num texto institucional.
 *
 * Aqui ficam só os oito que importam para escrever uma página: parágrafo,
 * dois níveis de título, negrito, itálico, sublinhado, as duas listas e link.
 *
 * `FixedToolbarFeature` é o mais importante da lista. Sem ele o Payload só
 * mostra os botões DEPOIS que você seleciona um trecho de texto (barra
 * flutuante) — ou seja, quem abre a página em branco não vê botão nenhum e
 * conclui que não dá para formatar. Com a barra fixa, os botões estão sempre
 * visíveis no topo da caixa.
 *
 * Passar `features` como função que ignora `defaultFeatures` é o que garante
 * que a lista abaixo seja EXATAMENTE o que aparece — nada é herdado.
 */
export const editorDeTexto = lexicalEditor({
  features: () => [
    ParagraphFeature(),
    HeadingFeature({ enabledHeadingSizes: ['h2', 'h3'] }),
    BoldFeature(),
    ItalicFeature(),
    UnderlineFeature(),
    UnorderedListFeature(),
    OrderedListFeature(),
    LinkFeature(),
    FixedToolbarFeature(),
  ],
})
