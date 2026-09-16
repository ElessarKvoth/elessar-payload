import type { Payload, PayloadRequest } from 'payload'
import { Payment } from 'mercadopago'

import { mercadoPagoClient, paymentMethodFromTipo } from './mercadopago'
import { alertarPagamentoSemPedidoAberto } from './emailsDePedido'

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
    // ── Exceção: dinheiro entrando em pedido que não está mais aberto ───────
    //
    // Recusar a promoção está certo — pedido cancelado não tem mais reserva de
    // estoque nem compromisso de entrega. Mas ficar em silêncio, não: o cliente
    // pode ter cancelado pelo site e depois concluído um checkout que já estava
    // aberto (o link do Mercado Pago continua válido do lado dele). O pedido não
    // avança e o DINHEIRO ENTRA, sem nada no painel indicando isso.
    //
    // Quem descobria era o cliente, reclamando de uma cobrança que a loja não
    // sabia explicar. Agora o gerente é avisado na hora.
    if (payment.status === 'approved') {
      payload.logger.error(
        `[pagamento] ALARME: pagamento ${payment.id} APROVADO para o pedido ${orderNumber}, ` +
          `que está com status "${order.status}". O pedido NÃO foi promovido e o estoque NÃO ` +
          'foi baixado — mas o valor provavelmente foi capturado. Conferir no Mercado Pago.',
      )

      await alertarPagamentoSemPedidoAberto({
        payload,
        orderNumber,
        statusDoPedido: order.status,
        idPagamento: String(payment.id),
        valorPago: payment.transaction_amount ?? null,
      }).catch((err) => {
        payload.logger.error(
          `[pagamento] falha ao alertar sobre pagamento órfão: ${(err as Error).message}`,
        )
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

  if (payment.status === 'approved') {
    // ── SEGURANÇA: confere o que foi de fato pago ──────────────────────────
    // "approved" só diz que o Mercado Pago aprovou ALGUM valor — não diz que
    // foi o valor deste pedido, nem na moeda certa. Sem esta checagem, a única
    // coisa separando "o MP aprovou" de "pagaram o que deviam" é a confiança
    // de que a preferência foi montada certo. Divergência nunca vira "pago":
    // fica em aguardando_pagamento para conferência humana.
    const pagoEmCentavos = Math.round((payment.transaction_amount ?? 0) * 100)
    const esperadoEmCentavos = order.total ?? 0
    const moeda = payment.currency_id ?? ''

    if (moeda !== 'BRL' || pagoEmCentavos < esperadoEmCentavos) {
      payload.logger.error(
        `[mercadopago] DIVERGÊNCIA DE PAGAMENTO no pedido ${orderNumber}: ` +
          `esperado ${esperadoEmCentavos} centavos (BRL), ` +
          `recebido ${pagoEmCentavos} centavos (${moeda || 'moeda ausente'}). ` +
          `Pagamento ${payment.id} NÃO foi aceito — pedido mantido em aguardando_pagamento.`,
      )
      // Registra o ID para rastreio, sem mudar o status.
      await payload.update({
        collection: 'orders',
        id: order.id,
        data: { idPagamentoMercadoPago: String(payment.id) },
        overrideAccess: true,
        req,
      })
      return { ok: false, erro: 'O valor pago não confere com o do pedido. Entre em contato com a loja.' }
    }

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
