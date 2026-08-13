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

    // ── Lançamentos Exclusivos ─────────────────────────────────────────────
    {
      name: 'exclusiveReleases',
      label: '💿 Lançamentos Exclusivos',
      type: 'relationship',
      relationTo: 'records' as CollectionSlug,
      hasMany: true,
      maxRows: 4,
      admin: {
        description:
          'Escolha até 4 discos para a seção "Lançamentos Exclusivos" da home. Arraste para reordenar. Se ficar vazio, a seção não aparece.',
        allowCreate: false,
      },
    },

    // ── Bandas em destaque (ícones) ────────────────────────────────────────
    {
      name: 'bandIcons',
      label: '🤘 Bandas em Destaque (ícones)',
      type: 'array',
      maxRows: 4,
      admin: {
        description:
          'Até 4 logos de bandas na home. Cada ícone leva ao catálogo filtrado por aquele artista. Use PNG com fundo transparente para o melhor resultado.',
      },
      fields: [
        {
          name: 'image',
          label: 'Logo / Ícone (PNG)',
          type: 'upload',
          relationTo: 'media' as CollectionSlug,
          required: true,
        },
        {
          name: 'artist',
          label: 'Artista / Banda',
          type: 'relationship',
          relationTo: 'artists' as CollectionSlug,
          required: true,
          admin: { description: 'Para onde o clique leva (catálogo filtrado por este artista).' },
        },
      ],
    },

    // ── Chegou Agora ───────────────────────────────────────────────────────
    {
      name: 'newArrivalsNote',
      label: '🆕 Chegou Agora',
      type: 'ui',
      admin: {
        components: {},
      },
    },
  ],
}
