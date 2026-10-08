import type { Payload } from 'payload'

import { listaAdminEmails } from './adminEmails'
import {
  dadosDaEmpresa,
  dataHoraBr,
  emailBase,
  painelUrl,
  reais,
  type DadosDaEmpresa,
  type EmailBaseArgs,
} from './emailTemplate'
import { enviarEmailTransacional } from './enviarEmail'
import type { EmailMontado } from './emailsDoCliente'
import type { PedidoParaEmail } from './pedidoParaEmail'

/* ────────────────────────────────────────────────────────────────────────────
   Avisos sobre pedidos, endereçados a QUEM CUIDA DA LOJA.

   Diferente dos e-mails do cliente, estes existem para o gerente não precisar
   ficar olhando o painel para saber que algo aconteceu — e, na venda paga,
   para ter na mão tudo o que precisa para separar e despachar sem abrir o
   pedido: qual cópia pegar, para onde mandar, se a etiqueta já existe.
   ──────────────────────────────────────────────────────────────────────────── */

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

const linkDoPedidoNoPainel = (p: PedidoParaEmail): string => `${painelUrl()}/collections/orders/${p.id}`

/** wa.me exige DDI. Telefone brasileiro vem sem o 55 na maioria dos cadastros. */
function linkDeWhatsApp(telefone?: string): string | null {
  const d = (telefone ?? '').replace(/\D/g, '')
  if (d.length < 10) return null
  return `https://wa.me/${d.startsWith('55') && d.length >= 12 ? d : `55${d}`}`
}

function totaisDoPedido(p: PedidoParaEmail): NonNullable<EmailBaseArgs['totais']> {
  return [
    { rotulo: 'Subtotal', valor: reais(p.subtotal) },
    { rotulo: 'Frete', valor: reais(p.frete) },
    ...(p.desconto > 0 ? [{ rotulo: 'Desconto', valor: `− ${reais(p.desconto)}` }] : []),
    { rotulo: 'Total', valor: reais(p.total), forte: true },
  ]
}

function secaoDoCliente(p: PedidoParaEmail): NonNullable<EmailBaseArgs['secoes']>[number] {
  return {
    titulo: 'Cliente',
    linhas: [
      { rotulo: 'Nome', valor: p.cliente.nome || p.destinatario.nome },
      { rotulo: 'E-mail', valor: p.cliente.email || p.destinatario.email },
      { rotulo: 'Telefone', valor: p.destinatario.telefone || p.cliente.telefone || '—' },
      { rotulo: 'Cidade', valor: p.destinatario.endereco[1]?.split(' — ')[1] ?? '—' },
    ],
  }
}

function situacaoDaEtiqueta(p: PedidoParaEmail): string {
  switch (p.statusEtiqueta) {
    case 'a_emitir':
      return 'Criada no carrinho da SuperFrete — falta pagar e imprimir'
    case 'emitida':
      return 'Emitida'
    case 'erro':
      return 'NÃO criada — fazer à mão na SuperFrete'
    default:
      return 'Não criada — fazer à mão na SuperFrete'
  }
}

export type AvisoDePedido = 'venda-paga' | 'aguardando-pagamento' | 'cancelado-pelo-cliente'

