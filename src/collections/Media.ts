import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: 'Imagem',
    plural: 'Imagens',
  },
  admin: {
    group: 'Marketing',
    description: 'Biblioteca de imagens usadas nos produtos e banners.',
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
    },
  ],
  upload: {
    staticDir: 'public/media',
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    imageSizes: [
      {
        name: 'thumbnail',
        width: 300,
        height: 300,
        position: 'centre',
      },
      {
        name: 'card',
        width: 800,
        height: 600,
        position: 'centre',
      },
    ],
    adminThumbnail: 'thumbnail',
  },
}
