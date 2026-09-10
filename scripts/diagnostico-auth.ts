import 'dotenv/config'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '../src/payload.config'
import { hashDoToken } from '../src/utils/tokens'
import { PRAZO_VERIFICACAO_MS } from '../src/utils/emailVerificacao'

/**
 * Diagnóstico do fluxo de conta, de ponta a ponta.
 *
 *   npm run auth:diag
 *
 * Percorre a cadeia inteira contra o servidor REAL — cadastro, confirmação,
 * reenvio, login, esqueci, redefinir, trocar — e imprime uma tabela de ✅/❌.
 *
 * POR QUE ISTO EXISTE
 * ───────────────────
 * O `CONTRATO-FRONT-AUTH.md` já esteve errado por meses: descrevia como
 * pendentes três endpoints que existiam e funcionavam. O storefront foi
 * construído acreditando nele e ficou todo esse tempo trocando senha sem
 * derrubar sessão. Prosa não avisa quando envelhece; este script avisa.
 *
 * Roda contra HTTP, não contra a API local do Payload, de propósito: é o
 * caminho que o storefront usa. Um teste pela API local passaria por verde com
 * o endpoint desregistrado, o CORS fechado ou a rota renomeada.
 *
 * SEGURANÇA DOS DADOS
 * ───────────────────
 * O DATABASE_URI aponta para o mesmo Neon da produção. Este script portanto:
 *   • cria UMA conta descartável, com e-mail carimbado com a hora;
 *   • toca exclusivamente nessa conta;
 *   • apaga a conta no fim, mesmo se algum passo falhar (bloco `finally`);
 *   • não envia e-mail para ninguém de verdade — o endereço é de um domínio
 *     reservado para exemplos (RFC 2606) e não existe caixa do outro lado.
 * Nenhum registro do acervo é lido, alterado ou removido.
 */

// ── Alvo ─────────────────────────────────────────────────────────────────────

const base = (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/+$/, '')

// `.invalid` é reservado pela RFC 2606: nunca vai existir, então nem que o
// Resend receba o envio ele entrega a alguém de verdade.
const marca = Date.now()
const EMAIL = `auth-diag-${marca}@exemplo.invalid`
const SENHA = 'diagnostico-123'
const SENHA_NOVA = 'diagnostico-456'

/**
 * CPF válido e diferente a cada execução.
 *
 * Não dá para usar um CPF fixo: o campo é ÚNICO, então a segunda rodada
 * colidiria com a primeira — e um CPF de exemplo conhecido pode já estar numa
 * conta real do acervo, o que fazia o diagnóstico falhar por motivo nenhum.
 * Os nove primeiros dígitos vêm do relógio; os dois últimos são calculados
 * pela regra oficial, porque a collection confere os verificadores de verdade.
 */
