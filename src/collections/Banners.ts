import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

export const Banners: CollectionConfig = {
  slug: 'banners',
  labels: {
    singular: 'Banner',
    plural: 'Banners',
  },
  admin: {
    useAsTitle: 'title',
    group: 'Marketing',
    description: `Crie os banners do carrossel da home. Existem dois modos:

① BANNER DE DESIGN PRÓPRIO — Suba só a imagem (já com o texto desenhado nela). Deixe título e todos os outros campos em branco.

② BANNER COM TEXTO — Preencha título, subtítulo e link. A imagem é opcional: sem imagem o banner exibe fundo verde escuro com a logo da Elessar; com imagem ela aparece como fundo.

Após criar, vá em "Página Inicial" para escolher quais banners aparecem e em que ordem.`,
    defaultColumns: ['title', 'link'],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    // ── Imagem ─────────────────────────────────────────────────────────────
    {
      name: 'image',
      label: 'Imagem de fundo (computador)',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description:
          'Formato DEITADO, recomendado 2400 x 1200 pixels. Sem imagem = fundo verde escuro com logo.\n\n' +
          'IMPORTANTE: depois de escolher, clique em "Editar imagem" e posicione o PONTO DE FOCO ' +
          'no que não pode ser cortado. O computador mostra a imagem deitada e o celular mostra em pé — ' +
          'o ponto de foco garante que o assunto apareça nos dois.\n\n' +
          'DESIGN PRÓPRIO: se a imagem já vem com texto desenhado, deixe os campos de texto abaixo em branco ' +
          'e preencha também a "Imagem para celular".',
      },
    },
    {
      name: 'imageMobile',
      label: 'Imagem para celular (opcional)',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description:
          'Só preencha se a imagem de cima tiver texto ou design que não pode ser cortado no celular. ' +
          'Formato EM PÉ, recomendado 1080 x 1620 pixels.\n\n' +
          'Deixando vazio, o site recorta a imagem do computador sozinho, respeitando o ponto de foco — ' +
          'que é o suficiente na maioria dos casos.',
      },
    },

    // ── Conteúdo (só para banners com texto) ──────────────────────────────
    {
      name: 'title',
      label: 'Título',
      type: 'text',
      admin: {
        description: 'Texto principal. Deixe em branco se a imagem já tiver o texto desenhado.',
      },
    },
    {
      name: 'subtitle',
      label: 'Subtítulo',
      type: 'text',
      admin: {
        description: 'Texto secundário abaixo do título. Opcional.',
      },
    },
    {
      name: 'link',
      label: 'Link do Botão',
      type: 'text',
      admin: {
        description: 'Caminho interno (ex: /catalogo) ou URL externa. Deixe vazio para não exibir botão.',
      },
    },
    {
      name: 'linkLabel',
      label: 'Texto do Botão',
      type: 'text',
      admin: {
        description: 'Ex: "Ver Promoções", "Comprar Agora". Padrão: "Explorar".',
      },
    },

    // Campos legados — ocultos do admin, gerenciados pela Global "Página Inicial".
    { name: 'active',   type: 'checkbox', defaultValue: true, admin: { hidden: true } },
    { name: 'order',    type: 'number',   defaultValue: 0,    admin: { hidden: true } },
    { name: 'startsAt', type: 'date',                         admin: { hidden: true } },
    { name: 'endsAt',   type: 'date',                         admin: { hidden: true } },
  ],
}
