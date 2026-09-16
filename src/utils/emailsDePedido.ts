import type { Payload } from 'payload'

import { listaAdminEmails } from './adminEmails'
import { dadosDaEmpresa, dataHoraBr, emailBase, storefrontUrl } from './emailTemplate'
import { enviarEmailTransacional } from './enviarEmail'

/* ────────────────────────────────────────────────────────────────────────────
   Avisos sobre pedidos, endereçados a QUEM CUIDA DA LOJA.

   Diferente dos e-mails de `emailsDeSeguranca.ts`, que falam com o cliente,
   estes existem para o gerente não precisar ficar olhando o painel para saber
   que algo aconteceu. Um pedido cancelado sem aviso é uma venda que some da
   previsão sem ninguém notar.
   ──────────────────────────────────────────────────────────────────────────── */

const reais = (centavos: number): string =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Manda o mesmo aviso para cada e-mail em ADMIN_EMAILS, um envio por pessoa. */
async function avisarAdministradores(args: {
  payload: Payload
  tipo: string
  assunto: string
  html: string
}): Promise<void> {
  const destinatarios = listaAdminEmails()

  if (destinatarios.length === 0) {
    // Mesma armadilha que a de Users: lista vazia é erro de configuração, não
    // ordem de não avisar ninguém. Melhor gritar no log do que silenciar.
    args.payload.logger.error(
      `[pedido] ADMIN_EMAILS está vazia — o aviso "${args.tipo}" não foi para ninguém. ` +
        'Defina a variável no .env do servidor e nas variáveis da Vercel.',
    )
    return
  }

  for (const para of destinatarios) {
    await enviarEmailTransacional({
      payload: args.payload,
      tipo: args.tipo,
      para,
      assunto: args.assunto,
      html: args.html,
    })
  }
}

// ── Cliente cancelou um pedido não pago ──────────────────────────────────────

export async function avisarAdminDePedidoCancelado(args: {
  payload: Payload
  orderNumber: string
  total: number
  emailDoCliente: string
  nomeDoCliente?: string | null
}): Promise<void> {
  const { payload, orderNumber, total, emailDoCliente, nomeDoCliente } = args
  const empresa = await dadosDaEmpresa(payload)

  const html = emailBase({
    empresa,
    titulo: 'Pedido cancelado pelo cliente',
    corpo: [
      `O pedido <strong>${orderNumber}</strong> foi cancelado pelo próprio cliente, ` +
        'pela página "Meus Pedidos".',
      'O pagamento ainda não tinha sido feito, então <strong>nada foi cobrado e ' +
        'nenhum item saiu do estoque</strong> — não há estorno a fazer nem produto a repor.',
    ],
    detalhes: [
      { rotulo: 'Pedido', valor: orderNumber },
      { rotulo: 'Valor', valor: reais(total) },
      { rotulo: 'Cliente', valor: nomeDoCliente ? `${nomeDoCliente} (${emailDoCliente})` : emailDoCliente },
      { rotulo: 'Quando', valor: dataHoraBr() },
    ],
    botaoTexto: 'Ver no painel',
    botaoUrl: `${storefrontUrl()}/admin/collections/orders`,
    rodape:
      'Este aviso existe para você não descobrir o cancelamento só ao conferir o painel. ' +
      'Nenhuma ação é necessária.',
  })

  await avisarAdministradores({
    payload,
    tipo: 'pedido-cancelado-pelo-cliente',
    assunto: `Pedido ${orderNumber} cancelado pelo cliente — Elessar Records`,
    html,
  })
}

// ── Chegou dinheiro para um pedido que não está mais aberto ──────────────────

/**
 * ALARME. Um pagamento foi aprovado no Mercado Pago para um pedido que não
 * está mais em "aguardando pagamento" — cancelado, em geral.
 *
 * Acontece quando o cliente cancela pelo site e depois conclui um checkout que
 * já tinha aberto: o link do Mercado Pago continua válido do lado deles. O
 * sistema recusa promover o pedido (e faz certo — não há mais reserva de
 * estoque nem compromisso de entrega), mas o dinheiro ENTROU.
 *
 * Sem este aviso, isso passa em silêncio: sobra um pagamento na conta do
 * Mercado Pago sem pedido correspondente, e quem descobre é o cliente,
 * reclamando de uma cobrança que a loja não sabe explicar.
 */
export async function alertarPagamentoSemPedidoAberto(args: {
  payload: Payload
  orderNumber: string
  statusDoPedido: string
  idPagamento: string
  valorPago?: number | null
}): Promise<void> {
  const { payload, orderNumber, statusDoPedido, idPagamento, valorPago } = args
  const empresa = await dadosDaEmpresa(payload)

  const html = emailBase({
    empresa,
    titulo: '⚠️ Pagamento recebido para pedido que não está aberto',
    corpo: [
      `Entrou um pagamento aprovado no Mercado Pago referente ao pedido ` +
        `<strong>${orderNumber}</strong>, mas esse pedido está com a situação ` +
        `<strong>${statusDoPedido}</strong>.`,
      'O pedido <strong>não</strong> foi marcado como pago e <strong>nenhum item foi ' +
        'baixado do estoque</strong> — isso é proposital, porque um pedido cancelado não ' +
        'tem mais reserva nem compromisso de entrega.',
      '<strong>Mas o dinheiro provavelmente está na conta.</strong> Confira no Mercado Pago ' +
        'e devolva ao cliente, ou combine com ele refazer o pedido.',
    ],
    detalhes: [
      { rotulo: 'Pedido', valor: orderNumber },
      { rotulo: 'Situação do pedido', valor: statusDoPedido },
      { rotulo: 'ID do pagamento', valor: idPagamento },
      ...(typeof valorPago === 'number' ? [{ rotulo: 'Valor pago', valor: reais(valorPago * 100) }] : []),
      { rotulo: 'Quando', valor: dataHoraBr() },
    ],
    rodape:
      'Este é o único aviso deste evento — ele não aparece no painel como pendência. ' +
      'Guarde este e-mail até resolver.',
  })

  await avisarAdministradores({
    payload,
    tipo: 'pagamento-sem-pedido-aberto',
    assunto: `⚠️ Pagamento sem pedido aberto (${orderNumber}) — Elessar Records`,
    html,
  })
}