export function montarAvisoDePedido(
  aviso: AvisoDePedido,
  p: PedidoParaEmail,
  empresa?: DadosDaEmpresa,
): EmailMontado {
  switch (aviso) {
    // ── Venda paga: a lista de separação ───────────────────────────────────
    case 'venda-paga': {
      const unidades = p.itens.reduce((n, i) => n + i.quantidade, 0)
      return {
        assunto: `🟢 Venda paga ${p.numero} — separar ${unidades} ${unidades === 1 ? 'item' : 'itens'}`,
        html: emailBase({
          empresa,
          titulo: 'Venda paga — separar',
          corpo: [
            `Pedido **${p.numero}** pago${p.formaDePagamento ? ` via ${p.formaDePagamento}` : ''}. ` +
              'Separe os itens abaixo e prepare o envio.',
          ],
          aviso:
            p.statusEtiqueta === 'erro'
              ? `**A etiqueta não foi criada automaticamente.** Motivo: ${p.erroEtiqueta ?? 'desconhecido'}. ` +
                'Crie o envio à mão na SuperFrete com os dados abaixo.'
              : undefined,
          itens: p.itens.map((i) => ({
            titulo: i.artista ? `${i.artista} — ${i.titulo}` : i.titulo,
            linhas: [
              [...i.descricao, i.variante].filter(Boolean).join(' · '),
              i.prensagem,
              `SKU ${i.sku}`,
              i.estoqueRestante != null
                ? `Estoque agora: ${i.estoqueRestante}${i.estoqueRestante === 0 ? ' (esgotou — saiu do site)' : ''}`
                : undefined,
            ].filter((l): l is string => Boolean(l)),
            quantidade: i.quantidade,
            valor: `${reais(i.unitario)} un.`,
            imagem: i.imagem,
          })),
          totais: totaisDoPedido(p),
          secoes: [
            {
              titulo: 'Entregar para',
              linhas: [
                { rotulo: 'Nome', valor: p.destinatario.nome },
                { rotulo: 'CPF', valor: p.destinatario.cpf },
                { rotulo: 'Telefone', valor: p.destinatario.telefone },
                ...p.destinatario.endereco.map((linha, i) => ({ rotulo: i === 0 ? 'Endereço' : '', valor: linha })),
              ],
            },
            {
              titulo: 'Envio',
              linhas: [
                { rotulo: 'Serviço', valor: p.servicoDeFrete ?? '—' },
                ...(p.prazoDias ? [{ rotulo: 'Prazo', valor: `${p.prazoDias} dia(s) úteis` }] : []),
                { rotulo: 'Frete cobrado', valor: reais(p.frete) },
                { rotulo: 'Etiqueta', valor: situacaoDaEtiqueta(p) },
              ],
            },
            {
              titulo: 'Pagamento',
              linhas: [
                { rotulo: 'Forma', valor: p.formaDePagamento ?? '—' },
                { rotulo: 'Total', valor: reais(p.total) },
                ...(p.idPagamento ? [{ rotulo: 'ID no Mercado Pago', valor: p.idPagamento }] : []),
              ],
            },
            secaoDoCliente(p),
            ...(p.observacoes
              ? [{ titulo: 'Observação do cliente', linhas: [{ rotulo: 'Nota', valor: p.observacoes }] }]
              : []),
          ],
          botaoTexto: 'Abrir pedido no painel',
          botaoUrl: linkDoPedidoNoPainel(p),
          rodape:
            'Depois de postar: no painel, preencha o **código de rastreio** e mude a situação para ' +
            '**"Enviado"** — o cliente recebe o código por e-mail.',
        }),
      }
    }

    // ── Fechou o pedido e não pagou ────────────────────────────────────────
    case 'aguardando-pagamento': {
      const nome = p.cliente.nome || p.destinatario.nome || 'Um cliente'
      const whatsapp = linkDeWhatsApp(p.destinatario.telefone || p.cliente.telefone)
      return {
        assunto: `Pedido ${p.numero} aguardando pagamento — ${nome}`,
        html: emailBase({
          empresa,
          titulo: 'Pedido aguardando pagamento',
          corpo: [
            `**${nome}** fechou o pedido **${p.numero}** e ainda não pagou.`,
            'Nada foi separado nem baixado do estoque. Se o pagamento não vier, um contato pode ajudar a ' +
              'fechar a venda — às vezes é só dúvida sobre o frete ou o PIX.',
          ],
          itens: p.itens.map((i) => ({
            titulo: i.artista ? `${i.artista} — ${i.titulo}` : i.titulo,
            linhas: [`SKU ${i.sku}`],
            quantidade: i.quantidade,
            valor: reais(i.unitario * i.quantidade),
            imagem: i.imagem,
          })),
          totais: totaisDoPedido(p),
          secoes: [secaoDoCliente(p)],
          ...(whatsapp
            ? { botaoTexto: 'Chamar no WhatsApp', botaoUrl: whatsapp }
            : { botaoTexto: 'Abrir pedido no painel', botaoUrl: linkDoPedidoNoPainel(p) }),
          rodape: 'Se o cliente pagar, você recebe o e-mail de venda paga com a lista para separar.',
        }),
      }
    }

    // ── Cliente cancelou pelo site ─────────────────────────────────────────
    case 'cancelado-pelo-cliente':
      return {
        assunto: `Pedido ${p.numero} cancelado pelo cliente — Elessar Records`,
        html: emailBase({
          empresa,
          titulo: 'Pedido cancelado pelo cliente',
          corpo: [
            `O pedido **${p.numero}** foi cancelado pelo próprio cliente, pela página "Meus Pedidos".`,
            'O pagamento ainda não tinha sido feito, então **nada foi cobrado e nenhum item saiu do ' +
              'estoque** — não há estorno a fazer nem produto a repor.',
          ],
          itens: p.itens.map((i) => ({
            titulo: i.artista ? `${i.artista} — ${i.titulo}` : i.titulo,
            linhas: [`SKU ${i.sku}`],
            quantidade: i.quantidade,
            valor: reais(i.unitario * i.quantidade),
            imagem: i.imagem,
          })),
          totais: totaisDoPedido(p),
          secoes: [secaoDoCliente(p)],
          botaoTexto: 'Ver no painel',
          botaoUrl: linkDoPedidoNoPainel(p),
          rodape: 'Nenhuma ação é necessária.',
        }),
      }
  }
}

