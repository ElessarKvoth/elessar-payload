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
    description: 'Gerencie os banners e promoções exibidos no site.',
    defaultColumns: ['title', 'active', 'order', 'startsAt', 'endsAt'],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'subtitle',
      type: 'text',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'link',
      type: 'text',
      admin: {
        description: 'Internal path (e.g. /products/slug) or external URL.',
      },
    },
    {
      name: 'linkLabel',
      type: 'text',
      admin: {
        description: 'CTA button text (e.g. "Shop Now").',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Lower numbers appear first.',
      },
    },
    {
      name: 'startsAt',
      type: 'date',
      admin: {
        description: 'Optional. Banner will not show before this date.',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'endsAt',
      type: 'date',
      admin: {
        description: 'Optional. Banner will not show after this date.',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
  ],
}
