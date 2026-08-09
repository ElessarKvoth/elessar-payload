import type { Endpoint, PayloadRequest } from 'payload'
import { addDataAndFileToRequest, headersWithCors } from 'payload'
import { Preference } from 'mercadopago'

import { mercadoPagoClient, frontendBaseUrl } from '../utils/mercadopago'
import type { Order } from '../payload-types'

// Cria a Preference do Checkout Pro para um pedido já existente e devolve a
// URL de redirecionamento (init_point). Não move dinheiro nem toca no status
// do pedido — quem confirma o pagamento é o webhook, nunca este endpoint.
export const criarPagamentoMercadoPago: Endpoint = {
  path: '/pedidos/criar-pagamento',
  method: 'post',
  handler: async (req) => {
    const resp = (body: unknown, status = 200): Response =>
      Response.json(body, { status, headers: headersWithCors({ headers: new Headers(), req }) })

    if (!req.user) return resp({ erro: 'Não autenticado.' }, 401)

    await addDataAndFileToRequest(req)
    const body = (req.data ?? {}) as { orderNumber?: unknown }
    const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber : ''
    if (!orderNumber) return resp({ erro: 'orderNumber é obrigatório.' }, 400)

    const found = await req.payload.find({
      collection: 'orders',
      where: { orderNumber: { equals: orderNumber } },
      limit: 1,
      depth: 0,
      req: req as PayloadRequest,
    })
    const order = found.docs[0] as Order | undefined
    if (!order) return resp({ erro: 'Pedido não encontrado.' }, 404)

    const isAdmin = (req.user as { role?: string }).role === 'admin'
    const customerId =
      typeof order.customer === 'object' && order.customer !== null ? order.customer.id : order.customer
    if (!isAdmin && customerId !== req.user.id) return resp({ erro: 'Sem permissão.' }, 403)

    if (order.status !== 'aguardando_pagamento') {
      return resp({ erro: 'Este pedido não está mais aguardando pagamento.' }, 409)
    }

    const dest = order.destinatario
    const shipping = order.shipping ?? 0
    const itensPreference = order.items.map((item, idx) => ({
      id: `item-${idx}`,
      title: item.productTitle,
      quantity: item.quantity,
      unit_price: Number((item.unitPrice / 100).toFixed(2)),
      currency_id: 'BRL',
    }))
    if (shipping > 0) {
      itensPreference.push({
        id: 'frete',
        title: 'Frete',
        quantity: 1,
        unit_price: Number((shipping / 100).toFixed(2)),
        currency_id: 'BRL',
      })
    }

    const frontend = frontendBaseUrl()
    const returnUrl = `${frontend}/pedido-confirmado/${order.orderNumber}`

    try {
      const preference = await new Preference(mercadoPagoClient()).create({
        body: {
          items: itensPreference,
          external_reference: order.orderNumber,
          payer: {
            name: dest?.nome ?? undefined,
            email: dest?.email ?? undefined,
            identification: dest?.cpf ? { type: 'CPF', number: dest.cpf.replace(/\D/g, '') } : undefined,
          },
          back_urls: { success: returnUrl, failure: returnUrl, pending: returnUrl },
          auto_return: 'approved',
          notification_url: `${(process.env.NEXT_PUBLIC_SERVER_URL ?? '').replace(/\/$/, '')}/api/mercadopago/webhook`,
          statement_descriptor: 'ELESSAR RECORDS',
        },
      })

      const initPoint =
        process.env.MERCADOPAGO_ENV === 'production' ? preference.init_point : preference.sandbox_init_point
      if (!initPoint) return resp({ erro: 'Mercado Pago não retornou o link de pagamento.' }, 502)

      return resp({ initPoint })
    } catch (err) {
      req.payload.logger.error(`[mercadopago] Falha ao criar preferência: ${(err as Error).message}`)
      return resp({ erro: 'Não foi possível iniciar o pagamento. Tente novamente.' }, 502)
    }
  },
}
