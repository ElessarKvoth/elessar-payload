import type { Endpoint, PayloadRequest } from 'payload'
import { addDataAndFileToRequest, headersWithCors } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'

import { consumir, ipDoRequest } from '../utils/rateLimit'
import { lerAcesso } from '../utils/dispositivo'
import { enviarAvisoDeSenhaAlterada } from '../utils/emailsDeSeguranca'

/* ────────────────────────────────────────────────────────────────────────────
   Fluxos de senha.

   Três endpoints que envolvem os nativos do Payload para acrescentar o que
   falta e é obrigatório: resposta genérica, limite de tentativas, invalidação
   das sessões e o aviso por e-mail.
   ──────────────────────────────────────────────────────────────────────────── */

const TAMANHO_MINIMO = 8

const cors = (req: PayloadRequest, extra?: HeadersInit): Headers =>
  headersWithCors({ headers: new Headers(extra), req })

const responder = (
  req: PayloadRequest,
  corpo: Record<string, unknown>,
  status = 200,
  cabecalhos?: HeadersInit,
): Response => Response.json(corpo, { status, headers: cors(req, cabecalhos) })

/**
 * Troca a senha (quando informada) e derruba TODAS as sessões, preservando o
 * histórico da conta.
 *
 * Sessões zeradas é o que invalida os tokens antigos: a estratégia JWT confere
 * se o `sid` do token ainda consta na lista (auth/strategies/jwt.js). Lista
 * vazia, nenhum token anterior vale.
 */
async function trocarSenhaEDerrubarSessoes(
  req: PayloadRequest,
  id: number | string,
  novaSenha?: string,
): Promise<void> {
  if (novaSenha) {
    // Libera a trava do `beforeChange` da collection, que recusa `password`
    // vindo de update comum. Vai no próprio `req` além da opção `context`:
    // quando o `req` é reaproveitado (como aqui), a opção sozinha não chega
    // até o hook — mesma armadilha documentada em `trocarSenha`.
    ;(req.context as Record<string, unknown>).permitirTrocaDeSenha = true

    // LIMITAÇÃO CONHECIDA: esta atualização zera `acessosRecentes` e
    // `dispositivosConhecidos`. Numa gravação de conta, os campos de array são
    // reescritos a partir do `data`, e reenviá-los explicitamente aqui não
    // impediu o apagamento (testado). A consequência prática é limitada — o
    // cliente perde o histórico de acessos ao trocar a senha e volta a receber
    // aviso no próximo login de cada aparelho —, mas é perda de registro num
    // momento em que ele seria útil, e precisa ser resolvido.
    await req.payload.update({
      collection: 'users',
      id,
      data: { password: novaSenha },
      overrideAccess: true,
      context: { pularAceiteDeTermos: true, permitirTrocaDeSenha: true },
      req,
    })
  }

  // Apaga as linhas da tabela de sessões por SQL direto.
  //
  // Escrever `sessions: []` pela API do Payload — tanto por `payload.update`
  // quanto por `db.updateOne` — leva o adapter a reescrever TODAS as tabelas
  // de array da conta, e `acessosRecentes` e `dispositivosConhecidos` vão
  // junto. Reenviar os arrays na mesma chamada não resolveu. Como o efeito
  // desejado é sobre uma tabela só, o SQL faz exatamente isso e nada além:
  // preserva o histórico que serve justamente para investigar o acesso
  // indevido que costuma motivar a troca de senha.
  const db = req.payload.db as unknown as {
    drizzle: { execute: (q: unknown) => Promise<unknown> }
  }
  await db.drizzle.execute(sql`DELETE FROM "users_sessions" WHERE "_parent_id" = ${id}`)
}

// ── 1. Esqueci minha senha ───────────────────────────────────────────────────

const PEDIDOS_POR_IP = 5
const JANELA_IP_MS = 60 * 60_000
const PEDIDOS_POR_EMAIL = 3
const JANELA_EMAIL_MS = 60 * 60_000

/**
 * POST /api/conta/esqueci-senha   { email }
 *
 * RESPOSTA SEMPRE IGUAL. O endpoint nativo do Payload pode responder diferente
 * para e-mail inexistente, e essa diferença transforma o formulário de
 * "esqueci a senha" numa ferramenta de descobrir quem tem conta na loja —
 * basta um laço com uma lista de e-mails para separar clientes de estranhos.
 */
