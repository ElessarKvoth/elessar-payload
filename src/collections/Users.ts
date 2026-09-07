import type { CollectionConfig, TextField } from 'payload'

import { isAdmin, isAdminOrSelf } from '../access/isAdmin'
import { cpfValido } from '../utils/validarCpf'
import { emailBase, storefrontUrl } from '../utils/emailTemplate'
import { emailEhAdmin, listaAdminEmails } from '../utils/adminEmails'
import { emailDeVerificacao, PRAZO_VERIFICACAO_HORAS, PRAZO_VERIFICACAO_MS } from '../utils/emailVerificacao'

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
    // Assunto e corpo vêm de `emailDeVerificacao` para não divergirem do
    // reenvio — os dois caminhos precisam apontar para a mesma URL e prometer
    // o mesmo prazo.
    verify: {
      generateEmailSubject: ({ user }) =>
        emailDeVerificacao({ nome: (user as { name?: string }).name, token: '' }).assunto,
      generateEmailHTML: ({ token, user }) =>
        emailDeVerificacao({ nome: (user as { name?: string }).name, token: token ?? '' }).html,
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
      ({ data, originalDoc, req }) => {
        const d = data as Record<string, unknown>
        const anterior = originalDoc as { email?: string; role?: 'admin' | 'client' } | undefined
        const email = String(d.email ?? anterior?.email ?? '')

        // ── Rede de segurança: ADMIN_EMAILS vazia ────────────────────────────
        // Lista vazia é ERRO DE CONFIGURAÇÃO, não ordem de demitir todo mundo.
        //
        // Sem esta guarda, rodar o servidor sem a variável (um .env local
        // incompleto, um deploy em que ela não foi copiada) rebaixava a conta
        // do administrador para cliente na PRIMEIRA vez que ela fosse salva —
        // inclusive quando o próprio dono editasse o telefone. E como
        // desenvolvimento e produção apontam para o mesmo banco Neon, o
        // rebaixamento ia direto para a loja no ar, sem volta pelo painel
        // (quem perdeu o painel não consegue entrar para se promover).
        //
        // Sintoma que isso produz: "entrei no painel uma vez e nunca mais".
        if (listaAdminEmails().length === 0) {
          req.payload.logger.error(
            '[users] ADMIN_EMAILS está vazia — o papel de ' +
              `${email || 'conta sem e-mail'} foi PRESERVADO em vez de recalculado. ` +
              'Defina ADMIN_EMAILS no .env do servidor (e nas variáveis da Vercel), ' +
              'senão ninguém consegue ser promovido a administrador.',
          )
          // Update preserva o papel atual; criação cai em cliente (nunca admin).
          d.role = anterior?.role ?? 'client'
          return data
        }

        // O papel NUNCA vem do cliente nem do painel: é derivado exclusivamente
        // do e-mail estar (ou não) em ADMIN_EMAILS, lido do .env do servidor.
        //
        // Antes, o primeiro usuário criado virava admin automaticamente. Com o
        // banco zerado e o cadastro da loja aberto ao público, o primeiro
        // visitante a se registrar ganharia o painel inteiro.
        d.role = emailEhAdmin(email) ? 'admin' : 'client'

        return data
      },
    ],
    afterChange: [
      // Carimba o prazo do link de confirmação recém-criado.
      //
      // Precisa ser aqui, e não no beforeChange: o Payload só gera o
      // `_verificationToken` DENTRO da operação de criação, depois dos hooks de
      // gravação (collections/operations/create.js:183). No beforeChange ainda
      // não existe token para datar.
      //
      // Grava por `db.updateOne` de propósito: escreve só esta coluna, sem
      // disparar de novo os hooks da collection nem passar por validação de
      // campo — é carimbo de sistema, não edição de cadastro.
      async ({ doc, operation, req, context }) => {
        if (operation !== 'create' || context.pularPrazoVerificacao) return
        if ((doc as { _verified?: boolean | null })._verified) return

        await req.payload.db.updateOne({
          collection: 'users',
          id: doc.id,
          data: { verificacaoExpiraEm: new Date(Date.now() + PRAZO_VERIFICACAO_MS).toISOString() },
          req,
          returning: false,
        })
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
      // Ninguém escreve neste campo — nem admin, nem pela API. O valor é
      // recalculado no beforeChange a partir de ADMIN_EMAILS.
      access: {
        create: () => false,
        update: () => false,
      },
      admin: {
        readOnly: true,
        condition: (data) => Boolean(data.id),
        description:
          'Definido automaticamente: é admin quem estiver em ADMIN_EMAILS no .env do servidor. Para promover alguém, edite a variável e faça o deploy — não dá para mudar por aqui.',
      },
    },
    {
      name: '_verified',
      type: 'checkbox',
      admin: { hidden: true },
    },
    // ── Confirmação de e-mail: campos de controle ────────────────────────────
    // Todos são carimbo de sistema. `access` fechado (não `admin.readOnly`,
    // que só esconde no painel e deixa a API aberta) e escrita apenas pelos
    // endpoints, via db.updateOne.
    {
      name: 'verificacaoExpiraEm',
      label: 'Link de confirmação vale até',
      type: 'date',
      access: { create: () => false, update: () => false },
      admin: {
        readOnly: true,
        position: 'sidebar',
        condition: (data) => Boolean(data.id) && data._verified !== true,
        date: { pickerAppearance: 'dayAndTime', displayFormat: "dd/MM/yyyy 'às' HH:mm" },
        description: `O link enviado por e-mail vale ${PRAZO_VERIFICACAO_HORAS} horas. Depois disso o cliente precisa pedir um novo pela loja.`,
      },
    },
    {
      name: 'verificacaoUltimoEnvioEm',
      label: 'Última confirmação enviada em',
      type: 'date',
      access: { create: () => false, update: () => false },
      admin: {
        readOnly: true,
        position: 'sidebar',
        condition: (data) => Boolean(data.id) && data._verified !== true,
        date: { pickerAppearance: 'dayAndTime', displayFormat: "dd/MM/yyyy 'às' HH:mm" },
        description:
          'Serve para limitar reenvios: um a cada minuto, no máximo cinco por hora. Evita que a conta de alguém vire ferramenta de spam.',
      },
    },
    {
      // Guarda o HASH do último token consumido — nunca o token.
      // É o que permite responder "este link já foi usado" em vez de "link
      // inválido" quando o cliente clica duas vezes no mesmo e-mail.
      name: 'verificacaoTokenUsadoHash',
      type: 'text',
      access: { create: () => false, update: () => false, read: () => false },
      admin: { hidden: true },
      index: true,
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
