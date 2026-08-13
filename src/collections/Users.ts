import type { CollectionConfig, TextField } from 'payload'

import { isAdmin, isAdminOrSelf } from '../access/isAdmin'
import { cpfValido } from '../utils/validarCpf'
import { emailBase, storefrontUrl } from '../utils/emailTemplate'

type WithRole = { role?: 'admin' | 'client' }

const BRAZIL_STATES = [
  { label: 'Acre (AC)', value: 'AC' },
  { label: 'Alagoas (AL)', value: 'AL' },
  { label: 'Amapá (AP)', value: 'AP' },
  { label: 'Amazonas (AM)', value: 'AM' },
  { label: 'Bahia (BA)', value: 'BA' },
  { label: 'Ceará (CE)', value: 'CE' },
  { label: 'Distrito Federal (DF)', value: 'DF' },
  { label: 'Espírito Santo (ES)', value: 'ES' },
  { label: 'Goiás (GO)', value: 'GO' },
  { label: 'Maranhão (MA)', value: 'MA' },
  { label: 'Mato Grosso (MT)', value: 'MT' },
  { label: 'Mato Grosso do Sul (MS)', value: 'MS' },
  { label: 'Minas Gerais (MG)', value: 'MG' },
  { label: 'Pará (PA)', value: 'PA' },
  { label: 'Paraíba (PB)', value: 'PB' },
  { label: 'Paraná (PR)', value: 'PR' },
  { label: 'Pernambuco (PE)', value: 'PE' },
  { label: 'Piauí (PI)', value: 'PI' },
  { label: 'Rio de Janeiro (RJ)', value: 'RJ' },
  { label: 'Rio Grande do Norte (RN)', value: 'RN' },
  { label: 'Rio Grande do Sul (RS)', value: 'RS' },
  { label: 'Rondônia (RO)', value: 'RO' },
  { label: 'Roraima (RR)', value: 'RR' },
  { label: 'Santa Catarina (SC)', value: 'SC' },
  { label: 'São Paulo (SP)', value: 'SP' },
  { label: 'Sergipe (SE)', value: 'SE' },
  { label: 'Tocantins (TO)', value: 'TO' },
]

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'Usuário',
    plural: 'Usuários',
  },
  admin: {
    useAsTitle: 'email',
    group: 'Sistema',
    description: 'Administradores e clientes da loja.',
    defaultColumns: ['name', 'email', 'role', 'createdAt'],
  },
  auth: {
    tokenExpiration: 7200,
    verify: {
      generateEmailSubject: () => 'Confirme sua conta — Elessar Records',
      generateEmailHTML: ({ token, user }) =>
        emailBase({
          titulo: 'Bem-vindo à Elessar Records',
          saudacao: `Olá, ${(user as { name?: string }).name ?? ''}`.trim(),
          corpo:
            'Sua conta foi criada. Para começar a comprar, confirme seu e-mail clicando no botão abaixo.',
          botaoTexto: 'Confirmar minha conta',
          botaoUrl: `${storefrontUrl()}/verificar-email?token=${token}`,
          rodape: 'Se você não criou esta conta, pode ignorar este e-mail.',
        }),
    },
    forgotPassword: {
      generateEmailSubject: () => 'Redefinir sua senha — Elessar Records',
      generateEmailHTML: (args) =>
        emailBase({
          titulo: 'Redefinir senha',
          saudacao: `Olá, ${(args?.user as { name?: string } | undefined)?.name ?? ''}`.trim(),
          corpo:
            'Recebemos um pedido para redefinir a senha da sua conta. O link abaixo é válido por tempo limitado.',
          botaoTexto: 'Criar nova senha',
          botaoUrl: `${storefrontUrl()}/redefinir-senha?token=${args?.token ?? ''}`,
          rodape:
            'Se você não pediu para redefinir a senha, ignore este e-mail — sua senha atual continua valendo.',
        }),
    },
  },
  access: {
    // Gates access to the entire admin panel (since Users is the auth collection)
    admin: ({ req }) => Boolean(req.user) && (req.user as WithRole).role === 'admin',
    create: () => true,
    read: isAdminOrSelf,
    update: isAdminOrSelf,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        const d = data as Record<string, unknown>

        if (operation === 'create') {
          const { totalDocs } = await req.payload.count({ collection: 'users', overrideAccess: true })
          if (totalDocs === 0) {
            d.role = 'admin'
            return data
          }
        }

        // Prevent non-admins from promoting themselves to admin
        if (d.role === 'admin' && (req.user as WithRole | null)?.role !== 'admin') {
          delete d.role
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'name',
      label: 'Nome',
      type: 'text',
      required: true,
    },
    {
      name: 'phone',
      label: 'Telefone',
      type: 'text',
      admin: { condition: (data) => Boolean(data.id) },
    },
    {
      name: 'cpf',
      label: 'CPF',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Formato: 000.000.000-00. Uma conta por CPF.',
      },
      // Normaliza para só dígitos antes de salvar — garante que o índice único
      // funcione mesmo se um cadastro vier com máscara e outro sem.
      hooks: {
        beforeValidate: [({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value)],
      },
      validate: ((value: string | null | undefined) => {
        if (!value) return 'CPF é obrigatório.'
        if (!cpfValido(value)) return 'CPF inválido. Confira os números digitados.'
        return true
      }) satisfies NonNullable<TextField['validate']>,
    },
    {
      name: 'birthDate',
      label: 'Data de Nascimento',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayOnly', displayFormat: 'dd/MM/yyyy' },
        condition: (data) => Boolean(data.id),
      },
      validate: (value: unknown) => {
        if (!value) return true
        const birth = new Date(value as string)
        const today = new Date()
        let age = today.getFullYear() - birth.getFullYear()
        const m = today.getMonth() - birth.getMonth()
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
        if (age < 18) return 'É necessário ter pelo menos 18 anos para criar uma conta.'
        return true
      },
    },
    {
      name: 'role',
      label: 'Função',
      type: 'select',
      defaultValue: 'client',
      options: [
        { label: 'Administrador', value: 'admin' },
        { label: 'Cliente', value: 'client' },
      ],
      access: {
        create: ({ req: { user } }) => (user as WithRole | null)?.role === 'admin',
        update: ({ req: { user } }) => (user as WithRole | null)?.role === 'admin',
      },
      admin: { condition: (data) => Boolean(data.id) },
    },
    {
      name: '_verified',
      type: 'checkbox',
      admin: { hidden: true },
    },
    {
      name: 'addresses',
      label: 'Endereços',
      type: 'array',
      admin: { condition: (data) => Boolean(data.id) },
      fields: [
        {
          name: 'label',
          label: 'Identificação',
          type: 'text',
          admin: { placeholder: 'Ex: Casa, Trabalho' },
        },
        { name: 'street', label: 'Rua / Avenida', type: 'text', required: true },
        { name: 'number', label: 'Número', type: 'text', required: true },
        { name: 'complement', label: 'Complemento', type: 'text' },
        { name: 'neighborhood', label: 'Bairro', type: 'text', required: true },
        { name: 'city', label: 'Cidade', type: 'text', required: true },
        {
          name: 'state',
          label: 'Estado',
          type: 'select',
          required: true,
          options: BRAZIL_STATES,
        },
        { name: 'zipCode', label: 'CEP', type: 'text', required: true },
        { name: 'isDefault', label: 'Endereço Padrão', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'wishlist',
      label: 'Lista de Desejos',
      type: 'relationship',
      relationTo: ['records', 'apparel'],
      hasMany: true,
      admin: { condition: (data) => Boolean(data.id) },
    },
  ],
}
