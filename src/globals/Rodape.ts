import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

export const Rodape: GlobalConfig = {
  slug: 'rodape',
  label: 'Rodapé do Site',
  admin: {
    group: 'Conteúdo do site',
    description:
      'A faixa cinza no fim de todas as páginas da loja, com as listas de links. O CNPJ, o endereço, o telefone e as redes sociais que aparecem lá NÃO se editam aqui — eles vêm da tela "Dados da Loja", para você não ter que corrigir a mesma informação em dois lugares.',
    hideAPIURL: true,
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    {
      name: 'colunas',
      label: 'Listas de links',
      type: 'array',
      labels: { singular: 'Lista', plural: 'Listas' },
      maxRows: 4,
      admin: {
        initCollapsed: true,
        description:
          'Cada lista vira uma coluna do rodapé, lado a lado. O normal são duas ou três: uma com as partes da loja ("Catálogo", "Vestuário") e outra com informação ("Sobre a Loja", "Trocas e Devoluções"). No celular elas viram uma embaixo da outra. Arraste para trocar a ordem.',
      },
      fields: [
        {
          name: 'titulo',
          label: 'Título da lista',
          type: 'text',
          required: true,
          admin: {
            description: 'O nome em cima da coluna. Exemplo: "Loja" ou "Informações".',
          },
        },
        {
          name: 'links',
          label: 'Links desta lista',
          type: 'array',
          labels: { singular: 'Link', plural: 'Links' },
          required: true,
          minRows: 1,
          admin: {
            description: 'Aparecem na ordem em que estiverem aqui. Arraste para reordenar.',
          },
          fields: [
            {
              name: 'texto',
              label: 'Texto do link',
              type: 'text',
              required: true,
              admin: {
                description: 'O que o cliente lê e clica. Exemplo: "Trocas e Devoluções".',
              },
            },
            {
              name: 'endereco',
              label: 'Para onde leva',
              type: 'text',
              required: true,
              admin: {
                placeholder: '/trocas',
                description:
                  'Para uma página da própria loja, escreva a partir da barra: /catalogo, /trocas, /sobre. Para um site de fora, o endereço completo começando com https://. Se estiver errado, o cliente cai numa página de erro — vale conferir clicando depois de salvar.',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'textoCopyright',
      label: 'Aviso de direitos autorais',
      type: 'text',
      admin: {
        placeholder: 'Todos os direitos reservados.',
        description:
          'A frase da última linha do rodapé. O ano e o nome da loja o site coloca sozinho — escreva só o resto. Exemplo: "Todos os direitos reservados." vira "© 2026 Elessar Records. Todos os direitos reservados."',
      },
    },
    {
      name: 'formasDePagamento',
      label: 'Formas de pagamento aceitas',
      type: 'text',
      admin: {
        placeholder: 'PIX · Cartão · Boleto',
        description:
          'Aparece no rodapé para o cliente saber como pode pagar antes de chegar no carrinho. Separe com o sinal · ou com barra. Este texto é só informativo: quais pagamentos funcionam de verdade é definido no Mercado Pago, não aqui.',
      },
    },
  ],
}
