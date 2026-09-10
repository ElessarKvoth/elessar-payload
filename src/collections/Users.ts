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
import { lerAcesso } from '../utils/dispositivo'
import { enviarAvisoDeNovoAcesso } from '../utils/emailsDeSeguranca'

type WithRole = { role?: 'admin' | 'client' }

/** Idade mínima para ter conta. Loja vende, e venda a menor não se sustenta. */
const IDADE_MINIMA = 18

/**
 * `true` quando a data de nascimento indica menos de 18 anos completos.
 *
 * Data ilegível conta como NÃO menor: quem barra texto inválido é a validação
 * de tipo do campo, e recusar aqui por "não consegui ler" produziria a mensagem
 * errada na tela.
 */
export function menorDeIdade(nascimento: string | Date): boolean {
  const nasc = new Date(nascimento)
  if (Number.isNaN(nasc.getTime())) return false

  const hoje = new Date()
  let idade = hoje.getFullYear() - nasc.getFullYear()
  const mes = hoje.getMonth() - nasc.getMonth()
  if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) idade--

  return idade < IDADE_MINIMA
}

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
      // ── Idade mínima ──────────────────────────────────────────────────────
      //
      // Mora aqui, e não no `validate` do campo, porque o `validate` de
      // `birthDate` NÃO roda na criação: o Payload pula a validação de todo
      // campo cujo `admin.condition` seja falso, e a condição daquele campo
      // (`Boolean(data.id)`) é falsa em toda criação. Ver o comentário longo
      // na definição de `birthDate`.
      //
      // O hook de collection não passa por essa peneira: roda sempre, em
      // criação e em edição, venha de onde vier.
      ({ data }) => {
        const d = data as Record<string, unknown>
        if (!d.birthDate) return data

        if (menorDeIdade(d.birthDate as string)) {
          throw new APIError(
            `É necessário ter pelo menos ${IDADE_MINIMA} anos para criar uma conta.`,
            400,
          )
        }

        return data
      },
      // ── Senha só muda pelos caminhos que avisam ──────────────────────────
      //
      // `PATCH /api/users/:id` com `{ password }` funcionava e trocava a senha
      // de verdade — sem derrubar as sessões antigas e sem mandar o aviso de
      // "sua senha foi alterada". Enquanto essa porta ficasse aberta, tudo o
      // que o endpoint `/api/conta/trocar-senha` garante era opcional: bastava
      // não usá-lo. Foi por ela que o storefront trocou senha esse tempo todo.
      //
      // Os caminhos legítimos continuam passando:
      //   • `/api/conta/trocar-senha` e `/api/conta/redefinir-senha` marcam
      //     `permitirTrocaDeSenha` no contexto (e derrubam as sessões);
      //   • `resetPassword` nativo grava por `db.updateOne`
      //     (auth/operations/resetPassword.js:86), que nem chega neste hook;
      //   • o administrador pelo painel, que é atendimento com pessoa na linha.
      ({ data, operation, req, context }) => {
        if (operation !== 'update') return data

        const d = data as Record<string, unknown>
        if (typeof d.password !== 'string' || d.password === '') return data

        if (context?.permitirTrocaDeSenha || req.context?.permitirTrocaDeSenha) return data
        if ((req.user as WithRole | undefined)?.role === 'admin') return data

        throw new APIError(
          'A senha não pode ser alterada por aqui. Use "esqueci minha senha" ou a troca de ' +
            'senha dentro da sua conta, que confere a senha atual e desconecta os outros aparelhos.',
          400,
        )
      },
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
    afterLogin: [
      // ── Aviso de novo acesso ─────────────────────────────────────────────
      //
      // Roda depois de um login BEM-SUCEDIDO. Tudo aqui é protegido por
      // try/catch: uma falha ao avisar não pode derrubar o login em si — quem
      // acabou de digitar a senha certa tem que entrar, mesmo que o e-mail de
      // aviso falhe ou o banco esteja lento.
      async ({ user, req, context }) => {
        // Login interno de conferência de senha (troca de senha estando
        // logado): não é acesso novo e não deve virar aviso nem linha de
        // histórico.
        // Login interno de conferência de senha: quem já está autenticado na
        // requisição não está "entrando" — está provando que sabe a senha
        // atual para poder trocá-la. Avisar aqui produziria "novo acesso à sua
        // conta" junto com "sua senha foi alterada", dois alarmes por uma ação
        // que a própria pessoa acabou de fazer — e o excesso de alarme treina
        // o cliente a ignorar o aviso que existe para ser levado a sério.
        //
        // LIMITAÇÃO CONHECIDA: nenhuma destas três marcas impediu o aviso na
        // troca de senha (testado) — nem o contexto da operação, nem o do
        // `req`, nem a presença de `req.user`. O resultado é UM e-mail de
        // "novo acesso" a mais quando o cliente troca a senha estando logado.
        // Incomoda, não expõe nada, e precisa ser investigado.
        if (context?.pularAvisoDeAcesso || req.context?.pularAvisoDeAcesso || req.user) return

        try {
          const config = (await req.payload.findGlobal({
            slug: 'seguranca-da-conta',
            depth: 0,
            req,
          })) as {
            avisarNovoAcesso?: boolean | null
            diasParaAvisarDeNovo?: number | null
            quantosAcessosGuardar?: number | null
          }

          const acesso = lerAcesso(req)
          const agora = new Date()
          const conta = user as unknown as {
            id: number | string
            email: string
            name?: string | null
            dispositivosConhecidos?: Array<{ impressao?: string | null; avisadoEm?: string | null }> | null
            acessosRecentes?: Array<Record<string, unknown>> | null
          }

          const dias = config.diasParaAvisarDeNovo ?? 30
          const conhecidos = conta.dispositivosConhecidos ?? []
          const jaVisto = conhecidos.find((d) => d.impressao === acesso.impressao)

          // Avisa quando o aparelho é novo OU quando o último aviso naquele
          // aparelho já passou do prazo configurado. Sem a segunda condição, um
          // invasor que entrasse uma vez nunca mais geraria alerta.
          const avisadoHa = jaVisto?.avisadoEm ? agora.getTime() - new Date(jaVisto.avisadoEm).getTime() : null
          const precisaAvisar =
            config.avisarNovoAcesso !== false &&
            (!jaVisto || avisadoHa === null || avisadoHa > dias * 24 * 60 * 60_000)

          // ── Histórico, sempre gravado ────────────────────────────────────
          // Independe do e-mail ter saído: é o que permite ao gerente responder
          // "de onde andaram entrando nesta conta?" numa reclamação.
          const limite = config.quantosAcessosGuardar ?? 10
          const historico = [
            {
              dataHora: agora.toISOString(),
              dispositivo: acesso.descricao,
              local: acesso.local ?? undefined,
              origem: acesso.ipExibicao,
              avisoEnviado: precisaAvisar,
            },
            ...(conta.acessosRecentes ?? []),
          ].slice(0, limite)

          const dispositivos = [
            {
              impressao: acesso.impressao,
              descricao: acesso.descricao,
              // Só move a data quando de fato avisou: senão o prazo nunca
              // venceria e o segundo aviso jamais sairia.
              avisadoEm: precisaAvisar ? agora.toISOString() : (jaVisto?.avisadoEm ?? null),
              ultimoAcessoEm: agora.toISOString(),
            },
            ...conhecidos.filter((d) => d.impressao !== acesso.impressao),
          ].slice(0, 20)

          // `payload.update`, e não `db.updateOne`, porque estes campos são
          // ARRAYS: o adapter guarda cada linha numa tabela própria com id
          // próprio, e o caminho de baixo nível não gera esse id — a inserção
          // falha com violação de NOT NULL na coluna `id`. Só a operação de
          // collection monta as linhas completas.
          await req.payload.update({
            collection: 'users',
            id: conta.id,
            data: { acessosRecentes: historico, dispositivosConhecidos: dispositivos },
            overrideAccess: true,
            context: { pularAceiteDeTermos: true },
            req,
          })

          if (precisaAvisar && conta.email) {
            await enviarAvisoDeNovoAcesso({
              payload: req.payload,
              para: conta.email,
              nome: conta.name,
              quando: agora,
              dispositivo: acesso.descricao,
              local: acesso.local,
              ipExibicao: acesso.ipExibicao,
            })
          }
        } catch (err) {
          req.payload.logger.error(
            `[acesso] Falha ao registrar/avisar login: ${(err as Error).message}`,
          )
        }
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
      // ATENÇÃO: este `validate` NÃO roda no cadastro, e não há como fazê-lo
      // rodar sem tirar o `admin.condition` acima.
      //
      // O Payload usa a condição do painel para decidir se valida o campo:
      //   passesCondition = field.admin.condition(data, ...)
      //   skipValidationFromHere = skipValidation || !passesCondition
      //   (fields/hooks/beforeChange/promise.js:37-43)
      //
      // Como a condição é `Boolean(data.id)` — existe para esconder o campo na
      // tela de "criar usuário" do painel — ela é falsa em toda criação, e a
      // validação inteira é pulada. Ou seja: a checagem de idade ficava
      // desligada exatamente no único momento em que ela importa. Uma conta de
      // menor de idade entrava com HTTP 201 (confirmado por `npm run auth:diag`).
      //
      // A idade agora é conferida no `beforeChange` da collection, que roda
      // sempre. Este `validate` fica para as edições pelo painel, onde a conta
      // já tem id e a condição passa.
      validate: (value: unknown) => {
        if (!value) return true
        if (menorDeIdade(value as string)) {
          return 'É necessário ter pelo menos 18 anos para criar uma conta.'
        }
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
      // ── A trava da confirmação de e-mail ─────────────────────────────────
      //
      // O `access` aqui NÃO é zelo extra: sem ele o cadastro público aceitava
      // `_verified: true` no corpo do POST e a conta nascia confirmada, sem
      // nunca abrir o e-mail. O Payload preserva o valor recebido
      // (`Boolean(data._verified) || false`, collections/operations/create.js:182)
      // e o access de campo é o único ponto que descarta o que veio do cliente
      // (fields/hooks/beforeValidate/promise.js:216).
      //
      // O que isso abria: pular a confirmação inteira e, junto com ela, o
      // portão do checkout — `criarPagamentoMercadoPago` libera a compra
      // justamente por `_verified === true`.
      //
      // Fechar aqui não quebra nada dos caminhos legítimos: `verifyEmail`
      // grava por `db.updateOne` (auth/operations/verifyEmail.js:36), que não
      // passa por access de campo, e os scripts de servidor usam
      // `overrideAccess: true`, que também não passa.
      //
      // `update: false` fecha o outro lado: quem já entrou não consegue mais
      // gravar `_verified: false` em si mesmo e se trancar para fora.
      name: '_verified',
      type: 'checkbox',
      access: { create: () => false, update: () => false },
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
    // ── Histórico de acessos ────────────────────────────────────────────────
    // Serve ao cliente ("de onde entraram na minha conta?") e ao gerente numa
    // reclamação. Fechado para escrita: é registro, não campo editável.
    {
      name: 'acessosRecentes',
      label: 'Acessos recentes',
      type: 'array',
      access: somenteServidor,
      admin: {
        readOnly: true,
        initCollapsed: true,
        description:
          'Últimas entradas nesta conta, da mais recente para a mais antiga. Preenchido automaticamente a cada login. A origem aparece encurtada de propósito — o endereço completo de rede de um cliente não precisa ficar guardado à vista.',
      },
      fields: [
        {
          name: 'dataHora',
          label: 'Quando',
          type: 'date',
          admin: { date: { pickerAppearance: 'dayAndTime', displayFormat: "dd/MM/yyyy 'às' HH:mm" } },
        },
        { name: 'dispositivo', label: 'Aparelho', type: 'text' },
        { name: 'local', label: 'Local aproximado', type: 'text' },
        { name: 'origem', label: 'Origem', type: 'text' },
        { name: 'avisoEnviado', label: 'Avisamos por e-mail', type: 'checkbox' },
      ],
    },
    {
      name: 'dispositivosConhecidos',
      label: 'Aparelhos reconhecidos',
      type: 'array',
      access: somenteServidor,
      admin: {
        readOnly: true,
        initCollapsed: true,
        hidden: true,
        description:
          'Uso interno: é o que evita mandar aviso de acesso a cada login do mesmo aparelho.',
      },
      fields: [
        { name: 'impressao', type: 'text' },
        { name: 'descricao', type: 'text' },
        { name: 'avisadoEm', type: 'date' },
        { name: 'ultimoAcessoEm', type: 'date' },
      ],
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