export async function enviarAvisoDePedido(
  payload: Payload,
  aviso: AvisoDePedido,
  p: PedidoParaEmail,
): Promise<void> {
  const { assunto, html } = montarAvisoDePedido(aviso, p, await dadosDaEmpresa(payload))
  await avisarAdministradores({ payload, tipo: `admin-${aviso}`, assunto, html })
}

// ── Novo cliente ─────────────────────────────────────────────────────────────

export function montarAvisoDeNovoCliente(
  args: { nome?: string | null; email: string; telefone?: string | null; quando?: Date },
  empresa?: DadosDaEmpresa,
): EmailMontado {
  const nome = args.nome?.trim() || args.email
  return {
    assunto: `Novo cliente: ${nome} — Elessar Records`,
    html: emailBase({
      empresa,
      titulo: 'Novo cliente',
      corpo: [`**${nome}** criou e confirmou uma conta na loja.`],
      detalhes: [
        { rotulo: 'Nome', valor: args.nome?.trim() || '—' },
        { rotulo: 'E-mail', valor: args.email },
        { rotulo: 'Telefone', valor: args.telefone?.trim() || '—' },
        { rotulo: 'Quando', valor: dataHoraBr(args.quando) },
      ],
      botaoTexto: 'Ver clientes no painel',
      botaoUrl: `${painelUrl()}/collections/users`,
    }),
  }
}

export async function avisarAdminDeNovoCliente(args: {
  payload: Payload
  nome?: string | null
  email: string
  telefone?: string | null
}): Promise<void> {
  const { assunto, html } = montarAvisoDeNovoCliente(args, await dadosDaEmpresa(args.payload))
  await avisarAdministradores({ payload: args.payload, tipo: 'admin-novo-cliente', assunto, html })
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
      `Entrou um pagamento aprovado no Mercado Pago referente ao pedido **${orderNumber}**, ` +
        `mas esse pedido está com a situação **${statusDoPedido}**.`,
      'O pedido **não** foi marcado como pago e **nenhum item foi baixado do estoque** — isso é ' +
        'proposital, porque um pedido cancelado não tem mais reserva nem compromisso de entrega.',
      '**Mas o dinheiro provavelmente está na conta.** Confira no Mercado Pago e devolva ao ' +
        'cliente, ou combine com ele refazer o pedido.',
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
          `O cliente pagou o pedido **${orderNumber}**, mas um dos itens **não tinha mais estoque** ` +
            'na hora da confirmação.',
          'O pedido **não** virou "pago", nenhum item foi baixado e nenhuma etiqueta foi criada. ' +
            'O pagamento ficou registrado no pedido, e o cliente vê que a loja vai entrar em contato — ' +
            'o botão de pagar some para ele não pagar de novo.',
          '**O que fazer:** se conseguir repor o item, ajuste o estoque e mude a situação do pedido ' +
            'para "Pago" no painel (o estoque é baixado e a etiqueta é criada na hora). Se não, ' +
            'devolva o valor no Mercado Pago e mude a situação para "Reembolsado".',
        ]
      : [
          `Entrou um pagamento aprovado para o pedido **${orderNumber}**, mas **o valor não confere** ` +
            'com o total do pedido.',
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
