import type { CollectionAfterChangeHook } from 'payload'

import type { Order } from '../payload-types'
import { depoisDaResposta } from '../utils/depoisDaResposta'
import { enviarAvisoDePedido } from '../utils/emailsDePedido'
import { enviarEmailDoCliente, type EtapaDoPedido } from '../utils/emailsDoCliente'
import { carregarPedidoParaEmail, type PedidoParaEmail } from '../utils/pedidoParaEmail'

/* ────────────────────────────────────────────────────────────────────────────
   Quem recebe e-mail a cada mudança do pedido.

   Olha só a DIFERENÇA entre antes e depois (status e pagamento), e não as
   flags de `context` — no Payload o `context` de uma chamada fica grudado no
   `req` e vaza para as seguintes, então não serve para decidir nada aqui.

   Nada é enviado de dentro da transação: tudo é agendado para depois da
   resposta (ver depoisDaResposta) e, na hora de enviar, o pedido é RELIDO. Se
   a gravação foi desfeita, o estado relido não confirma a mudança e o e-mail
   não sai. É também o que garante que o e-mail de venda já mostre o resultado
   da etiqueta, gravado por um update interno depois desta mudança.
   ──────────────────────────────────────────────────────────────────────────── */

const SITUACOES_PAGAS: Order['status'][] = ['pago', 'etiqueta_criada', 'enviado', 'entregue']

interface Evento {
  etapa: EtapaDoPedido
  /** Confere, no pedido relido, que a mudança foi mesmo gravada. */
  aindaVale: (p: PedidoParaEmail) => boolean
  /** Também avisa o gerente. */
  avisoAoGerente?: 'venda-paga' | 'aguardando-pagamento' | 'cancelado-pelo-cliente'
  estavaPago?: boolean
}

function eventosDaMudanca(antes: Order | null, depois: Order, feitoPorAdmin: boolean): Evento[] {
  // Pedido novo.
  if (!antes) {
    if (depois.status !== 'aguardando_pagamento') return []
    return [
      {
        etapa: 'recebido',
        aindaVale: () => true,
        // Pedido de balcão lançado pelo próprio gerente não precisa avisá-lo.
        avisoAoGerente: feitoPorAdmin ? undefined : 'aguardando-pagamento',
      },
    ]
  }

  const mudou = antes.status !== depois.status
  const eventos: Evento[] = []

  // Só a partir de "aguardando": a etiqueta criada logo depois (pago →
  // etiqueta_criada) não é uma segunda venda.
  if (mudou && antes.status === 'aguardando_pagamento' && depois.status === 'pago') {
    eventos.push({
      etapa: 'pago',
      aindaVale: (p) => SITUACOES_PAGAS.includes(p.status),
      avisoAoGerente: 'venda-paga',
    })
  }

  if (mudou && depois.status === 'enviado') {
    eventos.push({ etapa: 'enviado', aindaVale: (p) => p.status === 'enviado' })
  }

  if (mudou && depois.status === 'entregue') {
    eventos.push({ etapa: 'entregue', aindaVale: (p) => p.status === 'entregue' })
  }

  if (mudou && depois.status === 'cancelado') {
    eventos.push({
      etapa: 'cancelado',
      aindaVale: (p) => p.status === 'cancelado',
      estavaPago: antes.paymentStatus === 'paid',
      // Quem cancelou pelo painel foi o próprio gerente.
      avisoAoGerente: feitoPorAdmin ? undefined : 'cancelado-pelo-cliente',
    })
  }

  if (mudou && depois.status === 'reembolsado') {
    eventos.push({ etapa: 'reembolsado', aindaVale: (p) => p.status === 'reembolsado' })
  }

  // Retido: pagou, mas um item esgotou antes da confirmação. O gerente já
  // recebe o alarme em confirmarPagamentoMercadoPago.
  if (
    antes.paymentStatus !== 'paid' &&
    depois.paymentStatus === 'paid' &&
    depois.status === 'aguardando_pagamento'
  ) {
    eventos.push({
      etapa: 'retido',
      aindaVale: (p) => p.paymentStatus === 'paid' && p.status === 'aguardando_pagamento',
    })
  }

  return eventos
}

export const avisarPorEmailDoPedido: CollectionAfterChangeHook = ({ doc, previousDoc, operation, req }) => {
  const depois = doc as Order
  const antes = operation === 'create' ? null : (previousDoc as Order | undefined) ?? null
  const feitoPorAdmin = (req.user as { role?: string } | null)?.role === 'admin'

  const eventos = eventosDaMudanca(antes, depois, feitoPorAdmin)
  if (eventos.length === 0) return doc

  const payload = req.payload
  depoisDaResposta(payload, `pedido ${depois.orderNumber}`, async () => {
    const p = await carregarPedidoParaEmail(payload, depois.id)
    if (!p) return

    for (const ev of eventos) {
      if (!ev.aindaVale(p)) {
        payload.logger.warn(`[email] pedido ${p.numero}: etapa "${ev.etapa}" não confirmada no banco — e-mail não enviado.`)
        continue
      }
      await enviarEmailDoCliente(payload, ev.etapa, p, { estavaPago: ev.estavaPago })
      if (ev.avisoAoGerente) await enviarAvisoDePedido(payload, ev.avisoAoGerente, p)
    }
  })

  return doc
}
