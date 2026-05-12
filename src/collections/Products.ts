import type { CollectionConfig, CollectionSlug, NumberField } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

import { isAdmin } from '../access/isAdmin'
import { generateSlug } from '../utils/generateSlug'

// CollectionSlug cast required until `payload generate:types` is run with all collections registered.
const ARTISTS_SLUG = 'artists' as CollectionSlug
const CATEGORIES_SLUG = 'categories' as CollectionSlug

const PRODUCT_TYPES = [
  { label: 'Vinyl', value: 'vinyl' },
  { label: 'CD', value: 'cd' },
  { label: 'T-Shirt', value: 'tshirt' },
]

const CONDITIONS = [
  { label: 'New', value: 'new' },
  { label: 'Used', value: 'used' },
  { label: 'Rare', value: 'rare' },
  { label: 'Imported', value: 'imported' },
  { label: 'Sealed', value: 'sealed' },
  { label: 'Collectible', value: 'collectible' },
]

export const Products: CollectionConfig = {
  slug: 'products',
  labels: {
    singular: 'Produto',
    plural: 'Produtos',
  },
  admin: {
    useAsTitle: 'title',
    group: 'Catálogo',
    description: 'Cadastre e gerencie todos os produtos à venda — vinis, CDs e camisetas.',
    defaultColumns: ['title', 'productType', 'condition', 'stock', 'active', 'featured'],
  },
  access: {
    // Unauthenticated requests only see active products
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
        // Auto-deactivate when stock hits zero to prevent overselling
        if (data.stock === 0) {
          console.warn(
            `[Inventory] Stock reached 0 for SKU "${data.sku ?? 'unknown'}", auto-deactivating.`,
          )
          data.active = false
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc }) => {
        // Audit trail — captured on every save for inventory reconciliation
        console.log(
          `[Inventory Audit] SKU: ${doc.sku} | Title: ${doc.title} | Stock: ${doc.stock}`,
        )
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      required: true,
      index: true,
      admin: {
        description: 'Auto-generated from title. Can be overridden manually.',
      },
    },
    {
      name: 'shortDescription',
      type: 'textarea',
      required: true,
      maxLength: 200,
    },
    {
      name: 'description',
      type: 'richText',
      required: true,
      editor: lexicalEditor(),
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Price in cents (e.g. 2990 = R$29.90).',
      },
    },
    {
      name: 'salePrice',
      type: 'number',
      min: 0,
      admin: {
        description: 'Optional promotional price in cents. Must be less than the regular price.',
      },
      validate: ((value: number | null | undefined, { data }: { data: Record<string, unknown> }) => {
        const price = data.price as number | undefined
        if (value != null && price != null && value >= price) {
          return 'Sale price must be less than the regular price.'
        }
        return true
      }) satisfies NonNullable<NumberField['validate']>,
    },
    {
      name: 'stock',
      type: 'number',
      required: true,
      min: 0,
      defaultValue: 0,
      admin: {
        description: 'Current units in stock. Reaching 0 auto-deactivates the product.',
      },
    },
    {
      name: 'sku',
      type: 'text',
      unique: true,
      required: true,
      index: true,
      admin: {
        description: 'Unique Stock Keeping Unit code.',
      },
    },
    {
      name: 'productType',
      type: 'select',
      required: true,
      options: PRODUCT_TYPES,
    },
    {
      name: 'condition',
      type: 'select',
      required: true,
      options: CONDITIONS,
    },
    {
      name: 'artist',
      type: 'relationship',
      relationTo: ARTISTS_SLUG,
      required: true,
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: CATEGORIES_SLUG,
      required: true,
    },
    {
      name: 'images',
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
          type: 'text',
        },
      ],
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Pin this product to the homepage highlights section.',
      },
    },
    {
      name: 'isRare',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Surface this product in the rarities section.',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'weight',
      type: 'number',
      admin: {
        description: 'Weight in grams. Used for shipping calculations.',
      },
    },
    {
      name: 'dimensions',
      type: 'group',
      admin: {
        description: 'Physical dimensions in centimetres.',
      },
      fields: [
        { name: 'height', type: 'number', admin: { description: 'cm' } },
        { name: 'width', type: 'number', admin: { description: 'cm' } },
        { name: 'depth', type: 'number', admin: { description: 'cm' } },
      ],
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        {
          name: 'metaTitle',
          type: 'text',
          maxLength: 60,
        },
        {
          name: 'metaDescription',
          type: 'textarea',
          maxLength: 160,
        },
        {
          name: 'ogImage',
          type: 'upload',
          relationTo: 'media',
        },
      ],
    },
  ],
}
