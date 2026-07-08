import type { Endpoint, PayloadRequest } from 'payload'
import { addDataAndFileToRequest, headersWithCors } from 'payload'

// ENDPOINT TEMPORÁRIO (descartável) — substitui o gateway de pagamento por enquanto.
// Apenas muda o status do pedido para "pago". A criação da etiqueta NÃO acontece aqui:
// ela é disparada pelo hook afterChange do Order ao detectar a mudança para "pago".
// Quando o Mercado Pago for integrado, ele fará exatamente o mesmo (marcar como pago).
export const simularPagamento: Endpoint = {
  path: '/pedidos/simular-pagamento',
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
    const order = found.docs[0]
    if (!order) return resp({ erro: 'Pedido não encontrado.' }, 404)

    // Só o dono do pedido (ou um admin) pode simular o pagamento.
    const isAdmin = (req.user as { role?: string }).role === 'admin'
    const customerId =
      typeof order.customer === 'object' && order.customer !== null ? order.customer.id : order.customer
    if (!isAdmin && customerId !== req.user.id) return resp({ erro: 'Sem permissão.' }, 403)

    // Idempotente: só marca como pago se ainda estiver aguardando pagamento.
    if (order.status !== 'aguardando_pagamento') {
      return resp({
        ok: true,
        status: order.status,
        statusEtiqueta: order.statusEtiqueta ?? null,
        erroEtiqueta: order.erroEtiqueta ?? null,
        jaProcessado: true,
      })
    }

    // Dispara o hook afterChange (baixa de estoque + criação da etiqueta).
    await req.payload.update({
      collection: 'orders',
      id: order.id,
      data: { status: 'pago' },
      overrideAccess: true,
      req: req as PayloadRequest,
    })

    // Relê para devolver o status final (o hook pode ter avançado para "etiqueta_criada").
    const atualizado = await req.payload.findByID({
      collection: 'orders',
      id: order.id,
      depth: 0,
      req: req as PayloadRequest,
    })
    return resp({
      ok: true,
      status: atualizado.status,
      statusEtiqueta: atualizado.statusEtiqueta ?? null,
      erroEtiqueta: atualizado.erroEtiqueta ?? null,
    })
  },
}
