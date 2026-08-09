import crypto from 'crypto'
import type { Endpoint, PayloadRequest } from 'payload'
import { headersWithCors } from 'payload'
import { Payment } from 'mercadopago'

import { mercadoPagoClient, paymentMethodFromTipo } from '../utils/mercadopago'

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

    let payment
    try {
      payment = await new Payment(mercadoPagoClient()).get({ id: String(paymentId) })
    } catch (err) {
      req.payload.logger.error(`[mercadopago] Falha ao consultar pagamento ${paymentId}: ${(err as Error).message}`)
      // 200 para o MP não ficar reenviando um pagamento que talvez nem exista mais.
      return resp({ ok: true })
    }

    const orderNumber = payment.external_reference
    if (!orderNumber) return resp({ ok: true })

    const found = await req.payload.find({
      collection: 'orders',
      where: { orderNumber: { equals: orderNumber } },
      limit: 1,
      depth: 0,
      req: req as PayloadRequest,
    })
    const order = found.docs[0]
    if (!order) {
      req.payload.logger.warn(`[mercadopago] Pedido ${orderNumber} não encontrado para pagamento ${paymentId}.`)
      return resp({ ok: true })
    }

    // Idempotente: só age se o pedido ainda estiver aguardando pagamento.
    if (order.status !== 'aguardando_pagamento') return resp({ ok: true })

    if (payment.status === 'approved') {
      await req.payload.update({
        collection: 'orders',
        id: order.id,
        data: {
          status: 'pago',
          paymentStatus: 'paid',
          paymentMethod: paymentMethodFromTipo(payment.payment_type_id),
          idPagamentoMercadoPago: String(payment.id),
        },
        overrideAccess: true,
        req: req as PayloadRequest,
      })
    } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
      // Mantém o pedido em "aguardando_pagamento" para o cliente poder tentar de novo;
      // só registramos o ID do pagamento rejeitado para rastreio.
      await req.payload.update({
        collection: 'orders',
        id: order.id,
        data: { idPagamentoMercadoPago: String(payment.id) },
        overrideAccess: true,
        req: req as PayloadRequest,
      })
    }

    return resp({ ok: true })
  },
}
