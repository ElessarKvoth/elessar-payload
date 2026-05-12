import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { generateSlug } from '../utils/generateSlug'

export const Artists: CollectionConfig = {
  slug: 'artists',
  labels: {
    singular: 'Artista',
    plural: 'Artistas',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Catálogo',
    description: 'Cadastre os artistas e bandas dos produtos da loja.',
    defaultColumns: ['name', 'slug', 'active'],
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
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'bio',
      type: 'textarea',
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, operation }) => {
        if (data?.name && !data.slug) {
          data.slug = generateSlug(data.name)
        }
        return data
      },
    ],
  },
}
