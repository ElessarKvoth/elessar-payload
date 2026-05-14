import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { generateSlug } from '../utils/generateSlug'

export const Genres: CollectionConfig = {
  slug: 'genres',
  labels: {
    singular: 'Gênero',
    plural: 'Gêneros',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Catálogo',
    description: 'Gêneros musicais (ex: Heavy Metal, Doom, Punk).',
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
      label: 'Nome',
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
        description: 'Gerado automaticamente a partir do nome.',
        readOnly: true,
      },
    },
    {
      name: 'description',
      label: 'Descrição',
      type: 'textarea',
      admin: { description: 'Breve descrição do gênero musical.' },
    },
    {
      name: 'records',
      label: 'Discos neste gênero',
      type: 'join',
      collection: 'records',
      on: 'genre',
      admin: {
        description: 'Discos vinculados a este gênero (somente leitura).',
      },
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
