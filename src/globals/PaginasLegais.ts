import type { Field, GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { editorDeTexto } from '../fields/editorDeTexto'

/**
 * As cinco páginas de regras da loja moram todas neste mesmo lugar, uma por
 * aba. Cada uma vira um grupo com nome próprio (`trocas`, `entrega`, ...) para
 * que o site consiga pedir uma página específica sem receber o resto junto.
 *
 * O grupo usa `label: false` de propósito: a aba já diz de qual página se
 * trata, e repetir o nome logo abaixo só empurraria o formulário para baixo.
 */
function camposDaPagina(args: {
  tituloPadrao: string
  descricaoDoTexto: string
}): Field[] {
  return [
    {
      name: 'titulo',
      label: 'Título da página',
      type: 'text',
      required: true,
      defaultValue: args.tituloPadrao,
      admin: {
        description: `O texto grande no topo da página. Exemplo: "${args.tituloPadrao}".`,
      },
    },
    {
      name: 'texto',
      label: 'Texto da página',
      type: 'richText',
      editor: editorDeTexto,
      // De propósito NÃO obrigatório. As cinco páginas moram no mesmo registro,
      // e o Payload valida um global inteiro de uma vez — se este campo fosse
      // obrigatório, não daria para salvar a página de trocas sem antes ter
      // escrito as outras quatro. Quem escreve regra escreve uma de cada vez.
      admin: {
        description: `${args.descricaoDoTexto} Enquanto estiver vazio, esta página não aparece no site — dá para escrever aos poucos e salvar quantas vezes quiser.`,
      },
    },
    {
      name: 'atualizadoEm',
      label: 'Data da última revisão',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayOnly', displayFormat: 'dd/MM/yyyy' },
        description:
          'Aparece no fim da página como "Última atualização". Mude sempre que alterar as regras: é o que mostra ao cliente qual versão valia quando ele comprou, e é a sua defesa numa discussão. Pode deixar vazio.',
      },
    },
  ]
}

export const PaginasLegais: GlobalConfig = {
  slug: 'paginas-legais',
  label: 'Páginas de Regras',
  admin: {
    group: 'Conteúdo do site',
    description:
      'As páginas que explicam as regras da loja ao cliente: como comprar, prazos de entrega, trocas, privacidade e termos de uso. Escolha a aba da página que quer mexer. O que você escrever passa a valer no site assim que salvar, então releia antes.',
    hideAPIURL: true,
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    {
      name: 'versaoDosTermos',
      label: 'Versão dos termos em vigor',
      type: 'text',
      defaultValue: '1.0',
      admin: {
        description:
          'O número da versão das regras que valem hoje. Ele é gravado na conta de cada cliente no momento do cadastro, junto com a data e o texto exato que ele aceitou. MUDE ESTE NÚMERO sempre que alterar algo importante nos Termos de Uso ou na Política de Privacidade (por exemplo: de 1.0 para 1.1): quem se cadastrou com a versão antiga passa a ser tratado como pendente de novo aceite, e a loja pede a concordância na próxima vez que a pessoa entrar. Corrigir uma vírgula ou um erro de digitação não exige mudar a versão.',
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Como comprar',
          description:
            'O passo a passo da compra, do carrinho até o pagamento. É a página que o cliente inseguro abre antes de decidir.',
          fields: [
            {
              name: 'comoComprar',
              label: false,
              type: 'group',
              fields: camposDaPagina({
                tituloPadrao: 'Como comprar',
                descricaoDoTexto:
                  'Explique o caminho da compra em passos curtos e numerados: escolher o produto, calcular o frete, pagar, receber. Diga quais formas de pagamento você aceita. Use a lista numerada dos botões acima — fica muito mais fácil de seguir que um texto corrido.',
              }),
            },
          ],
        },
        {
          label: 'Entrega e frete',
          description:
            'Como o pedido é embalado, em quanto tempo sai e como o cliente acompanha. Reduz muita mensagem de "cadê meu disco".',
          fields: [
            {
              name: 'entrega',
              label: false,
              type: 'group',
              fields: camposDaPagina({
                tituloPadrao: 'Entrega e frete',
                descricaoDoTexto:
                  'Fale de embalagem, prazo de postagem e rastreio. Seja concreto com os prazos — "postamos em até 2 dias úteis" vale mais que "enviamos rapidamente", e é o que evita reclamação. Não prometa prazo dos Correios, que não depende de você.',
              }),
            },
          ],
        },
        {
          label: 'Trocas e devoluções',
          description:
            'Em que casos o cliente pode devolver e como pedir. Esta é a página mais consultada quando algo dá errado.',
          fields: [
            {
              name: 'trocas',
              label: false,
              type: 'group',
              fields: camposDaPagina({
                tituloPadrao: 'Trocas e devoluções',
                descricaoDoTexto:
                  'Diga o prazo para desistir da compra, em que estado o produto precisa voltar e por onde o cliente pede. Lembre que o Código de Defesa do Consumidor garante 7 dias corridos para arrependimento em compra pela internet — você pode dar mais, nunca menos.',
              }),
            },
          ],
        },
        {
          label: 'Privacidade',
          description:
            'O que a loja faz com os dados do cliente. Esta página ainda está sendo montada no site — pode preencher desde já, que ela aparece assim que entrar no ar.',
          fields: [
            {
              name: 'privacidade',
              label: false,
              type: 'group',
              fields: camposDaPagina({
                tituloPadrao: 'Política de Privacidade',
                descricaoDoTexto:
                  'Explique quais dados você guarda (nome, e-mail, endereço, CPF), para que servem (entregar o pedido e emitir a etiqueta) e com quem são compartilhados (Correios ou transportadora, e o Mercado Pago no pagamento). Diga também como o cliente pede para apagar os dados dele.',
              }),
            },
          ],
        },
        {
          label: 'Termos de uso',
          description:
            'As regras gerais de uso do site. Esta página ainda está sendo montada no site — pode preencher desde já, que ela aparece assim que entrar no ar.',
          fields: [
            {
              name: 'termos',
              label: false,
              type: 'group',
              fields: camposDaPagina({
                tituloPadrao: 'Termos de Uso',
                descricaoDoTexto:
                  'As condições para usar o site e comprar: quem pode criar conta, o que acontece se um produto anunciado acabar, e o que a loja não se responsabiliza. Escreva em linguagem simples — termo que ninguém entende não protege ninguém.',
              }),
            },
          ],
        },
        {
          label: 'Cookies',
          description:
            'O que o site guarda no navegador do cliente e para quê. A LGPD trata cookie que identifica pessoa como dado pessoal, então esta página precisa existir junto com a de privacidade.',
          fields: [
            {
              name: 'cookies',
              label: false,
              type: 'group',
              fields: camposDaPagina({
                tituloPadrao: 'Política de Cookies',
                descricaoDoTexto:
                  'Explique quais cookies o site usa e para quê: os que fazem o carrinho e o login funcionarem (sem eles a loja não funciona), e os de medição de audiência, se você usar. Diga como o cliente desliga os opcionais e o que ele perde ao desligar.',
              }),
            },
          ],
        },
      ],
    },
  ],
}
