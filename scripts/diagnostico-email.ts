import 'dotenv/config'

// Diagnóstico do Resend: confere as variáveis, dispara um e-mail de teste real e
// traduz os erros mais comuns. Não depende do Payload nem do banco.
//
//   npm run email:diag seu@email.com
//
// ATENÇÃO: envia um e-mail de verdade para o endereço informado.

const apiKey = process.env.RESEND_API_KEY
const from = process.env.EMAIL_FROM
const destino = process.argv[2]

console.log('\n━━━ Variáveis ━━━')
console.log(`  RESEND_API_KEY : ${apiKey ? `✅ presente (${apiKey.slice(0, 3)}…, ${apiKey.length} chars)` : '❌ AUSENTE'}`)
console.log(`  EMAIL_FROM     : ${from ? `✅ ${from}` : '❌ AUSENTE (o código usa nao-responda@elessarrecords.com.br como padrão)'}`)

if (!apiKey) {
  console.error('\n❌ Sem RESEND_API_KEY não há o que testar. Adicione no .env e rode de novo.\n')
  process.exit(1)
}

if (!destino) {
  console.error('\n❌ Informe o e-mail de destino:  npm run email:diag seu@email.com\n')
  process.exit(1)
}

const remetente = from || 'nao-responda@elessarrecords.com.br'

console.log('\n━━━ Enviando e-mail de teste ━━━')
console.log(`  De   : ${remetente}`)
console.log(`  Para : ${destino}`)

const resp = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: `Elessar Records <${remetente}>`,
    to: [destino],
    subject: 'Teste de e-mail — Elessar Records',
    html: `
      <div style="font-family:sans-serif;background:#14110d;color:#e8e0d0;padding:32px">
        <p style="font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#6b5f45;margin:0 0 16px">
          Elessar Records
        </p>
        <h1 style="margin:0 0 16px;color:#c9a227">Funcionou! 🎸</h1>
        <p style="color:#a89e88;line-height:1.6">
          Se você está lendo isso, o Resend está configurado corretamente e os
          e-mails da loja (confirmação de conta e redefinição de senha) vão sair
          normalmente.
        </p>
      </div>`,
  }),
})

const body = (await resp.json().catch(() => ({}))) as Record<string, unknown>

if (resp.ok) {
  console.log(`\n✅ ENVIADO com sucesso. id: ${String(body.id ?? '?')}`)
  console.log('   Confira a caixa de entrada (e o spam) do destinatário.\n')
  process.exit(0)
}

// ── Traduz os erros mais comuns ───────────────────────────────────────────────
const msg = String(body.message ?? body.error ?? JSON.stringify(body))
console.error(`\n❌ FALHOU (HTTP ${resp.status})`)
console.error(`   Resposta: ${msg}\n`)

const m = msg.toLowerCase()
if (resp.status === 401 || m.includes('api key')) {
  console.error('👉 A API key está inválida ou incompleta. Gere outra no painel do Resend')
  console.error('   (API Keys → Create) e cole inteira no .env, sem espaços.\n')
} else if (m.includes('domain') || m.includes('verif')) {
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
