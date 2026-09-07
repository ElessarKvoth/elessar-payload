import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { listaAdminEmails } from '../src/utils/adminEmails'

// Diagnóstico de conta: responde "por que fulano não consegue entrar?".
//
//   npm run conta:diag                  → lista todas as contas
//   npm run conta:diag pai@exemplo.com  → detalha uma conta
//
// Somente LEITURA: não altera nada. Mostra os quatro motivos que impedem
// login ou acesso ao painel — não verificado, travado por tentativas, papel
// rebaixado para cliente, e conta simplesmente inexistente.

interface ContaCrua {
  id: number | string
  email: string
  name?: string | null
  role?: string | null
  _verified?: boolean | null
  _verificationToken?: string | null
  loginAttempts?: number | null
  lockUntil?: string | null
  resetPasswordExpiration?: string | null
  sessions?: unknown[] | null
  createdAt?: string
  updatedAt?: string
}

const alvo = process.argv[2]?.trim().toLowerCase()
const admins = listaAdminEmails().map((e) => e.toLowerCase())

const payload = await getPayload({ config })

const { docs } = await payload.find({
  collection: 'users',
  where: alvo ? { email: { equals: alvo } } : {},
  limit: alvo ? 1 : 200,
  depth: 0,
  overrideAccess: true,
  showHiddenFields: true,
  sort: 'createdAt',
})

const contas = docs as unknown as ContaCrua[]

if (contas.length === 0) {
  console.error(`\n❌ Nenhuma conta encontrada${alvo ? ` para ${alvo}` : ''}.`)
  if (alvo) {
    console.error('   Confira se o e-mail está escrito exatamente como no cadastro.')
    console.error('   Se a conta não existe mesmo, é este o motivo do login falhar.\n')
  }
  process.exit(1)
}

console.log('\n━━━ ADMIN_EMAILS (quem o servidor considera administrador) ━━━')
console.log(admins.length > 0 ? `  ${admins.join('\n  ')}` : '  ⚠️  VAZIO — ninguém consegue entrar no painel.')

const dataBr = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'

for (const c of contas) {
  const email = (c.email ?? '').toLowerCase()
  const deveriaSerAdmin = admins.includes(email)
  const travadoAte = c.lockUntil ? new Date(c.lockUntil) : null
  const travadoAgora = Boolean(travadoAte && travadoAte.getTime() > Date.now())

  console.log(`\n━━━ ${c.email} ━━━`)
  console.log(`  Nome            : ${c.name ?? '—'}`)
  console.log(`  Papel atual     : ${c.role ?? '—'}${deveriaSerAdmin ? '  (está em ADMIN_EMAILS)' : '  (NÃO está em ADMIN_EMAILS)'}`)
  console.log(`  E-mail confirmado: ${c._verified ? '✅ sim' : '❌ NÃO'}`)
  console.log(`  Token de confirmação pendente: ${c._verificationToken ? 'sim' : 'não'}`)
  console.log(`  Tentativas de login erradas  : ${c.loginAttempts ?? 0}`)
  console.log(`  Travada até     : ${travadoAgora ? `🔒 ${dataBr(c.lockUntil)}` : '— (não está travada)'}`)
  console.log(`  Sessões ativas  : ${c.sessions?.length ?? 0}`)
  console.log(`  Criada em       : ${dataBr(c.createdAt)}`)
  console.log(`  Última alteração: ${dataBr(c.updatedAt)}`)

  // ── Veredito ──────────────────────────────────────────────────────────────
  const problemas: string[] = []

  if (c._verified !== true) {
    problemas.push(
      'CONTA NÃO CONFIRMADA — o login é recusado com 401 até ela confirmar o e-mail.\n' +
        '     Solução: reenviar a confirmação, ou marcar como confirmada no painel.',
    )
  }
  if (travadoAgora) {
    problemas.push(
      `CONTA TRAVADA por tentativas erradas até ${dataBr(c.lockUntil)}.\n` +
        '     Destrava sozinha no horário acima, ou com "Unlock" no painel.',
    )
  }
  if (deveriaSerAdmin && c.role !== 'admin') {
    problemas.push(
      'ESTÁ EM ADMIN_EMAILS MAS O PAPEL É CLIENTE — o painel vai recusar a entrada.\n' +
        '     O papel só é recalculado quando a conta é salva. Solução: abrir a conta\n' +
        '     no painel e salvar, ou rodar npm run admin:create.',
    )
  }
  if (!deveriaSerAdmin && c.role === 'admin') {
    problemas.push(
      'É ADMIN MAS NÃO ESTÁ EM ADMIN_EMAILS — na próxima vez que esta conta for\n' +
        '     salva, ela vira cliente e PERDE o painel. Adicione o e-mail a ADMIN_EMAILS.',
    )
  }
  if (!deveriaSerAdmin && c.role !== 'admin') {
    problemas.push(
      'CONTA DE CLIENTE — loja funciona, painel /admin não. Se ela deveria administrar\n' +
        '     a loja, adicione o e-mail a ADMIN_EMAILS e faça o deploy.',
    )
  }

  if (problemas.length === 0) {
    console.log('\n  ✅ Nada impede o login nem o acesso ao painel.')
    console.log('     Se ainda assim não entra, o problema é senha errada ou CSRF/origem.')
  } else {
    console.log('\n  Motivos que explicam a falha:')
    for (const p of problemas) console.log(`  ⚠️  ${p}`)
  }
}

console.log('')
process.exit(0)
