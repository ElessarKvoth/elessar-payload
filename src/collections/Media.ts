import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { uploadToCloudinary } from '../hooks/uploadToCloudinary'

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
  hooks: {
    beforeChange: [uploadToCloudinary],
    afterRead: [
      ({ doc }) => {
        // Payload gera `url` apontando para /api/media/file/... (localhost).
        // Com disableLocalStorage, esse arquivo não existe.
        // Substitui pelo URL real do Cloudinary para que o frontend receba a URL correta.
        if (doc.cloudinaryURL) {
          doc.url = doc.cloudinaryURL
        }
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
    },
    {
      name: 'cloudinaryURL',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Preenchido automaticamente após o upload.',
      },
    },
  ],
  upload: {
    // Files go to Cloudinary — no need to persist locally.
    disableLocalStorage: true,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    adminThumbnail: ({ doc }) => {
      const url = doc.cloudinaryURL as string | undefined
      if (!url) return null
      // Cloudinary on-the-fly transformation for admin thumbnails.
      return url.replace('/upload/', '/upload/c_fill,w_300,h_300/')
    },
  },
}
