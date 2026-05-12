import type { CollectionConfig, CollectionSlug, NumberField } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

import { isAdmin } from '../access/isAdmin'
import { generateSlug } from '../utils/generateSlug'

// CollectionSlug cast required until `payload generate:types` is run with all collections registered.
const CATEGORIES_SLUG = 'categories' as CollectionSlug
const ARTISTS_SLUG = 'artists' as CollectionSlug

const APPAREL_TYPES = [
  { label: 'Camiseta', value: 'tshirt' },
  { label: 'Moletom', value: 'hoodie' },
  { label: 'Jaqueta', value: 'jacket' },
  { label: 'Boné / Cap', value: 'cap' },
  { label: 'Cinto', value: 'belt' },
  { label: 'Pôster', value: 'poster' },
  { label: 'Patch / Adesivo', value: 'patch' },
  { label: 'Acessório', value: 'accessory' },
]

const CONDITIONS = [
  { label: 'Novo', value: 'new' },
  { label: 'Usado', value: 'used' },
  { label: 'Raro', value: 'rare' },
  { label: 'Colecionável', value: 'collectible' },
]

// Tamanhos disponíveis. "Tamanho Único" cobre acessórios sem numeração (bonés, pôsteres, patches).
const SIZES = [
  { label: 'PP', value: 'PP' },
  { label: 'P', value: 'P' },
  { label: 'M', value: 'M' },
  { label: 'G', value: 'G' },
  { label: 'GG', value: 'GG' },
  { label: 'GGG', value: 'GGG' },
  { label: 'Tamanho Único', value: 'unico' },
]

type ApparelVariant = {
  size: string
  color?: string | null
  sku?: string | null
  stock: number
}

export const Apparel: CollectionConfig = {
  slug: 'apparel',
  labels: {
    singular: 'Vestuário',
    plural: 'Vestuários',
  },
  admin: {
    useAsTitle: 'title',
    group: 'Catálogo',
    description: 'Camisetas, moletons, bonés, pôsteres e acessórios com controle de estoque por tamanho.',
    defaultColumns: ['title', 'apparelType', 'condition', 'totalStock', 'active', 'featured'],
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
        // Recalculate totalStock from all variants
        if (Array.isArray(data.variants)) {
          const total = (data.variants as ApparelVariant[]).reduce(
            (sum, v) => sum + (v.stock ?? 0),
            0,
          )
          data.totalStock = total

          if (total === 0) {
            console.warn(
              `[Inventory] Todas as variantes sem estoque para "${data.sku ?? 'desconhecido'}", desativando.`,
            )
            data.active = false
          }
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc }) => {
        const variants = (doc.variants ?? []) as ApparelVariant[]
        const summary = variants
          .map((v) => `${v.size}${v.color ? `/${v.color}` : ''}:${v.stock}`)
          .join(' | ')
        console.log(
          `[Inventory Audit] SKU: ${doc.sku} | Vestuário: ${doc.title} | Variantes: ${summary}`,
        )
      },
    ],
  },
  fields: [
    {
      name: 'title',
      label: 'Nome do Produto',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      required: true,
      index: true,
      admin: { description: 'Gerado automaticamente a partir do nome.', readOnly: true },
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
      admin: { description: 'Em centavos. Ex: 5990 = R$59,90.' },
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

    // ── Identificação ──────────────────────────────────────────────────────
    {
      name: 'sku',
      label: 'SKU Base',
      type: 'text',
      unique: true,
      required: true,
      index: true,
      admin: { description: 'Código base do produto. Cada variante pode ter seu próprio SKU.' },
    },
    {
      name: 'apparelType',
      label: 'Tipo de Produto',
      type: 'select',
      required: true,
      options: APPAREL_TYPES,
    },
    {
      name: 'condition',
      label: 'Estado',
      type: 'select',
      required: true,
      defaultValue: 'new',
      options: CONDITIONS,
    },

    // ── Relacionamentos ────────────────────────────────────────────────────
    {
      name: 'artist',
      label: 'Artista / Banda',
      type: 'relationship',
      relationTo: ARTISTS_SLUG,
      admin: { description: 'Opcional. Preencha para camisetas e itens de bandas específicas.' },
    },
    {
      name: 'category',
      label: 'Categoria',
      type: 'relationship',
      relationTo: CATEGORIES_SLUG,
      required: true,
    },

    // ── Variantes (tamanho + cor + estoque) ────────────────────────────────
    {
      name: 'variants',
      label: 'Variantes (Tamanho / Cor / Estoque)',
      type: 'array',
      required: true,
      minRows: 1,
      admin: {
        description:
          'Adicione uma linha por combinação de tamanho e cor. Use "Tamanho Único" para pôsteres, bonés e acessórios sem numeração.',
      },
      fields: [
        {
          name: 'size',
          label: 'Tamanho',
          type: 'select',
          required: true,
          options: SIZES,
        },
        {
          name: 'color',
          label: 'Cor',
          type: 'text',
          admin: { description: 'Opcional. Ex: Preto, Branco, Cinza.' },
        },
        {
          name: 'sku',
          label: 'SKU da Variante',
          type: 'text',
          admin: { description: 'Opcional. Deixe vazio para usar o SKU base.' },
        },
        {
          name: 'stock',
          label: 'Estoque',
          type: 'number',
          required: true,
          min: 0,
          defaultValue: 0,
        },
      ],
    },

    // ── Estoque Total (calculado automaticamente) ──────────────────────────
    {
      name: 'totalStock',
      label: 'Estoque Total',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Calculado automaticamente como soma de todas as variantes.',
        readOnly: true,
      },
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
