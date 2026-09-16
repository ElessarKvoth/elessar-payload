import type { Endpoint, PayloadRequest } from 'payload'
import { addDataAndFileToRequest, headersWithCors } from 'payload'

import { consumir, ipDoRequest } from '../utils/rateLimit'
import { avisarAdminDePedidoCancelado } from '../utils/emailsDePedido'

/**
 * POST /api/pedidos/cancelar   { orderNumber }   (autenticado)
 *
 * Cancela um pedido que AINDA NÃO FOI PAGO, a pedido do próprio cliente.
 *
 * POR QUE SÓ "AGUARDANDO PAGAMENTO"
 * ─────────────────────────────────
 * É o único estado em que cancelar não mexe em nada além do próprio pedido: o
 * estoque só é debitado quando o pedido vira `pago`
 * (collections/Orders.ts, hook afterChange), e nenhum dinheiro foi capturado
 * ainda. Cancelar aqui é reversível e não gera obrigação para ninguém.
 *
 * Pedido pago é outra conversa: envolve estorno no Mercado Pago, devolução de
 * estoque e, se já despachado, a logística de volta. Isso não é decisão de
 * botão — o storefront manda o cliente falar com a loja pelo WhatsApp.
 *
 * POR QUE UM ENDPOINT, E NÃO PATCH EM /api/orders
 * ──────────────────────────────────────────────
 * A collection tem `update: isAdmin` e o campo `status` é `somenteServidor`.
 * Cliente não escreve no próprio pedido, de propósito — senão qualquer um
 * mudaria o status para "pago" com uma requisição.
 */

// Cancelar é ação rara e deliberada. O teto existe só para impedir script.
const CANCELAMENTOS_POR_JANELA = 10
const JANELA_MS = 60_000

type Estado =
  | 'sucesso'
  | 'nao_autenticado'
  | 'pedido_nao_encontrado'
  | 'nao_e_seu'
  | 'ja_cancelado'
  | 'precisa_falar_com_a_loja'
  | 'muitas_tentativas'

interface PedidoCru {
  id: number | string
  orderNumber?: string
  status?: string
  customer?: number | string | { id: number | string }
  total?: number
  createdAt?: string
}

export const cancelarPedido: Endpoint = {
  path: '/pedidos/cancelar',
  method: 'post',
  handler: async (req) => {
    const responder = (
      estado: Estado,
      status: number,
      extra: Record<string, unknown> = {},
    ): Response =>
      Response.json(
        { estado, ...extra },
        { status, headers: headersWithCors({ headers: new Headers(), req }) },
      )

    if (!req.user) {
      return responder('nao_autenticado', 401, {
        mensagem: 'Entre na sua conta para cancelar um pedido.',
      })
    }

    const limite = consumir(`cancelar:${ipDoRequest(req)}`, CANCELAMENTOS_POR_JANELA, JANELA_MS)
    if (!limite.permitido) {
      return Response.json(
        { estado: 'muitas_tentativas', mensagem: 'Muitas tentativas seguidas. Aguarde um minuto.' },
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
    const corpo = (req.data ?? {}) as { orderNumber?: unknown }
    const orderNumber = typeof corpo.orderNumber === 'string' ? corpo.orderNumber.trim() : ''

    if (!orderNumber) {
      return responder('pedido_nao_encontrado', 400, {
        mensagem: 'Informe qual pedido você quer cancelar.',
      })
    }

    // `overrideAccess` para achar o pedido seja de quem for; a conferência de
    // dono é feita logo abaixo, à mão. Assim "não é seu" e "não existe" viram
    // a MESMA resposta, e o endpoint não serve para descobrir quais números de
    // pedido existem na loja.
    const encontrados = await req.payload.find({
      collection: 'orders',
      where: { orderNumber: { equals: orderNumber } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req: req as PayloadRequest,
    })

    const pedido = encontrados.docs[0] as unknown as PedidoCru | undefined
    if (!pedido) {
      return responder('pedido_nao_encontrado', 404, {
        mensagem: 'Pedido não encontrado.',
      })
    }

    const donoId =
      typeof pedido.customer === 'object' && pedido.customer !== null
        ? pedido.customer.id
        : pedido.customer

    if (String(donoId) !== String(req.user.id)) {
      req.payload.logger.warn(
        `[pedido] Tentativa de cancelar pedido alheio: usuário ${req.user.id} → ${orderNumber}`,
      )
      // Mesma resposta de "não existe": quem não é dono não descobre nem que o
      // pedido existe.
      return responder('pedido_nao_encontrado', 404, { mensagem: 'Pedido não encontrado.' })
    }

    if (pedido.status === 'cancelado') {
      return responder('ja_cancelado', 200, {
        mensagem: 'Este pedido já estava cancelado.',
      })
    }

    if (pedido.status !== 'aguardando_pagamento') {
      return responder('precisa_falar_com_a_loja', 409, {
        mensagem:
          'Este pedido já foi pago e não pode ser cancelado pelo site. ' +
          'Fale com a loja para pedir o cancelamento e o reembolso.',
        status: pedido.status,
      })
    }

    await req.payload.update({
      collection: 'orders',
      id: pedido.id,
      data: { status: 'cancelado' },
      overrideAccess: true,
      req: req as PayloadRequest,
    })

    req.payload.logger.info(
      `[pedido] ${orderNumber} cancelado pelo próprio cliente (usuário ${req.user.id}).`,
    )

    // Aviso ao gerente. Falhar aqui NÃO desfaz o cancelamento: o pedido já está
    // cancelado e o cliente não pode ficar preso a ele porque um e-mail caiu.
    await avisarAdminDePedidoCancelado({
      payload: req.payload,
      orderNumber,
      total: pedido.total ?? 0,
      emailDoCliente: (req.user as { email?: string }).email ?? '—',
      nomeDoCliente: (req.user as { name?: string | null }).name ?? null,
    }).catch((err) => {
      req.payload.logger.error(
        `[pedido] aviso de cancelamento não enviado (${orderNumber}): ${(err as Error).message}`,
      )
    })

    return responder('sucesso', 200, {
      mensagem: 'Pedido cancelado.',
      // O link de pagamento do Mercado Pago continua existindo do lado deles.
      // Pagá-lo agora seria dinheiro sem pedido — o front precisa avisar.
      avisoLinkDePagamento:
        'Se você já tinha aberto o pagamento no Mercado Pago, NÃO conclua: ' +
        'este pedido não vale mais e o valor não seria processado como compra.',
    })
  },
}
