import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { generateSlug } from '../utils/generateSlug'

export const Artists: CollectionConfig = {
  slug: 'artists',
  labels: {
    singular: 'Artista ou Banda',
    plural: 'Artistas e Bandas',
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
      name: 'foundedAt',
      label: 'Data de Formação / Nascimento',
      type: 'date',
      admin: {
        description: 'Data de fundação da banda ou nascimento do artista. Usada para destacar automaticamente o artista mais próximo do aniversário na página de Artistas.',
        date: { pickerAppearance: 'dayOnly', displayFormat: 'dd/MM/yyyy' },
      },
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