function cpfDeTeste(semente: number): string {
  const base = String(semente).slice(-9).padStart(9, '0').split('').map(Number)

  const digito = (nums: number[]): number => {
    const peso = nums.length + 1
    const soma = nums.reduce((acc, n, i) => acc + n * (peso - i), 0)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  const d1 = digito(base)
  const d2 = digito([...base, d1])
  return [...base, d1, d2].join('')
}

const CPF = cpfDeTeste(marca)
const CPF_MENOR = cpfDeTeste(marca + 1)

// ── Placar ───────────────────────────────────────────────────────────────────

interface Resultado {
  nome: string
  ok: boolean
  detalhe: string
}

const resultados: Resultado[] = []

function checar(nome: string, ok: boolean, detalhe: string): void {
  resultados.push({ nome, ok, detalhe })
  console.log(`  ${ok ? '✅' : '❌'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
}

interface Resposta {
  status: number
  body: Record<string, unknown>
}

async function post(caminho: string, corpo: unknown, token?: string): Promise<Resposta> {
  const res = await fetch(`${base}${caminho}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(corpo),
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, body }
}

async function patch(caminho: string, corpo: unknown, token: string): Promise<Resposta> {
  const res = await fetch(`${base}${caminho}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(corpo),
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, body }
}

/** Lê a conta pelo adapter: os campos de controle são ocultos na API. */
async function lerConta(payload: Payload): Promise<Record<string, unknown> | null> {
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: EMAIL } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    showHiddenFields: true,
  })
  return (docs[0] as unknown as Record<string, unknown> | undefined) ?? null
}

// ── Execução ─────────────────────────────────────────────────────────────────

const payload = await getPayload({ config })

console.log('\n━━━ Diagnóstico de conta ━━━')
console.log(`  Servidor : ${base}`)
console.log(`  Conta    : ${EMAIL} (descartável, apagada no fim)`)

// O script fala com o servidor por HTTP: se não houver um de pé, tudo falha em
// cascata e a tabela de erros não diz nada. Melhor parar aqui e explicar.
try {
  const ping = await fetch(`${base}/api/globals/paginas-legais`, { method: 'GET' })
  if (!ping.ok && ping.status >= 500) throw new Error(`HTTP ${ping.status}`)
} catch (err) {
  console.error(`\n❌ Não consegui falar com ${base}.`)
  console.error(`   ${(err as Error).message}`)
  console.error('\n   Suba o servidor primeiro (npm run dev) ou aponte o alvo:')
  console.error('   NEXT_PUBLIC_SERVER_URL=https://seu-backend npm run auth:diag\n')
  process.exit(1)
}

let idDaConta: number | string | null = null

try {
  // ── 1. Cadastro ───────────────────────────────────────────────────────────
  console.log('\n── Cadastro ──')

  const semTermos = await post('/api/users', {
    name: 'Diagnóstico', email: `recusa-${marca}@exemplo.invalid`,
    password: SENHA, cpf: CPF,
  })
  checar(
    'Cadastro sem aceite de termos é recusado',
    semTermos.status === 400,
    `HTTP ${semTermos.status}`,
  )

  const cpfRuim = await post('/api/users', {
    name: 'Diagnóstico', email: `recusa2-${marca}@exemplo.invalid`,
    password: SENHA, cpf: '11111111111', aceitouTermos: true,
  })
  checar('CPF inválido é recusado', cpfRuim.status === 400, `HTTP ${cpfRuim.status}`)

  const menor = new Date()
  menor.setFullYear(menor.getFullYear() - 15)
  const deMenor = await post('/api/users', {
    name: 'Diagnóstico', email: `recusa3-${marca}@exemplo.invalid`,
    password: SENHA, cpf: CPF_MENOR, aceitouTermos: true,
    birthDate: menor.toISOString().slice(0, 10),
  })
  checar(
    'Menor de 18 anos é recusado',
    deMenor.status === 400,
    deMenor.status === 400
      ? 'HTTP 400'
      : `FALHA GRAVE: HTTP ${deMenor.status} — conta de menor foi criada`,
  )

  // O ataque que estava aberto: nascer confirmado e pular o e-mail inteiro.
  const criacao = await post('/api/users', {
    name: 'Conta de Diagnóstico', email: EMAIL, password: SENHA, cpf: CPF,
    aceitouTermos: true, aceitouComunicacoesMarketing: false,
    _verified: true,   // ← precisa ser descartado
    role: 'admin',     // ← precisa ser descartado
  })
  checar('Cadastro criado', criacao.status === 201, `HTTP ${criacao.status}`)

  if (criacao.status !== 201) {
    throw new Error(`Cadastro falhou, sem como seguir: ${JSON.stringify(criacao.body).slice(0, 300)}`)
  }

  let conta = await lerConta(payload)
  idDaConta = (conta?.id as number | string | undefined) ?? null

  checar(
    'POST com "_verified: true" NÃO confirma a conta',
    conta?._verified !== true,
    conta?._verified === true ? 'FALHA GRAVE: nasceu confirmada' : 'descartado',
  )
  checar(
    'POST com "role: admin" NÃO vira administrador',
    conta?.role !== 'admin',
    `role=${String(conta?.role)}`,
  )
  checar('Token de confirmação foi gerado', Boolean(conta?._verificationToken), '')
  checar('Prazo de 24h foi carimbado', Boolean(conta?.verificacaoExpiraEm), '')
  checar(
    'Prova do aceite gravada (versão, data, IP, hash)',
    Boolean(conta?.versaoTermosAceita && conta?.dataHoraAceite && conta?.hashDosTermosAceitos),
    `versão ${String(conta?.versaoTermosAceita)}`,
  )

  // ── 2. Login antes de confirmar ───────────────────────────────────────────
  console.log('\n── Login antes de confirmar ──')

  const senhaCerta = await post('/api/conta/entrar', { email: EMAIL, password: SENHA })
  checar(
    'Senha certa + não confirmado → email_nao_confirmado (403)',
    senhaCerta.status === 403 && senhaCerta.body.estado === 'email_nao_confirmado',
    `HTTP ${senhaCerta.status} estado=${String(senhaCerta.body.estado)}`,
  )
  checar(
    'A resposta abre o botão de reenvio',
    senhaCerta.body.podeReenviarConfirmacao === true,
    '',
  )

  const senhaErrada = await post('/api/conta/entrar', { email: EMAIL, password: 'errada-de-proposito' })
  checar(
    'Senha errada NÃO revela que a conta existe',
    senhaErrada.body.estado === 'credenciais_invalidas',
    `estado=${String(senhaErrada.body.estado)}`,
  )

  // ── 3. Link expirado e reenvio ────────────────────────────────────────────
  console.log('\n── Confirmação de e-mail ──')

  const tokenOriginal = String(conta?._verificationToken ?? '')

  // Envelhece o link à força para provar que o prazo é conferido — o Payload
  // nativo não expira token de verificação nenhum.
  await payload.db.updateOne({
    collection: 'users',
    id: idDaConta as number,
    data: { verificacaoExpiraEm: new Date(Date.now() - 1000).toISOString() },
    returning: false,
  })

  const expirado = await post('/api/conta/verificar', { token: tokenOriginal })
  checar(
    'Link vencido → token_expirado (410)',
    expirado.status === 410 && expirado.body.estado === 'token_expirado',
    `HTTP ${expirado.status} estado=${String(expirado.body.estado)}`,
  )

  const inventado = await post('/api/conta/verificar', { token: 'nao-existe-este-token' })
  checar(
    'Token inventado → token_invalido (400)',
    inventado.status === 400 && inventado.body.estado === 'token_invalido',
    `HTTP ${inventado.status} estado=${String(inventado.body.estado)}`,
  )

  const reenvio = await post('/api/conta/reenviar-verificacao', { email: EMAIL })
  checar('Reenvio aceito', reenvio.status === 200 && reenvio.body.estado === 'enviado', '')

  const inexistente = await post('/api/conta/reenviar-verificacao', {
    email: `nunca-existiu-${marca}@exemplo.invalid`,
  })
  checar(
    'Reenvio responde IGUAL para conta inexistente',
    inexistente.status === reenvio.status && inexistente.body.mensagem === reenvio.body.mensagem,
    'não dá para enumerar clientes',
  )

  conta = await lerConta(payload)
  const tokenNovo = String(conta?._verificationToken ?? '')

  checar('Reenvio gerou token novo', Boolean(tokenNovo) && tokenNovo !== tokenOriginal, '')
  checar(
    'Reenvio renovou o prazo de 24h',
    Boolean(conta?.verificacaoExpiraEm) &&
      new Date(String(conta?.verificacaoExpiraEm)).getTime() > Date.now() + PRAZO_VERIFICACAO_MS - 60_000,
    '',
  )
  checar('Reenvio carimbou o último envio', Boolean(conta?.verificacaoUltimoEnvioEm), '')

  const antigo = await post('/api/conta/verificar', { token: tokenOriginal })
  checar(
    'Link anterior parou de funcionar',
    antigo.body.estado === 'token_invalido',
    `estado=${String(antigo.body.estado)}`,
  )

  const reenvioSeguido = await post('/api/conta/reenviar-verificacao', { email: EMAIL })
  conta = await lerConta(payload)
  checar(
    'Segundo reenvio no mesmo minuto é descartado em silêncio',
    reenvioSeguido.status === 200 && String(conta?._verificationToken) === tokenNovo,
    'token não mudou, resposta igual',
  )

  // ── 4. Confirmar ──────────────────────────────────────────────────────────
  const confirmou = await post('/api/conta/verificar', { token: tokenNovo })
  checar(
    'Confirmação → sucesso (200)',
    confirmou.status === 200 && confirmou.body.estado === 'sucesso',
    `HTTP ${confirmou.status} estado=${String(confirmou.body.estado)}`,
  )

  conta = await lerConta(payload)
  checar('Conta ficou verificada', conta?._verified === true, '')
  checar(
    'Hash do token usado foi guardado',
    conta?.verificacaoTokenUsadoHash === hashDoToken(tokenNovo),
    'é o que reconhece o 2º clique',
  )

  const segundoClique = await post('/api/conta/verificar', { token: tokenNovo })
  checar(
    'Clicar de novo no mesmo link → ja_verificado (200)',
    segundoClique.status === 200 && segundoClique.body.estado === 'ja_verificado',
    `estado=${String(segundoClique.body.estado)}`,
  )

  // ── 5. Login ──────────────────────────────────────────────────────────────
  console.log('\n── Login ──')

  const login = await post('/api/conta/entrar', { email: EMAIL, password: SENHA })
  checar(
    'Login → sucesso (200) com token',
    login.status === 200 && typeof login.body.token === 'string',
    `HTTP ${login.status}`,
  )
  checar('Login informa a versão dos termos vigente', 'precisaAceitarNovosTermos' in login.body, '')

  const token = String(login.body.token ?? '')

  const me = await fetch(`${base}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } })
  const meBody = (await me.json().catch(() => ({}))) as { user?: { email?: string } | null }
  checar('GET /api/users/me reconhece o token', meBody.user?.email === EMAIL, '')

  // ── 6. As portas que precisam estar fechadas ──────────────────────────────
  console.log('\n── Portas fechadas ──')

  const patchSenha = await patch(`/api/users/${idDaConta}`, { password: 'contrabando-123' }, token)
  checar(
    'PATCH /api/users/:id NÃO troca a senha',
    patchSenha.status >= 400,
    patchSenha.status >= 400
      ? `recusado com HTTP ${patchSenha.status}`
      : 'FALHA GRAVE: trocou sem derrubar sessão nem avisar',
  )

  const patchVerificado = await patch(`/api/users/${idDaConta}`, { _verified: false }, token)
  const contaDepois = await lerConta(payload)
  checar(
    'PATCH não consegue mexer em "_verified"',
    contaDepois?._verified === true,
    `HTTP ${patchVerificado.status}, continua verificada`,
  )

  const patchPapel = await patch(`/api/users/${idDaConta}`, { role: 'admin' }, token)
  const contaPapel = await lerConta(payload)
  checar(
    'PATCH não consegue virar administrador',
    contaPapel?.role !== 'admin',
    `HTTP ${patchPapel.status}, role=${String(contaPapel?.role)}`,
  )

  // Confirma que a senha antiga continua valendo — ou seja, o PATCH acima
  // realmente não passou. Sem esta conferência, um 400 por outro motivo
  // qualquer passaria por "porta fechada".
  const aindaEntra = await post('/api/conta/entrar', { email: EMAIL, password: SENHA })
  checar(
    'Senha original continua valendo depois do PATCH',
    aindaEntra.status === 200,
    'prova que o PATCH não gravou',
  )

  // ── 7. Trocar a senha estando logado ──────────────────────────────────────
  console.log('\n── Trocar senha (logado) ──')

  const tokenValido = String(aindaEntra.body.token ?? token)

  const semAuth = await post('/api/conta/trocar-senha', { senhaAtual: SENHA, novaSenha: SENHA_NOVA })
  checar(
    'Sem estar logado → nao_autenticado (401)',
    semAuth.status === 401,
    `HTTP ${semAuth.status}`,
  )

  const atualErrada = await post(
    '/api/conta/trocar-senha',
    { senhaAtual: 'nao-e-essa', novaSenha: SENHA_NOVA },
    tokenValido,
  )
  checar(
    'Senha atual errada → senha_atual_incorreta (403)',
    atualErrada.status === 403 && atualErrada.body.estado === 'senha_atual_incorreta',
    `HTTP ${atualErrada.status} estado=${String(atualErrada.body.estado)}`,
  )

  const fraca = await post(
    '/api/conta/trocar-senha',
    { senhaAtual: SENHA, novaSenha: 'curta' },
    tokenValido,
  )
  checar('Senha nova curta → senha_fraca (400)', fraca.body.estado === 'senha_fraca', '')

  const repetida = await post(
    '/api/conta/trocar-senha',
    { senhaAtual: SENHA, novaSenha: SENHA },
    tokenValido,
  )
  checar('Senha nova igual à atual é recusada', repetida.body.estado === 'senha_repetida', '')

  const trocou = await post(
    '/api/conta/trocar-senha',
    { senhaAtual: SENHA, novaSenha: SENHA_NOVA },
    tokenValido,
  )
  checar(
    'Troca de senha → sucesso (200)',
    trocou.status === 200 && trocou.body.estado === 'sucesso',
    `HTTP ${trocou.status} estado=${String(trocou.body.estado)}`,
  )
  checar('Resposta pede para entrar de novo', trocou.body.precisaEntrarDeNovo === true, '')

  // O ponto central: a sessão de antes tem que estar morta.
  const meDepois = await fetch(`${base}/api/users/me`, {
    headers: { Authorization: `Bearer ${tokenValido}` },
  })
  const meDepoisBody = (await meDepois.json().catch(() => ({}))) as { user?: unknown }
  checar(
    'Sessão ANTIGA foi derrubada pela troca',
    !meDepoisBody.user,
    meDepoisBody.user ? 'FALHA GRAVE: token antigo ainda vale' : 'token antigo recusado',
  )

  const senhaVelha = await post('/api/conta/entrar', { email: EMAIL, password: SENHA })
  checar('Senha antiga não entra mais', senhaVelha.status === 401, `HTTP ${senhaVelha.status}`)

  const senhaNova = await post('/api/conta/entrar', { email: EMAIL, password: SENHA_NOVA })
  checar('Senha nova entra', senhaNova.status === 200, `HTTP ${senhaNova.status}`)

  // ── 8. Esqueci / redefinir ────────────────────────────────────────────────
  console.log('\n── Esqueci a senha ──')

  const esqueci = await post('/api/conta/esqueci-senha', { email: EMAIL })
  checar(
    'Pedido aceito',
    esqueci.status === 200 && esqueci.body.estado === 'enviado',
    `HTTP ${esqueci.status}`,
  )

  const esqueciFantasma = await post('/api/conta/esqueci-senha', {
    email: `nunca-existiu-${marca}@exemplo.invalid`,
  })
  checar(
    'Responde IGUAL para e-mail inexistente',
    esqueciFantasma.status === esqueci.status &&
      esqueciFantasma.body.mensagem === esqueci.body.mensagem,
    'não dá para enumerar clientes',
  )

  const contaReset = await lerConta(payload)
  const tokenReset = String(contaReset?.resetPasswordToken ?? '')
  checar('Token de redefinição gerado', Boolean(tokenReset), '')

  const linkRuim = await post('/api/conta/redefinir-senha', {
    token: 'token-que-nunca-existiu', password: 'qualquer-senha-123',
  })
  checar('Token inventado → link_invalido', linkRuim.body.estado === 'link_invalido', '')

  const resetFraca = await post('/api/conta/redefinir-senha', { token: tokenReset, password: 'abc' })
  checar('Senha curta → senha_fraca', resetFraca.body.estado === 'senha_fraca', '')

  const sessaoAntesDoReset = String(senhaNova.body.token ?? '')

  const SENHA_FINAL = 'diagnostico-789'
  const reset = await post('/api/conta/redefinir-senha', {
    token: tokenReset, password: SENHA_FINAL,
  })
  checar(
    'Redefinição → sucesso (200)',
    reset.status === 200 && reset.body.estado === 'sucesso',
    `HTTP ${reset.status} estado=${String(reset.body.estado)}`,
  )
  checar(
    'Redefinição NÃO devolve token (sessões derrubadas)',
    !reset.body.token && reset.body.precisaEntrarDeNovo === true,
    'front deve mandar entrar de novo',
  )

  const meAposReset = await fetch(`${base}/api/users/me`, {
    headers: { Authorization: `Bearer ${sessaoAntesDoReset}` },
  })
  const meAposResetBody = (await meAposReset.json().catch(() => ({}))) as { user?: unknown }
  checar(
    'Sessão anterior morreu com a redefinição',
    !meAposResetBody.user,
    meAposResetBody.user ? 'FALHA GRAVE: invasor continuaria logado' : 'token antigo recusado',
  )

  const linkUsado = await post('/api/conta/redefinir-senha', {
    token: tokenReset, password: 'outra-senha-123',
  })
  checar('Link de redefinição não serve duas vezes', linkUsado.body.estado === 'link_invalido', '')

  const entradaFinal = await post('/api/conta/entrar', { email: EMAIL, password: SENHA_FINAL })
  checar('Entra com a senha redefinida', entradaFinal.status === 200, `HTTP ${entradaFinal.status}`)

  // ── 9. Bloqueio por tentativas ────────────────────────────────────────────
  console.log('\n── Bloqueio por tentativas ──')

  // Este teste vem por último de propósito: ele queima tentativas de login, e o
  // endpoint tem teto de 10 por minuto POR IP. Como o diagnóstico já gastou
  // várias até aqui, o teto costuma estourar antes de a conta travar — e um 429
  // seria lido como "não travou", que é o contrário do que está acontecendo.
  // Por isso o laço espera a janela do IP virar em vez de desistir.
  let travou = false
  let esperou = false

  for (let i = 0; i < 12 && !travou; i++) {
    const r = await post('/api/conta/entrar', { email: EMAIL, password: `errada-${i}` })

    if (r.status === 423 && r.body.estado === 'conta_travada') { travou = true; break }

    if (r.status === 429) {
      if (esperou) break // já esperamos uma vez; insistir só empata o diagnóstico
      // A janela do limitador é de 60s (JANELA_MS em endpoints/entrar.ts).
      const segundos = 61
      console.log(`     ⏳ teto por IP atingido; aguardando ${segundos}s para concluir o teste…`)
      await new Promise((r) => setTimeout(r, segundos * 1000))
      esperou = true
      i-- // esta tentativa não chegou a contar como senha errada
    }
  }

  checar(
    'Senhas erradas seguidas travam a conta → conta_travada (423)',
    travou,
    travou
      ? 'com estado próprio, não "credenciais inválidas"'
      : 'NÃO travou — a conta aceita tentativas ilimitadas',
  )

  if (travou) {
    // Destrava a conta de teste antes de removê-la: se a remoção falhar por
    // algum motivo, ninguém herda uma conta travada por 10 minutos.
    await payload.db.updateOne({
      collection: 'users',
      id: idDaConta as number,
      data: { lockUntil: null, loginAttempts: 0 },
      returning: false,
    })
  }

  // ── 10. E-mail ────────────────────────────────────────────────────────────
  console.log('\n── Envio de e-mail ──')

  const temChave = Boolean(process.env.RESEND_API_KEY)
  checar(
    'Transporte de e-mail configurado',
    temChave,
    temChave
      ? `Resend, remetente ${process.env.EMAIL_FROM || 'nao-responda@elessarrecords.com.br'}`
      : 'RESEND_API_KEY ausente: NADA sai de verdade, só aparece no console',
  )
  if (process.env.EMAIL_REDIRECT_TO) {
    checar(
      'EMAIL_REDIRECT_TO desligado',
      false,
      `ligado para ${process.env.EMAIL_REDIRECT_TO} — nunca deve estar assim em produção`,
    )
  }
  console.log('     ℹ️  Para testar a entrega de verdade: npm run email:diag seu@email.com')
} catch (err) {
  console.error(`\n💥 Interrompido: ${(err as Error).message}`)
  resultados.push({ nome: 'Execução completa', ok: false, detalhe: (err as Error).message })
} finally {
  // ── Limpeza ────────────────────────────────────────────────────────────────
  // No `finally` de propósito: uma falha no meio não pode deixar conta de teste
  // no banco de produção.
  if (idDaConta !== null) {
    try {
      await payload.delete({ collection: 'users', id: idDaConta, overrideAccess: true })
      console.log(`\n🧹 Conta de teste removida (id ${idDaConta}).`)
    } catch (err) {
      console.error(
        `\n⚠️  NÃO consegui remover a conta de teste (id ${idDaConta}, ${EMAIL}): ` +
          `${(err as Error).message}\n   Apague pelo painel.`,
      )
    }
  }

  // As contas de recusa não chegam a ser criadas (o servidor as rejeita), mas
  // se alguma regra mudar e uma passar, ela some aqui em vez de ficar no banco.
  try {
    const { docs } = await payload.find({
      collection: 'users',
      where: { email: { like: `%-${marca}@exemplo.invalid` } },
      limit: 10,
      overrideAccess: true,
    })
    for (const sobra of docs) {
      await payload.delete({ collection: 'users', id: sobra.id, overrideAccess: true })
      console.log(`🧹 Removida conta residual ${String((sobra as { email?: string }).email)}.`)
    }
  } catch {
    // Varredura é cortesia: se falhar, o essencial (a conta principal) já saiu.
  }
}

// ── Placar final ─────────────────────────────────────────────────────────────

const falhas = resultados.filter((r) => !r.ok)

console.log('\n━━━ Resultado ━━━')
console.log(`  ${resultados.length - falhas.length}/${resultados.length} verificações passaram.`)

if (falhas.length > 0) {
  console.log('\n  Falhas:')
  for (const f of falhas) console.log(`   ❌ ${f.nome}${f.detalhe ? ` — ${f.detalhe}` : ''}`)
  console.log('')
  process.exit(1)
}

console.log('\n  ✅ Cadastro, confirmação, login, senha e bloqueio estão de pé.\n')
process.exit(0)
