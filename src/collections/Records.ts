import type { CollectionConfig, CollectionSlug, NumberField } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

import { isAdmin } from '../access/isAdmin'
import { generateSlug } from '../utils/generateSlug'
import {
  ETIQUETA_NENHUMA,
  PREFIXO_SITUACAO,
  PREFIXO_TEXTO,
  SITUACOES_DO_DISCO,
  TAMANHO_MAXIMO_DA_ETIQUETA,
} from './situacoesDoDisco'

// CollectionSlug cast required until `payload generate:types` is run with all collections registered.
const ARTISTS_SLUG = 'artists' as CollectionSlug
const GENRES_SLUG = 'genres' as CollectionSlug

const FORMATS = [
  { label: 'Vinyl', value: 'vinyl' },
  { label: 'CD', value: 'cd' },
]

const CONDITIONS = [
  { label: 'Novo', value: 'new' },
  { label: 'Usado', value: 'used' },
]

const VINYL_FORMATS = new Set(['vinyl'])

const VINYL_MODELS = [
  { label: 'Preto (Padrão)', value: 'black' },
  { label: 'Clear (Transparente)', value: 'clear' },
  { label: 'Splatter', value: 'splatter' },
  { label: 'Picture Disc', value: 'picture_disc' },
  { label: 'Outro', value: 'other' },
]

const SITUATIONS = [...SITUACOES_DO_DISCO]

