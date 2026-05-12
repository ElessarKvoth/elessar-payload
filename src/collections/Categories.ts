import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { generateSlug } from '../utils/generateSlug'

export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: {
    singular: 'Categoria',
    plural: 'Categorias',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Catálogo',
    description: 'Organize os produtos em categorias (ex: Rock, Jazz, Merchandise).',
    defaultColumns: ['name', 'slug'],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'name',
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
        description: 'Auto-generated from name. Can be overridden manually.',
      },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'description',
      type: 'textarea',
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data }) => {
        if (data?.name && !data.slug) {
          data.slug = generateSlug(data.name)
        }
        return data
      },
    ],
  },
}
