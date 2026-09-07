import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { emailBase, storefrontUrl } from '../src/utils/emailTemplate'
import { enviarEmailTransacional, REMETENTE_PADRAO } from '../src/utils/enviarEmail'

// Diagnóstico do envio de e-mail.
//
//   npm run email:diag seu@email.com
//
// Testa o CAMINHO REAL: sobe o Payload, usa o mesmo adapter e o mesmo
// `enviarEmailTransacional()` que a loja usa em produção. Antes, este script
// falava direto com a API do Resend por `fetch` — passava por verde mesmo com
// o adapter quebrado, e o contrário também. Agora, se o diagnóstico envia, a
// loja envia.
//
// Como sobe o Payload, precisa do banco acessível (DATABASE_URI).
//
// ATENÇÃO: envia um e-mail de verdade para o endereço informado.

const destino = process.argv[2]
const remetente = process.env.EMAIL_FROM || REMETENTE_PADRAO

console.log('\n━━━ Variáveis ━━━')
console.log(`  RESEND_API_KEY   : ${process.env.RESEND_API_KEY ? '✅ presente' : '❌ AUSENTE'}`)
console.log(`  EMAIL_FROM       : ${process.env.EMAIL_FROM ? `✅ ${process.env.EMAIL_FROM}` : `⚠️  ausente (usando o padrão ${REMETENTE_PADRAO})`}`)
console.log(`  EMAIL_REPLY_TO   : ${process.env.EMAIL_REPLY_TO ? `✅ ${process.env.EMAIL_REPLY_TO}` : 'ℹ️  ausente (cai no e-mail de contato do painel)'}`)
console.log(`  EMAIL_REDIRECT_TO: ${process.env.EMAIL_REDIRECT_TO ? `⚠️  ${process.env.EMAIL_REDIRECT_TO} — todo e-mail vai para cá` : 'ℹ️  ausente (normal)'}`)

if (!destino) {
  console.error('\n❌ Informe o e-mail de destino:  npm run email:diag seu@email.com\n')
  process.exit(1)
}

if (!process.env.RESEND_API_KEY) {
  console.error('\n❌ Sem RESEND_API_KEY o envio é apenas simulado no console.')
  console.error('   Adicione a chave ao .env e rode de novo.\n')
  process.exit(1)
}

const payload = await getPayload({ config })

console.log('\n━━━ Enviando pelo caminho real ━━━')
console.log(`  De   : ${remetente}`)
console.log(`  Para : ${destino}`)

const html = emailBase({
  titulo: 'Teste de envio',
  saudacao: 'Olá',
  corpo:
    'Se você está lendo isto, o Resend está configurado corretamente e os e-mails da loja ' +
    '(confirmação de conta, recuperação de senha e avisos de acesso) vão sair normalmente.',
  botaoTexto: 'Abrir a loja',
  botaoUrl: storefrontUrl(),
  rodape: 'Este é um e-mail automático de teste, disparado por npm run email:diag.',
})

const resultado = await enviarEmailTransacional({
  payload,
  tipo: 'diagnostico',
  para: destino,
  assunto: 'Teste de e-mail — Elessar Records',
  html,
})

if (resultado.enviado) {
  console.log('\n✅ ENVIADO pelo adapter oficial.')
  console.log('   Confira a caixa de entrada (e o spam) do destinatário.')
  console.log('   O e-mail levou versão em texto puro e Reply-To junto.\n')
  process.exit(0)
}

// ── Traduz os erros mais comuns ───────────────────────────────────────────────
const msg = resultado.erro ?? 'erro desconhecido'
console.error(`\n❌ FALHOU: ${msg}\n`)

const m = msg.toLowerCase()
if (m.includes('401') || m.includes('api key') || m.includes('unauthorized')) {
  console.error('👉 A API key está inválida ou incompleta. Gere outra no painel do Resend')
  console.error('   (API Keys → Create) e cole inteira no .env, sem espaços.\n')
} else if (m.includes('domain') || m.includes('verif') || m.includes('403')) {
  console.error(`👉 O domínio de "${remetente}" não está verificado no Resend.`)
  console.error('   Opção rápida: troque EMAIL_FROM para onboarding@resend.dev')
  console.error('   (só entrega no e-mail da sua própria conta Resend).')
  console.error('   Opção definitiva: Resend → Domains → adicione elessarrecords.com.br')
  console.error('   e cadastre os registros DNS que ele mostrar.\n')
} else if (m.includes('testing') || m.includes('own email')) {
  console.error('👉 Você está usando o remetente de teste (onboarding@resend.dev), que só')
  console.error('   entrega no e-mail dono da conta Resend. Use esse endereço como destino,')
  console.error('   ou verifique seu domínio para enviar a qualquer um.\n')
}
process.exit(1)
