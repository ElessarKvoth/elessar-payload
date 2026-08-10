import type { Payload, PayloadRequest } from 'payload'
import { Payment } from 'mercadopago'

import { mercadoPagoClient, paymentMethodFromTipo } from './mercadopago'

export interface ResultadoConfirmacao {
  ok: boolean
  erro?: string
  orderId?: string | number
  customerId?: string | number | null
  status?: string
  statusEtiqueta?: string | null
  erroEtiqueta?: string | null
}

// Lógica única de confirmação de pagamento, usada tanto pelo webhook (assíncrono,
// disparado pelo MP) quanto pelo endpoint de retorno (síncrono, disparado quando o
// cliente volta do checkout). Nunca confia em status vindo de fora — sempre relê o
// pagamento na API do Mercado Pago pelo ID antes de decidir algo.
export async function confirmarPagamentoMercadoPago(
  payload: Payload,
  paymentId: string,
  req: PayloadRequest,
): Promise<ResultadoConfirmacao> {
  let payment
  try {
    payment = await new Payment(mercadoPagoClient()).get({ id: paymentId })
  } catch (err) {
    return { ok: false, erro: `Falha ao consultar pagamento: ${(err as Error).message}` }
  }

  const orderNumber = payment.external_reference
  if (!orderNumber) return { ok: false, erro: 'Pagamento sem referência de pedido.' }

  const found = await payload.find({
    collection: 'orders',
    where: { orderNumber: { equals: orderNumber } },
    limit: 1,
    depth: 0,
    req,
  })
  const order = found.docs[0]
  if (!order) return { ok: false, erro: 'Pedido não encontrado.' }

  const customerId =
    typeof order.customer === 'object' && order.customer !== null ? order.customer.id : order.customer

  // Já processado (idempotente): devolve o estado atual sem reagir de novo.
  if (order.status !== 'aguardando_pagamento') {
    return {
      ok: true,
      orderId: order.id,
      customerId,
      status: order.status,
      statusEtiqueta: order.statusEtiqueta ?? null,
      erroEtiqueta: order.erroEtiqueta ?? null,
    }
  }

  if (payment.status === 'approved') {
    const atualizado = await payload.update({
      collection: 'orders',
      id: order.id,
      data: {
        status: 'pago',
        paymentStatus: 'paid',
        paymentMethod: paymentMethodFromTipo(payment.payment_type_id),
        idPagamentoMercadoPago: String(payment.id),
      },
      overrideAccess: true,
      req,
    })
    return {
      ok: true,
      orderId: order.id,
      customerId,
      status: atualizado.status,
      statusEtiqueta: atualizado.statusEtiqueta ?? null,
      erroEtiqueta: atualizado.erroEtiqueta ?? null,
    }
  }

  if (payment.status === 'rejected' || payment.status === 'cancelled') {
    // Mantém o pedido em "aguardando_pagamento" para o cliente poder tentar de novo;
    // só registra o ID do pagamento rejeitado para rastreio.
    await payload.update({
      collection: 'orders',
      id: order.id,
      data: { idPagamentoMercadoPago: String(payment.id) },
      overrideAccess: true,
      req,
    })
  }

  return {
    ok: true,
    orderId: order.id,
    customerId,
    status: order.status,
    statusEtiqueta: order.statusEtiqueta ?? null,
    erroEtiqueta: order.erroEtiqueta ?? null,
  }
}
