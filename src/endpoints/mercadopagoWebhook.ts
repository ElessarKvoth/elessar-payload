import crypto from 'crypto'
import type { Endpoint, PayloadRequest } from 'payload'
import { headersWithCors } from 'payload'

import { confirmarPagamentoMercadoPago } from '../utils/confirmarPagamentoMercadoPago'

// Valida o header `x-signature` enviado pelo Mercado Pago, conforme o algoritmo
// oficial: HMAC-SHA256 de "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
// usando o segredo do webhook (painel do MP → Webhooks → chave secreta).
function assinaturaValida(req: PayloadRequest, paymentId: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) {
    req.payload.logger.warn(
      '[mercadopago] MERCADOPAGO_WEBHOOK_SECRET não configurado — assinatura do webhook não validada.',
    )
    return true
  }

  const signatureHeader = req.headers.get('x-signature') ?? ''
  const requestId = req.headers.get('x-request-id') ?? ''
  const partes = Object.fromEntries(
    signatureHeader
      .split(',')
      .map((p) => p.split('=').map((s) => s.trim()))
      .filter((p) => p.length === 2),
  )
  const ts = partes.ts
  const v1 = partes.v1
  if (!ts || !v1) return false

  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`
  const hash = crypto.createHmac('sha256', secret).update(manifest).digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(v1))
  } catch {
    return false
  }
}

// Notificação assíncrona do Mercado Pago. Endpoint público (o MP não manda
// nosso token) — a autenticidade vem da assinatura, não de login. Nunca confia
// no corpo/query para decidir o status: sempre relê o pagamento na API do MP.
export const mercadopagoWebhook: Endpoint = {
  path: '/mercadopago/webhook',
  method: 'post',
  handler: async (req) => {
    const resp = (body: unknown, status = 200): Response =>
      Response.json(body, { status, headers: headersWithCors({ headers: new Headers(), req }) })

    const query = req.query as Record<string, unknown>
    const type = (query.type as string | undefined) ?? (query.topic as string | undefined)
    const paymentId =
      (query['data.id'] as string | undefined) ??
      ((query.data as { id?: string } | undefined)?.id) ??
      (query.id as string | undefined)

    // Só nos interessam notificações de pagamento; outras (merchant_order etc.)
    // são confirmadas com 200 e ignoradas para o MP parar de reenviar.
    if (type !== 'payment' || !paymentId) return resp({ ok: true })

    if (!assinaturaValida(req, String(paymentId))) {
      req.payload.logger.error('[mercadopago] Webhook com assinatura inválida — ignorado.')
      return resp({ erro: 'Assinatura inválida.' }, 401)
    }

    const resultado = await confirmarPagamentoMercadoPago(req.payload, String(paymentId), req as PayloadRequest)
    if (!resultado.ok) {
      req.payload.logger.error(`[mercadopago] Webhook: ${resultado.erro}`)
    }
    // Sempre 200 pro MP não ficar reenviando (o erro já foi logado).
    return resp({ ok: true })
  },
}