export const esqueciSenha: Endpoint = {
  path: '/conta/esqueci-senha',
  method: 'post',
  handler: async (req) => {
    const generica = (): Response =>
      responder(req, {
        estado: 'enviado',
        mensagem:
          'Se este e-mail estiver cadastrado, enviamos as instruções para redefinir a senha. ' +
          'Confira a caixa de entrada e o spam.',
      })

    const limiteIp = consumir(`esqueci-ip:${ipDoRequest(req)}`, PEDIDOS_POR_IP, JANELA_IP_MS)
    if (!limiteIp.permitido) {
      return responder(
        req,
        { estado: 'muitas_tentativas', mensagem: 'Muitos pedidos seguidos. Tente mais tarde.' },
        429,
        { 'Retry-After': String(limiteIp.esperarSegundos) },
      )
    }

    await addDataAndFileToRequest(req)
    const email = String((req.data as { email?: unknown })?.email ?? '').trim().toLowerCase()

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return responder(req, { estado: 'email_invalido', mensagem: 'Informe um e-mail válido.' }, 400)
    }

    // Limite por e-mail: impede usar o formulário para inundar a caixa de
    // entrada de uma pessoa específica a partir de vários IPs.
    const limiteEmail = consumir(`esqueci-email:${email}`, PEDIDOS_POR_EMAIL, JANELA_EMAIL_MS)
    if (!limiteEmail.permitido) {
      req.payload.logger.info('[senha] pedido de recuperação recusado pelo teto por e-mail')
      return generica()
    }

    try {
      await req.payload.forgotPassword({
        collection: 'users',
        data: { email },
        req: req as PayloadRequest,
      })
    } catch (err) {
      // Conta inexistente cai aqui. O log registra; a resposta não muda.
      req.payload.logger.info(
        `[senha] pedido de recuperação sem efeito: ${(err as Error).message.slice(0, 120)}`,
      )
    }

    return generica()
  },
}

// ── 2. Redefinir com o token do e-mail ───────────────────────────────────────

/**
 * POST /api/conta/redefinir-senha   { token, password }
 *
 * Envolve o nativo para acrescentar as duas coisas que ele não faz: derrubar
 * as sessões antigas e avisar por e-mail que a senha mudou.
 */
export const redefinirSenha: Endpoint = {
  path: '/conta/redefinir-senha',
  method: 'post',
  handler: async (req) => {
    const limite = consumir(`redefinir:${ipDoRequest(req)}`, 10, 60_000)
    if (!limite.permitido) {
      return responder(
        req,
        { estado: 'muitas_tentativas', mensagem: 'Muitas tentativas. Aguarde um minuto.' },
        429,
        { 'Retry-After': String(limite.esperarSegundos) },
      )
    }

    await addDataAndFileToRequest(req)
    const corpo = (req.data ?? {}) as { token?: unknown; password?: unknown }
    const token = typeof corpo.token === 'string' ? corpo.token.trim() : ''
    const senha = typeof corpo.password === 'string' ? corpo.password : ''

    if (!token) {
      return responder(
        req,
        { estado: 'link_invalido', mensagem: 'Este link expirou ou já foi usado. Peça um novo.' },
        400,
      )
    }
    if (senha.length < TAMANHO_MINIMO) {
      return responder(
        req,
        {
          estado: 'senha_fraca',
          mensagem: `A senha precisa ter pelo menos ${TAMANHO_MINIMO} caracteres.`,
        },
        400,
      )
    }

    try {
      const resultado = await req.payload.resetPassword({
        collection: 'users',
        data: { token, password: senha },
        overrideAccess: true,
        req: req as PayloadRequest,
      })

      const usuario = resultado.user as unknown as {
        id: number | string
        email: string
        name?: string | null
      }

      // Derruba TODAS as sessões, inclusive a que o próprio resetPassword
      // acabou de criar: quem redefine a senha entra de novo com ela. Isso
      // custa um login a mais e garante que nenhum token anterior sobreviva.
      await trocarSenhaEDerrubarSessoes(req as PayloadRequest, usuario.id)

      const acesso = lerAcesso(req)
      await enviarAvisoDeSenhaAlterada({
        payload: req.payload,
        para: usuario.email,
        nome: usuario.name,
        quando: new Date(),
        dispositivo: acesso.descricao,
        local: acesso.local,
      }).catch((err) => {
        // Aviso é obrigatório, mas falhar nele não pode desfazer a troca —
        // a senha nova já vale, e desfazer deixaria o cliente sem nenhuma.
        req.payload.logger.error(`[senha] aviso de senha alterada falhou: ${(err as Error).message}`)
      })

      return responder(req, {
        estado: 'sucesso',
        mensagem: 'Senha alterada. Entre de novo com a senha nova.',
        // De propósito NÃO devolvemos token: todas as sessões foram derrubadas.
        precisaEntrarDeNovo: true,
      })
    } catch {
      return responder(
        req,
        {
          estado: 'link_invalido',
          mensagem: 'Este link expirou ou já foi usado. Peça um novo para redefinir sua senha.',
        },
        400,
      )
    }
  },
}

