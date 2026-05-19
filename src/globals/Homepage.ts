import type { GlobalConfig, CollectionSlug } from 'payload'
import { isAdmin } from '../access/isAdmin'

export const Homepage: GlobalConfig = {
  slug: 'homepage',
  label: 'Página Inicial',
  admin: {
    group: 'Site',
    description: 'Tudo que aparece na página inicial da loja. Banners do carrossel e discos em destaque.',
    hideAPIURL: true,
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    // ── Banners ────────────────────────────────────────────────────────────
    {
      name: 'banners',
      label: '🎬 Banners do Carrossel',
      type: 'relationship',
      relationTo: 'banners' as CollectionSlug,
      hasMany: true,
      admin: {
        description:
          'Selecione os banners que vão aparecer no carrossel da home, na ordem desejada. Para criar um novo banner, acesse a seção "Banners" no menu.',
      },
    },

    // ── Destaques ──────────────────────────────────────────────────────────
    {
      name: 'featuredRecords',
      label: '⭐ Discos em Destaque',
      type: 'relationship',
      relationTo: 'records' as CollectionSlug,
      hasMany: true,
      maxRows: 3,
      admin: {
        description:
          'Escolha até 3 discos para aparecer na seção "Destaques" da home. Arraste para reordenar.',
        allowCreate: false,
      },
    },

    // ── Chegou Agora ───────────────────────────────────────────────────────
    {
      name: 'newArrivalsNote',
      label: '🆕 Chegou Agora',
      type: 'ui',
      admin: {
        components: {},
        description:
          'A seção "Chegou Agora" exibe automaticamente os 10 discos adicionados mais recentemente. Não precisa configurar.',
      },
    },
  ],
}
