import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

// TODO: In the future, customers should be able to read and update their own data.
// Add a row-level access function: ({ req }) => req.user ? { id: { equals: req.user.id } } : false
// This requires linking Customers to Payload's Users collection or a separate auth mechanism.

export const Customers: CollectionConfig = {
  slug: 'customers',
  labels: {
    singular: 'Cliente',
    plural: 'Clientes',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Vendas',
    description: 'Lista de clientes cadastrados com endereços de entrega.',
    defaultColumns: ['name', 'email', 'phone', 'createdAt'],
  },
  access: {
    read: isAdmin,
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
      name: 'email',
      type: 'email',
      unique: true,
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'addresses',
      type: 'array',
      fields: [
        {
          name: 'label',
          type: 'text',
          admin: { placeholder: 'e.g. Home, Work' },
        },
        {
          name: 'street',
          type: 'text',
          required: true,
        },
        {
          name: 'number',
          type: 'text',
          required: true,
        },
        {
          name: 'complement',
          type: 'text',
        },
        {
          name: 'neighborhood',
          type: 'text',
          required: true,
        },
        {
          name: 'city',
          type: 'text',
          required: true,
        },
        {
          name: 'state',
          type: 'text',
          required: true,
          maxLength: 2,
          admin: { description: 'Brazilian UF code (e.g. SP, RJ, MG).' },
        },
        {
          name: 'zipCode',
          type: 'text',
          required: true,
          admin: { description: 'Brazilian CEP format (e.g. 01310-100).' },
        },
        {
          name: 'isDefault',
          type: 'checkbox',
          defaultValue: false,
        },
      ],
    },
  ],
  timestamps: true,
}
