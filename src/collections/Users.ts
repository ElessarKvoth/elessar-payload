import type { CollectionConfig, TextField } from 'payload'
import { APIError } from 'payload'

import { isAdmin, isAdminOrSelf } from '../access/isAdmin'
import { cpfValido } from '../utils/validarCpf'
import { emailBase, storefrontUrl } from '../utils/emailTemplate'
import { emailEhAdmin, listaAdminEmails } from '../utils/adminEmails'
import { emailDeVerificacao, PRAZO_VERIFICACAO_HORAS, PRAZO_VERIFICACAO_MS } from '../utils/emailVerificacao'
import { termosVigentes } from '../utils/termos'
import { ipDoRequest } from '../utils/rateLimit'
import { somenteServidor } from '../access/isAdmin'

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
      // ── Aceite de termos: exigência e prova ───────────────────────────────
      // A validação mora no SERVIDOR porque é aqui que ela vale. Um checkbox
      // marcado no navegador prova apenas que existia um checkbox: qualquer um
      // manda o POST direto na API sem ele. E os carimbos (versão, data, IP,
      // hash) são calculados aqui, nunca recebidos do cliente — dado que o
      // próprio interessado escreve não serve como prova.
      async ({ data, operation, req }) => {
        if (operation !== 'create') return data

        const d = data as Record<string, unknown>

        // Contas criadas pelo servidor (script de admin, seed) não passam por
        // aceite: não há pessoa do outro lado para aceitar coisa alguma.
        if (req.context?.pularAceiteDeTermos) return data

        if (d.aceitouTermos !== true) {
          throw new APIError(
            'Para criar sua conta é preciso aceitar os Termos de Uso e a Política de Privacidade.',
            400,
          )
        }

        const vigentes = await termosVigentes(req.payload, req)

        d.versaoTermosAceita = vigentes.versao
        d.hashDosTermosAceitos = vigentes.hash
        d.dataHoraAceite = new Date().toISOString()
        d.ipDoAceite = ipDoRequest(req)

        // Marketing é decisão separada e opcional: na dúvida, não.
        d.aceitouComunicacoesMarketing = d.aceitouComunicacoesMarketing === true

        return data
      },
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
    // ── Aceite de termos: prova jurídica ─────────────────────────────────────
    // Todos com `somenteServidor`: o cliente marca o checkbox no cadastro, e a
    // partir daí nada mais escreve nestes campos — nem ele, nem o painel.
    // `admin.readOnly` sozinho não bastaria: ele esconde o campo da tela e
    // deixa a API aberta.
    {
      name: 'aceitouTermos',
      label: 'Aceitou os Termos e a Política de Privacidade',
      type: 'checkbox',
      access: { create: () => true, update: () => false },
      admin: {
        readOnly: true,
        description:
          'Marcado no momento do cadastro. Sem este aceite a conta não é criada. Não pode ser alterado depois — é prova do que o cliente concordou.',
      },
    },
    {
      name: 'versaoTermosAceita',
      label: 'Versão dos termos aceita',
      access: somenteServidor,
      type: 'text',
      admin: {
        readOnly: true,
        description:
          'Qual versão dos termos estava no ar quando o cliente se cadastrou. Quando você muda a versão em "Páginas de Regras", quem tem versão antiga passa a ser considerado pendente de novo aceite.',
      },
    },
    {
      name: 'dataHoraAceite',
      label: 'Data e hora do aceite',
      access: somenteServidor,
      type: 'date',
      admin: {
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime', displayFormat: "dd/MM/yyyy 'às' HH:mm" },
        description: 'Momento exato em que o cliente aceitou, no horário do servidor.',
      },
    },
    {
      name: 'ipDoAceite',
      label: 'IP do aceite',
      access: somenteServidor,
      type: 'text',
      admin: {
        readOnly: true,
        description:
          'Endereço de rede de onde veio o cadastro. Guardado só para comprovar o aceite numa eventual contestação.',
      },
    },
    {
      name: 'hashDosTermosAceitos',
      label: 'Impressão digital do texto aceito',
      access: somenteServidor,
      type: 'text',
      admin: {
        readOnly: true,
        description:
          'Código único calculado a partir do texto exato dos termos naquele momento. Serve para provar QUE TEXTO o cliente aceitou, e não apenas qual número de versão — se alguém editar o texto sem trocar a versão, este código passa a não bater.',
      },
    },
    {
      name: 'aceitouComunicacoesMarketing',
      label: 'Aceita receber novidades por e-mail',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'OPCIONAL e separado do aceite dos termos, como manda a LGPD: consentimento de marketing não pode vir embutido no aceite obrigatório. O cliente pode ligar e desligar quando quiser.',
      },
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