export const Records: CollectionConfig = {
  slug: 'records',
  labels: {
    singular: 'Disco',
    plural: 'Discos',
  },
  admin: {
    useAsTitle: 'title',
    group: 'Catálogo',
    description: 'Vinis, CDs e outros formatos de áudio.',
    defaultColumns: ['title', 'format', 'artist', 'genre', 'condition', 'stock', 'active', 'featured'],
  },
  access: {
    // Só admin enxerga inativos; cliente logado vê o mesmo que um visitante.
    read: ({ req: { user } }) => {
      if ((user as { role?: string } | null)?.role === 'admin') return true
      return { active: { equals: true } }
    },
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [
      async ({ data }) => {
        if (data?.title && !data.slug) {
          data.slug = generateSlug(data.title)
        }
        return data
      },
    ],
    beforeChange: [
      // ── Etiquetas: limpa as digitadas e confere a escolhida para o card ──
      // Roda só quando a gravação traz esses campos (o painel manda o disco
      // inteiro; a baixa de estoque de um pedido manda só `stock`).
      async ({ data, originalDoc }) => {
        if (Array.isArray(data.etiquetas)) {
          data.etiquetas = [
            ...new Set(
              (data.etiquetas as unknown[])
                .map((t) => String(t ?? '').trim().replace(/\s+/g, ' ').slice(0, TAMANHO_MAXIMO_DA_ETIQUETA))
                .filter(Boolean),
            ),
          ]
        }

        // Se a etiqueta escolhida para o card deixou de existir no disco (o
        // gerente desmarcou a situação ou apagou a etiqueta), volta para o
        // automático em vez de mostrar no card algo que a página não mostra.
        const escolha = data.etiquetaDoCard
        if (typeof escolha === 'string' && escolha !== '' && escolha !== ETIQUETA_NENHUMA) {
          const situacoes = (data.situation ?? originalDoc?.situation ?? []) as string[]
          const raro = Boolean(data.isRare ?? originalDoc?.isRare)
          const etiquetas = (data.etiquetas ?? originalDoc?.etiquetas ?? []) as string[]
          const valida = escolha.startsWith(PREFIXO_SITUACAO)
            ? (() => {
                const v = escolha.slice(PREFIXO_SITUACAO.length)
                return situacoes.includes(v) || (v === 'rare' && raro)
              })()
            : escolha.startsWith(PREFIXO_TEXTO) && etiquetas.includes(escolha.slice(PREFIXO_TEXTO.length))
          if (!valida) data.etiquetaDoCard = null
        }
        return data
      },
      async ({ data }) => {
        if (data.stock === 0) {
          console.warn(`[Inventory] Estoque zerado para disco SKU "${data.sku ?? 'desconhecido'}", desativando.`)
          data.active = false
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc }) => {
        console.log(`[Inventory Audit] SKU: ${doc.sku} | Disco: ${doc.title} | Estoque: ${doc.stock}`)
      },
    ],
  },
  fields: [
    {
      name: 'title',
      label: 'Título',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      required: true,
      index: true,
      admin: { description: 'Gerado automaticamente a partir do título.', readOnly: true },
    },
    {
      name: 'shortDescription',
      label: 'Descrição Curta',
      type: 'textarea',
      required: true,
      maxLength: 200,
    },
    {
      name: 'description',
      label: 'Descrição Completa',
      type: 'richText',
      required: true,
      editor: lexicalEditor(),
    },

    // ── Preço ──────────────────────────────────────────────────────────────
    {
      name: 'price',
      label: 'Preço (R$)',
      type: 'number',
      required: true,
      min: 0,
      admin: { description: 'Valor em reais. Ex: 449.90' },
    },
    {
      name: 'salePrice',
      label: 'Preço Promocional (R$)',
      type: 'number',
      min: 0,
      admin: { description: 'Deixe vazio se não houver promoção. Ex: 299.90' },
      validate: ((value: number | null | undefined, { data }: { data: Record<string, unknown> }) => {
        const price = data.price as number | undefined
        if (value != null && price != null && value >= price) {
          return 'O preço promocional deve ser menor que o preço normal.'
        }
        return true
      }) satisfies NonNullable<NumberField['validate']>,
    },

    // ── Estoque ────────────────────────────────────────────────────────────
    {
      name: 'stock',
      label: 'Estoque',
      type: 'number',
      required: true,
      min: 0,
      defaultValue: 0,
    },
    {
      name: 'sku',
      label: 'SKU',
      type: 'text',
      unique: true,
      required: true,
      index: true,
      admin: { description: 'Código único do produto.' },
    },

    // ── Informações do Disco ───────────────────────────────────────────────
    {
      name: 'format',
      label: 'Formato',
      type: 'select',
      required: true,
      options: FORMATS,
    },
    {
      name: 'vinylModel',
      label: 'Modelo do Vinil',
      type: 'select',
      options: VINYL_MODELS,
      admin: {
        description: 'Prensagem especial. Só se aplica a formatos de vinil.',
        condition: (data) => VINYL_FORMATS.has(data?.format),
      },
    },
    {
      name: 'vinylModelCustom',
      label: 'Modelo Personalizado',
      type: 'text',
      admin: {
        description: 'Descreva o modelo. Ex: Marmorizado Azul, Tie-Dye, Galaxy...',
        condition: (data) => VINYL_FORMATS.has(data?.format) && data?.vinylModel === 'other',
      },
    },
    {
      name: 'condition',
      label: 'Estado',
      type: 'select',
      required: true,
      options: CONDITIONS,
    },
    {
      name: 'situation',
      label: 'Situação',
      type: 'select',
      hasMany: true,
      options: SITUATIONS,
      admin: { description: 'Pode selecionar mais de uma. Ex: Raro + Importado.' },
    },
    {
      // Texto livre com vários valores: no painel vira um campo de "chips" —
      // digita, aperta Enter, e a etiqueta entra. Fica em `records_texts`
      // (migration 20261008_120000_etiquetas_do_disco).
      name: 'etiquetas',
      label: 'Etiquetas personalizadas',
      type: 'text',
      hasMany: true,
      admin: {
        description:
          `Escreva uma etiqueta e aperte Enter. Ex: "Gatefold branco", "Capa dura", "Encarte com letras". ` +
          `Até ${TAMANHO_MAXIMO_DA_ETIQUETA} letras cada. Todas aparecem na página do produto, junto com a Situação.`,
      },
    },
    {
      name: 'etiquetaDoCard',
      label: 'Etiqueta no card da loja',
      type: 'text',
      admin: {
        components: { Field: '/components/EtiquetaDoCard#EtiquetaDoCard' },
      },
    },
    {
      name: 'artist',
      label: 'Artista',
      type: 'relationship',
      relationTo: ARTISTS_SLUG,
      required: true,
    },
    {
      name: 'genre',
      label: 'Gênero Musical',
      type: 'relationship',
      relationTo: GENRES_SLUG,
    },
    {
      name: 'releaseYear',
      label: 'Ano de Lançamento',
      type: 'number',
      min: 1900,
      admin: { description: 'Ano original de lançamento do álbum.' },
    },
    {
      name: 'recordLabel',
      label: 'Gravadora',
      type: 'text',
      admin: { description: 'Ex: Atlantic, Warner, Som Livre.' },
    },

    // ── Tracklist ─────────────────────────────────────────────────────────
    {
      name: 'tracklist',
      label: 'Tracklist',
      type: 'array',
      admin: { description: 'Lista de faixas do disco.' },
      fields: [
        {
          name: 'position',
          label: 'Posição',
          type: 'text',
          admin: { description: 'Ex: A1, A2, B1 (vinil) ou 1, 2, 3 (CD).' },
        },
        {
          name: 'title',
          label: 'Nome da Faixa',
          type: 'text',
          required: true,
        },
        {
          name: 'duration',
          label: 'Duração',
          type: 'text',
          admin: { description: 'Ex: 3:45.' },
        },
      ],
    },

    // ── Imagens ────────────────────────────────────────────────────────────
    {
      name: 'images',
      label: 'Fotos do disco',
      type: 'array',
      required: true,
      minRows: 1,
      admin: {
        description:
          'A primeira foto é a que aparece no catálogo. Use "Adicionar" para incluir mais ângulos — ' +
          'o cliente passa entre elas com as setas na página do produto.',
      },
      fields: [
        {
          name: 'image',
          label: 'Foto',
          type: 'upload',
          relationTo: 'media',
          required: true,
          admin: {
            description:
              'Foto QUADRADA (mesma largura e altura), no mínimo 1000 x 1000 pixels. ' +
              'Se a sua não for quadrada, use "Editar imagem" para recortar.',
          },
        },
        {
          name: 'altText',
          label: 'Descrição da foto',
          type: 'text',
          admin: {
            description: 'Opcional. O que aparece na foto — ajuda no Google e em leitores de tela.',
          },
        },
      ],
    },

    // ── Destaques ──────────────────────────────────────────────────────────
    {
      name: 'featured',
      label: 'Destaque no catálogo',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Coloca o disco na prateleira "Em destaque" do catálogo. É diferente dos três discos '
          + 'da Página Inicial, que continuam sendo escolhidos lá — aqui você pode marcar quantos quiser.',
      },
    },
    {
      name: 'isRare',
      label: 'Item Raro',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Exibe o selo "RARO" no card do produto.',
      },
    },
    {
      name: 'active',
      label: 'Ativo (visível na loja)',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Desmarque para ocultar o produto da loja sem excluir. Desativado automaticamente quando estoque chega a zero.',
      },
    },

    // ── Físico ─────────────────────────────────────────────────────────────
    {
      name: 'weight',
      label: 'Peso (gramas)',
      type: 'number',
      admin: { description: 'Usado para cálculo de frete.' },
    },
    {
      name: 'dimensions',
      label: 'Dimensões',
      type: 'group',
      admin: { description: 'Em centímetros.' },
      fields: [
        { name: 'height', label: 'Altura (cm)', type: 'number' },
        { name: 'width', label: 'Largura (cm)', type: 'number' },
        { name: 'depth', label: 'Profundidade (cm)', type: 'number' },
      ],
    },

    // ── SEO ───────────────────────────────────────────────────────────────
    {
      name: 'seo',
      label: 'SEO',
      type: 'group',
      fields: [
        { name: 'metaTitle', label: 'Título Meta', type: 'text', maxLength: 60 },
        { name: 'metaDescription', label: 'Descrição Meta', type: 'textarea', maxLength: 160 },
        {
          name: 'ogImage',
          label: 'Imagem de compartilhamento',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description:
              'Opcional. Aparece quando o link é compartilhado no WhatsApp, Instagram ou Facebook. ' +
              'Formato deitado, 1200 x 630 pixels. Sem ela, o site usa a primeira foto do produto.',
          },
        },
      ],
    },
  ],
}
