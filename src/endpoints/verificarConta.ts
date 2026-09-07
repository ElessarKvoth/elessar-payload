import type { Endpoint, PayloadRequest } from 'payload'
import { addDataAndFileToRequest, headersWithCors } from 'payload'

import { consumir, ipDoRequest } from '../utils/rateLimit'
import { hashDoToken } from '../utils/tokens'

/**
 * POST /api/conta/verificar   { token }
 *
 * Confirma o e-mail da conta e devolve um ESTADO NOMEADO, para o storefront
 * conseguir mostrar a tela certa em vez de um "erro" genérico.
 *
 * Existe em vez de usar `POST /api/users/verify/:token` direto por dois
 * motivos que o endpoint nativo não cobre:
 *
 *  1. O Payload não expira token de verificação — `verifyEmailOperation` só
 *     compara `_verificationToken` e pronto. O prazo é conferido aqui.
 *  2. O nativo responde 403 "Verification token is invalid" tanto para link
 *     expirado quanto para link já usado quanto para token inventado. Três
 *     situações muito diferentes para o cliente, uma resposta só.
 *
 * Estados e códigos:
 *   sucesso        200  confirmou agora; pode logar
 *   ja_verificado  200  link já usado antes; a conta está ativa, é só entrar
 *   token_expirado 410  passou das 24h; oferecer o reenvio
 *   token_invalido 400  token que nunca existiu (link truncado, digitado errado)
 */

const TENTATIVAS_POR_JANELA = 30
const JANELA_MS = 60_000

type Estado = 'sucesso' | 'ja_verificado' | 'token_expirado' | 'token_invalido'

interface ContaCrua {
  id: number | string
  email?: string
  _verified?: boolean | null
  verificacaoExpiraEm?: string | null
}

export const verificarConta: Endpoint = {
  path: '/conta/verificar',
  method: 'post',
  handler: async (req) => {
    const responder = (estado: Estado, status: number, extra: Record<string, unknown> = {}): Response =>
      Response.json(
        { estado, ...extra },
        { status, headers: headersWithCors({ headers: new Headers(), req }) },
      )

    const limite = consumir(`verificar:${ipDoRequest(req)}`, TENTATIVAS_POR_JANELA, JANELA_MS)
    if (!limite.permitido) {
      return Response.json(
        { estado: 'token_invalido', mensagem: 'Muitas tentativas. Aguarde um minuto.' },
        {
          status: 429,
          headers: headersWithCors({
            headers: new Headers({ 'Retry-After': String(limite.esperarSegundos) }),
            req,
          }),
        },
      )
    }

    await addDataAndFileToRequest(req)
    const body = (req.data ?? {}) as { token?: unknown }
    const token = typeof body.token === 'string' ? body.token.trim() : ''

    if (!token) {
      return responder('token_invalido', 400, {
        mensagem: 'Link de confirmação incompleto. Abra o link do e-mail novamente.',
      })
    }

    // `_verificationToken` é campo oculto com acesso de escrita fechado; a
    // consulta vai pelo adapter para não depender de `showHiddenFields`.
    const conta = (await req.payload.db.findOne({
      collection: 'users',
      where: { _verificationToken: { equals: token } },
      req: req as PayloadRequest,
    })) as ContaCrua | null

    // ── Token não encontrado: já usado, ou nunca existiu ─────────────────────
    if (!conta) {
      const usada = (await req.payload.db.findOne({
        collection: 'users',
        where: { verificacaoTokenUsadoHash: { equals: hashDoToken(token) } },
        req: req as PayloadRequest,
      })) as ContaCrua | null

      if (usada?._verified) {
        return responder('ja_verificado', 200, {
          mensagem: 'Este e-mail já foi confirmado. É só entrar na sua conta.',
        })
      }

      return responder('token_invalido', 400, {
        mensagem: 'Link de confirmação inválido. Peça um novo pela loja.',
      })
    }

    // Segurança de rede: token ainda existe mas a conta já consta verificada.
    if (conta._verified) {
      return responder('ja_verificado', 200, {
        mensagem: 'Este e-mail já foi confirmado. É só entrar na sua conta.',
      })
    }

    // ── Prazo ────────────────────────────────────────────────────────────────
    // `verificacaoExpiraEm` nulo = conta criada antes deste controle existir.
    // Tratada como válida de propósito: invalidar em silêncio um link que já
    // está na caixa de entrada de alguém seria trocar um problema por outro.
    const expiraEm = conta.verificacaoExpiraEm ? new Date(conta.verificacaoExpiraEm) : null
    if (expiraEm && expiraEm.getTime() < Date.now()) {
      return responder('token_expirado', 410, {
        mensagem: 'Este link expirou. Peça um novo que enviamos na hora.',
      })
    }

    // Confirma pela operação nativa: é ela que zera `_verificationToken` e
    // grava `_verified` do jeito que o resto do Payload espera encontrar.
    await req.payload.verifyEmail({ collection: 'users', token })

    // Guarda o hash do token consumido para reconhecer o segundo clique.
    await req.payload.db.updateOne({
      collection: 'users',
      id: conta.id,
      data: { verificacaoTokenUsadoHash: hashDoToken(token), verificacaoExpiraEm: null },
      req: req as PayloadRequest,
      returning: false,
    })

    req.payload.logger.info(`[conta] e-mail confirmado (id ${conta.id})`)

    return responder('sucesso', 200, {
      mensagem: 'E-mail confirmado. Sua conta está pronta para comprar.',
    })
  },
}
