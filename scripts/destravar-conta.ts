import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

// Destrava uma conta bloqueada por tentativas de senha erradas e, se pedido,
// marca o e-mail como confirmado.
//
//   npm run conta:destravar pai@exemplo.com
//   npm run conta:destravar pai@exemplo.com --confirmar
//
// O Payload trava a conta por 10 minutos após 5 senhas erradas, e enquanto
// travada recusa ATÉ A SENHA CERTA. Quem insiste durante o bloqueio reinicia a
// contagem e nunca entra. Este script quebra esse laço.
//
// ESCREVE NO BANCO — e o banco é o mesmo de produção. Use com o e-mail exato.

const alvo = process.argv[2]?.trim().toLowerCase()
const confirmar = process.argv.includes('--confirmar')

if (!alvo) {
  console.error('\n❌ Informe o e-mail:  npm run conta:destravar pessoa@exemplo.com')
  console.error('   Adicione --confirmar para também marcar o e-mail como confirmado.\n')
  process.exit(1)
}

const payload = await getPayload({ config })

const { docs } = await payload.find({
  collection: 'users',
  where: { email: { equals: alvo } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
  showHiddenFields: true,
})

const conta = docs[0] as unknown as
  | { id: number | string; email: string; role?: string; _verified?: boolean | null; lockUntil?: string | null; loginAttempts?: number | null }
  | undefined

if (!conta) {
  console.error(`\n❌ Nenhuma conta com o e-mail ${alvo}.\n`)
  process.exit(1)
}

console.log(`\n━━━ Antes ━━━`)
console.log(`  ${conta.email} | papel: ${conta.role ?? '—'} | confirmado: ${conta._verified ? 'sim' : 'NÃO'}`)
console.log(`  tentativas erradas: ${conta.loginAttempts ?? 0} | travada até: ${conta.lockUntil ?? '—'}`)

// O tipo exportado de `unlock` reaproveita o formato do login e por isso exige
// `password`, mas a operação lê SOMENTE `data.email`
// (auth/operations/unlock.js:17). O cast evita ter que inventar uma senha falsa
// só para satisfazer um tipo errado — nenhuma senha é lida nem gravada aqui.
await payload.unlock({
  collection: 'users',
  data: { email: alvo } as { email: string; password: string },
  overrideAccess: true,
})
console.log('\n✅ Conta destravada (tentativas zeradas).')

if (confirmar) {
  if (conta._verified) {
    console.log('ℹ️  O e-mail já estava confirmado — nada a fazer.')
  } else {
    await payload.update({
      collection: 'users',
      id: conta.id,
      data: { _verified: true, _verificationToken: null } as Record<string, unknown>,
      overrideAccess: true,
    })
    console.log('✅ E-mail marcado como confirmado.')
  }
}

console.log('\n👉 Peça para a pessoa entrar AGORA, sem pressa e sem tentar de cabeça:')
console.log('   se errar 5 vezes de novo, trava por mais 10 minutos.')
console.log('   Se ela não lembra a senha, use "Esqueci minha senha" na loja')
console.log('   — ou, para administrador, npm run admin:create (redefine pelo .env).\n')

process.exit(0)
