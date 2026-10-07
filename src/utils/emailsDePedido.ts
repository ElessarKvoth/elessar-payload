import type { Payload } from 'payload'

import { listaAdminEmails } from './adminEmails'
import { dadosDaEmpresa, dataHoraBr, emailBase, painelUrl } from './emailTemplate'
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
    botaoUrl: `${painelUrl()}/collections/orders`,
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

// ── Pagamento aprovado que o sistema não conseguiu confirmar ─────────────────

/**
 * ALARME. O Mercado Pago aprovou o pagamento, o pedido estava aberto, e mesmo
 * assim ele não pôde virar "pago". Dois motivos possíveis:
 *
 *  • `estoque` — um item esgotou entre o cliente fechar o pedido e pagar (o
 *    estoque só é baixado na confirmação). Vender o que não existe não é
 *    opção, então o pedido fica retido com o pagamento registrado.
 *  • `valor` — o valor aprovado é menor que o total do pedido, ou veio em
 *    outra moeda.
 *
 * Antes isto só ia para o log da Vercel, que ninguém lê: o cliente pagava, o
 * pedido ficava parado e o gerente só sabia quando o cliente reclamava.
 */
export async function alertarPagamentoNaoConfirmado(args: {
  payload: Payload
  orderNumber: string
  motivo: 'estoque' | 'valor'
  detalhe: string
  idPagamento: string
  valorPago?: number | null
}): Promise<void> {
  const { payload, orderNumber, motivo, detalhe, idPagamento, valorPago } = args
  const empresa = await dadosDaEmpresa(payload)

  const corpo =
    motivo === 'estoque'
      ? [
          `O cliente pagou o pedido <strong>${orderNumber}</strong>, mas um dos itens ` +
            '<strong>não tinha mais estoque</strong> na hora da confirmação.',
          'O pedido <strong>não</strong> virou "pago", nenhum item foi baixado e nenhuma ' +
            'etiqueta foi criada. O pagamento ficou registrado no pedido, e o cliente vê ' +
            'que a loja vai entrar em contato — o botão de pagar some para ele não pagar de novo.',
          '<strong>O que fazer:</strong> se conseguir repor o item, ajuste o estoque e mude a ' +
            'situação do pedido para "Pago" no painel (o estoque é baixado e a etiqueta é criada ' +
            'na hora). Se não, devolva o valor no Mercado Pago e mude a situação para "Reembolsado".',
        ]
      : [
          `Entrou um pagamento aprovado para o pedido <strong>${orderNumber}</strong>, mas ` +
            '<strong>o valor não confere</strong> com o total do pedido.',
          'O pedido continua em "Aguardando pagamento" e nada foi baixado do estoque. ' +
            'Confira no Mercado Pago e fale com o cliente.',
        ]

  const html = emailBase({
    empresa,
    titulo:
      motivo === 'estoque'
        ? '⚠️ Pedido pago com item sem estoque'
        : '⚠️ Pagamento com valor diferente do pedido',
    corpo,
    detalhes: [
      { rotulo: 'Pedido', valor: orderNumber },
      { rotulo: 'Motivo', valor: detalhe },
      { rotulo: 'ID do pagamento', valor: idPagamento },
      ...(typeof valorPago === 'number' ? [{ rotulo: 'Valor pago', valor: reais(valorPago * 100) }] : []),
      { rotulo: 'Quando', valor: dataHoraBr() },
    ],
    botaoTexto: 'Ver no painel',
    botaoUrl: `${painelUrl()}/collections/orders`,
    rodape: 'O detalhe também ficou anotado em "Observações Internas" do pedido.',
  })

  await avisarAdministradores({
    payload,
    tipo: motivo === 'estoque' ? 'pedido-pago-sem-estoque' : 'pagamento-com-valor-divergente',
    assunto:
      motivo === 'estoque'
        ? `⚠️ Pedido ${orderNumber} pago, mas item sem estoque — Elessar Records`
        : `⚠️ Pagamento com valor divergente (${orderNumber}) — Elessar Records`,
    html,
  })
}
