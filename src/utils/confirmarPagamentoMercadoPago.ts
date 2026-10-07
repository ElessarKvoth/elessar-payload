import { sql } from 'drizzle-orm'
import type { Payload, PayloadRequest } from 'payload'
import { commitTransaction, initTransaction, killTransaction } from 'payload'
import { Payment } from 'mercadopago'

import type { Order } from '../payload-types'
import { mercadoPagoClient, paymentMethodFromTipo } from './mercadopago'
import { alertarPagamentoNaoConfirmado, alertarPagamentoSemPedidoAberto } from './emailsDePedido'
import { dataHoraBr } from './emailTemplate'
import { executorDaTransacao, ItemIndisponivelError } from './reservarEstoque'

export interface ResultadoConfirmacao {
  ok: boolean
  erro?: string
  orderId?: string | number
  customerId?: string | number | null
  status?: string
  /** `paid` com status ainda em aguardando = pagamento retido (item esgotou). */
  paymentStatus?: string | null
  statusEtiqueta?: string | null
  erroEtiqueta?: string | null
}

type CustomerId = string | number | null | undefined

function idDoCliente(order: Order): CustomerId {
  return typeof order.customer === 'object' && order.customer !== null ? order.customer.id : order.customer
}

function estadoDoPedido(order: Order): ResultadoConfirmacao {
  return {
    ok: true,
    orderId: order.id,
    customerId: idDoCliente(order),
    status: order.status,
    paymentStatus: order.paymentStatus ?? null,
    statusEtiqueta: order.statusEtiqueta ?? null,
    erroEtiqueta: order.erroEtiqueta ?? null,
  }
}

/** Acrescenta uma linha datada às observações internas, sem apagar o que havia. */
function anotar(antes: string | null | undefined, linha: string): string {
  return [antes?.trim(), `[${dataHoraBr()}] ${linha}`].filter(Boolean).join('\n')
}

/**
 * Roda `fn` com a LINHA DO PEDIDO travada até o fim da transação.
 *
 * O pagamento é confirmado por dois caminhos que chegam quase juntos: o
 * retorno do cliente ao site e o webhook do Mercado Pago (que costuma vir mais
 * de uma vez — `payment.created` e `payment.updated`). Sem trava, os dois liam
 * "aguardando pagamento" ao mesmo tempo e AMBOS promoviam o pedido: o estoque
 * era baixado duas vezes e duas etiquetas iam para o carrinho da SuperFrete.
 * Com estoque de sobra (o acervo tem disco com 120 unidades), nada impedia.
 *
 * Com `FOR UPDATE`, a segunda chamada espera a primeira terminar e, ao reler,
 * já encontra o pedido pago — e sai pelo caminho idempotente.
 */
async function comPedidoTravado<T>(
  payload: Payload,
  req: PayloadRequest,
  orderId: number | string,
  fn: (atual: Order) => Promise<T>,
): Promise<T> {
  const iniciou = await initTransaction(req)
  try {
    await executorDaTransacao(payload, req).execute(
      sql`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`,
    )
    // Relido DEPOIS da trava: em READ COMMITTED cada comando enxerga o que já
    // foi confirmado, então aqui aparece o resultado de quem segurava a linha.
    const atual = (await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 0,
      overrideAccess: true,
      req,
    })) as Order
    const resultado = await fn(atual)
    if (iniciou) await commitTransaction(req)
    return resultado
  } catch (err) {
    if (iniciou) await killTransaction(req)
    throw err
  }
}