// ── 3. Trocar a senha estando logado ─────────────────────────────────────────

/**
 * POST /api/conta/trocar-senha   { senhaAtual, novaSenha }   (autenticado)
 *
 * Exige a senha atual. Sem isso, um computador deixado aberto — ou uma sessão
 * roubada — vira conta perdida: bastaria trocar a senha para trancar o dono
 * para fora. Pedir a senha atual é o que garante que quem troca é quem sabe a
 * senha, não apenas quem tem o navegador aberto.
 */
export const trocarSenha: Endpoint = {
  path: '/conta/trocar-senha',
  method: 'post',
  handler: async (req) => {
    if (!req.user) {
      return responder(req, { estado: 'nao_autenticado', mensagem: 'Entre na sua conta primeiro.' }, 401)
    }

    const limite = consumir(`trocar-senha:${req.user.id}`, 5, 15 * 60_000)
    if (!limite.permitido) {
      return responder(
        req,
        {
          estado: 'muitas_tentativas',
          mensagem: 'Muitas tentativas de troca de senha. Aguarde alguns minutos.',
        },
        429,
        { 'Retry-After': String(limite.esperarSegundos) },
      )
    }

    await addDataAndFileToRequest(req)
    const corpo = (req.data ?? {}) as { senhaAtual?: unknown; novaSenha?: unknown }
    const senhaAtual = typeof corpo.senhaAtual === 'string' ? corpo.senhaAtual : ''
    const novaSenha = typeof corpo.novaSenha === 'string' ? corpo.novaSenha : ''

    if (!senhaAtual || !novaSenha) {
      return responder(
        req,
        { estado: 'dados_incompletos', mensagem: 'Informe a senha atual e a nova senha.' },
        400,
      )
    }
    if (novaSenha.length < TAMANHO_MINIMO) {
      return responder(
        req,
        { estado: 'senha_fraca', mensagem: `A nova senha precisa ter pelo menos ${TAMANHO_MINIMO} caracteres.` },
        400,
      )
    }
    if (novaSenha === senhaAtual) {
      return responder(
        req,
        { estado: 'senha_repetida', mensagem: 'A nova senha precisa ser diferente da atual.' },
        400,
      )
    }

    const usuario = req.user as unknown as { id: number | string; email: string; name?: string | null }

    // Confere a senha atual entrando com ela. `login` já cuida da contagem de
    // tentativas e do bloqueio da conta, então não há atalho para adivinhar a
    // senha atual por aqui.
    // A marca vai no próprio `req`: o `afterLogin` lê o contexto da requisição,
    // e a opção `context` passada para `payload.login` não chega até lá quando
    // o `req` é reaproveitado (como aqui).
    ;(req.context as Record<string, unknown>).pularAvisoDeAcesso = true

    try {
      await req.payload.login({
        collection: 'users',
        data: { email: usuario.email, password: senhaAtual },
        req: req as PayloadRequest,
        // Isto NÃO é um acesso novo: é a conferência da senha de quem já está
        // dentro. Sem a marca, o cliente que troca a senha recebe "novo acesso
        // à sua conta" junto com "sua senha foi alterada" — dois e-mails de
        // alarme por uma ação que ele mesmo acabou de fazer, o que ensina a
        // ignorar justamente o aviso que existe para ser levado a sério.
        context: { pularAvisoDeAcesso: true },
      })
    } catch {
      return responder(
        req,
        { estado: 'senha_atual_incorreta', mensagem: 'A senha atual está incorreta.' },
        403,
      )
    }

    await trocarSenhaEDerrubarSessoes(req as PayloadRequest, usuario.id, novaSenha)

    const acesso = lerAcesso(req)
    await enviarAvisoDeSenhaAlterada({
      payload: req.payload,
      para: usuario.email,
      nome: usuario.name,
      quando: new Date(),
      dispositivo: acesso.descricao,
      local: acesso.local,
    }).catch((err) => {
      req.payload.logger.error(`[senha] aviso de senha alterada falhou: ${(err as Error).message}`)
    })

    return responder(req, {
      estado: 'sucesso',
      mensagem: 'Senha alterada. Por segurança, todos os aparelhos foram desconectados.',
      precisaEntrarDeNovo: true,
    })
  },
}
