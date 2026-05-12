import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'Administrador',
    plural: 'Administradores',
  },
  admin: {
    useAsTitle: 'email',
    group: 'Sistema',
    description: 'Usuários com acesso ao painel administrativo.',
  },
  auth: true,
  fields: [],
}