type Desfecho = { resultado: ResultadoConfirmacao; alerta?: () => Promise<void> }

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
    overrideAccess: true,
    req,
  })
  const pedido = found.docs[0] as Order | undefined
  if (!pedido) return { ok: false, erro: 'Pedido não encontrado.' }

  const idPagamento = String(payment.id)

  // ── Pagamento NÃO aprovado (pendente, recusado, cancelado) ─────────────────
  // Não mexe no status. Só anota o ID de uma recusa, para rastreio — e só em
  // pedido ainda aberto: antes, uma tentativa recusada que chegasse depois de
  // outra aprovada sobrescrevia o ID do pagamento que de fato quitou o pedido.
  if (payment.status !== 'approved') {
    const recusado = payment.status === 'rejected' || payment.status === 'cancelled'
    if (recusado && pedido.status === 'aguardando_pagamento' && pedido.paymentStatus !== 'paid') {
      await payload.update({
        collection: 'orders',
        id: pedido.id,
        data: { idPagamentoMercadoPago: idPagamento },
        overrideAccess: true,
        req,
      })
    }
    return estadoDoPedido(pedido)
  }

  // ── Pagamento APROVADO: decide com o pedido travado ────────────────────────
  let desfecho: Desfecho
  try {
    desfecho = await comPedidoTravado(payload, req, pedido.id, async (atual): Promise<Desfecho> => {
      const quitadoPorEste = atual.paymentStatus === 'paid' && atual.idPagamentoMercadoPago === idPagamento

      // Já tratado antes — por esta mesma notificação repetida, ou pela outra
      // via (retorno × webhook). Caminho normal de toda venda.
      if (quitadoPorEste) return { resultado: estadoDoPedido(atual) }

      // Dinheiro entrando em pedido que não está mais aberto: cancelado, ou já
      // quitado por OUTRO pagamento (cliente pagou duas vezes). O alarme só
      // existe para isto. Antes ele também disparava na segunda confirmação
      // do MESMO pagamento — ou seja, em praticamente toda venda — e alarme que
      // toca sempre ensina o gerente a ignorá-lo.
      const pedidoFechado = atual.status !== 'aguardando_pagamento' || atual.paymentStatus === 'paid'
      if (pedidoFechado) {
        payload.logger.error(
          `[pagamento] ALARME: pagamento ${idPagamento} APROVADO para o pedido ${orderNumber}, ` +
            `que está com status "${atual.status}". O pedido NÃO foi promovido e o estoque NÃO ` +
            'foi baixado — mas o valor provavelmente foi capturado. Conferir no Mercado Pago.',
        )
        return {
          resultado: estadoDoPedido(atual),
          alerta: () =>
            alertarPagamentoSemPedidoAberto({
              payload,
              orderNumber,
              statusDoPedido: atual.status,
              idPagamento,
              valorPago: payment.transaction_amount ?? null,
            }),
        }
      }

      // ── SEGURANÇA: confere o que foi de fato pago ──────────────────────────
      // "approved" só diz que o Mercado Pago aprovou ALGUM valor — não diz que
      // foi o valor deste pedido, nem na moeda certa. Divergência nunca vira
      // "pago": fica em aguardando_pagamento para conferência humana.
      const pagoEmCentavos = Math.round((payment.transaction_amount ?? 0) * 100)
      const esperadoEmCentavos = atual.total ?? 0
      const moeda = payment.currency_id ?? ''

      if (moeda !== 'BRL' || pagoEmCentavos < esperadoEmCentavos) {
        const detalhe =
          `esperado ${esperadoEmCentavos} centavos (BRL), ` +
          `recebido ${pagoEmCentavos} centavos (${moeda || 'moeda ausente'})`
        payload.logger.error(
          `[mercadopago] DIVERGÊNCIA DE PAGAMENTO no pedido ${orderNumber}: ${detalhe}. ` +
            `Pagamento ${idPagamento} NÃO foi aceito — pedido mantido em aguardando_pagamento.`,
        )
        const jaAvisado = atual.idPagamentoMercadoPago === idPagamento
        await payload.update({
          collection: 'orders',
          id: atual.id,
          data: {
            idPagamentoMercadoPago: idPagamento,
            ...(jaAvisado ? {} : { notes: anotar(atual.notes, `Pagamento ${idPagamento} com valor divergente: ${detalhe}.`) }),
          },
          overrideAccess: true,
          req,
        })
        return {
          resultado: { ok: false, erro: 'O valor pago não confere com o do pedido. Entre em contato com a loja.' },
          alerta: jaAvisado
            ? undefined
            : () =>
                alertarPagamentoNaoConfirmado({
                  payload,
                  orderNumber,
                  motivo: 'valor',
                  detalhe,
                  idPagamento,
                  valorPago: payment.transaction_amount ?? null,
                }),
        }
      }

      // Promove. Os hooks de `Orders` baixam o estoque e criam a etiqueta —
      // tudo dentro desta transação, ainda com o pedido travado.
      await payload.update({
        collection: 'orders',
        id: atual.id,
        data: {
          status: 'pago',
          paymentStatus: 'paid',
          paymentMethod: paymentMethodFromTipo(payment.payment_type_id),
          idPagamentoMercadoPago: idPagamento,
        },
        overrideAccess: true,
        req,
      })
      // Relido porque a etiqueta é gravada por um update ANINHADO no hook
      // (status → etiqueta_criada, ou statusEtiqueta → erro), que o retorno do
      // update acima não reflete.
      const final = (await payload.findByID({
        collection: 'orders',
        id: atual.id,
        depth: 0,
        overrideAccess: true,
        req,
      })) as Order
      return { resultado: estadoDoPedido(final) }
    })
  } catch (err) {
    // Falha passageira (banco, rede): deixa estourar. O webhook responde 500
    // e o Mercado Pago reenvia mais tarde — é o comportamento certo.
    if (!(err instanceof ItemIndisponivelError)) throw err

    // ── Item esgotou entre o pedido e o pagamento ──────────────────────────
    // O estoque só é baixado na confirmação, então dois clientes podem fechar
    // pedido do mesmo último disco; o segundo a pagar cai aqui. A promoção foi
    // desfeita (rollback). Antes o erro estourava em silêncio: o pedido voltava
    // para "aguardando", o cliente via o botão de pagar DE NOVO, e o webhook
    // falhava em todo reenvio sem ninguém ser avisado.
    //
    // Agora o pedido fica RETIDO: pagamento registrado (`paymentStatus: paid`)
    // com o status ainda em aguardando. O site para de oferecer "pagar" e o
    // gerente recebe e-mail para repor o item ou estornar.
    const motivo = err.message
    desfecho = await comPedidoTravado(payload, req, pedido.id, async (atual): Promise<Desfecho> => {
      // A outra via chegou primeiro e já reteve (ou resolveu): nada a repetir.
      if (atual.status !== 'aguardando_pagamento' || atual.paymentStatus === 'paid') {
        return { resultado: estadoDoPedido(atual) }
      }
      payload.logger.error(
        `[pagamento] Pedido ${orderNumber} PAGO (pagamento ${idPagamento}) mas não confirmado: ${motivo}`,
      )
      const retido = await payload.update({
        collection: 'orders',
        id: atual.id,
        data: {
          paymentStatus: 'paid',
          paymentMethod: paymentMethodFromTipo(payment.payment_type_id),
          idPagamentoMercadoPago: idPagamento,
          notes: anotar(
            atual.notes,
            `Pagamento ${idPagamento} aprovado, mas o pedido não pôde ser confirmado: ${motivo} ` +
              'Reponha o estoque e mude a situação para "Pago", ou estorne no Mercado Pago e marque "Reembolsado".',
          ),
        },
        overrideAccess: true,
        req,
        context: { skipStockDecrement: true, skipEtiqueta: true },
      })
      return {
        resultado: estadoDoPedido(retido),
        alerta: () =>
          alertarPagamentoNaoConfirmado({
            payload,
            orderNumber,
            motivo: 'estoque',
            detalhe: motivo,
            idPagamento,
            valorPago: payment.transaction_amount ?? null,
          }),
      }
    })
  }

  // E-mail só depois de a transação fechar: não segura a trava do pedido
  // enquanto fala com o provedor, e falhar no envio não desfaz nada.
  if (desfecho.alerta) {
    await desfecho.alerta().catch((err) => {
      payload.logger.error(`[pagamento] falha ao enviar alerta do pedido ${orderNumber}: ${(err as Error).message}`)
    })
  }
  return desfecho.resultado
}
