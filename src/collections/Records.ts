import type { CollectionConfig, CollectionSlug, NumberField } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

import { isAdmin } from '../access/isAdmin'
import { generateSlug } from '../utils/generateSlug'

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

const SITUATIONS = [
  { label: 'Raro', value: 'rare' },
  { label: 'Importado', value: 'imported' },
  { label: 'Lacrado', value: 'sealed' },
  { label: 'Colecionável', value: 'collectible' },
  { label: 'Edição Limitada', value: 'limited_edition' },
  { label: 'Edição de Aniversário', value: 'anniversary_edition' },
  { label: 'Remasterizado', value: 'remastered' },
  { label: 'Colorido', value: 'colored_vinyl' },
]

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
    read: ({ req: { user } }) => {
      if (user) return true
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
      label: 'Preço (centavos)',
      type: 'number',
      required: true,
      min: 0,
      admin: { description: 'Em centavos. Ex: 4990 = R$49,90.' },
    },
    {
      name: 'salePrice',
      label: 'Preço Promocional (centavos)',
      type: 'number',
      min: 0,
      admin: { description: 'Deixe vazio se não houver promoção.' },
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
      label: 'Imagens',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
        {
          name: 'altText',
          label: 'Texto Alternativo',
          type: 'text',
        },
      ],
    },

    // ── Destaques ──────────────────────────────────────────────────────────
    {
      name: 'featured',
      label: 'Destaque na Home',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'isRare',
      label: 'Item Raro',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'active',
      label: 'Ativo (visível na loja)',
      type: 'checkbox',
      defaultValue: true,
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
        { name: 'ogImage', label: 'Imagem OG', type: 'upload', relationTo: 'media' },
      ],
    },
  ],
}
