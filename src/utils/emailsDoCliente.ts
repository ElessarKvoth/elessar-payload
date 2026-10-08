import type { Payload } from 'payload'

import {
  dadosDaEmpresa,
  emailBase,
  reais,
  storefrontUrl,
  type DadosDaEmpresa,
  type EmailBaseArgs,
} from './emailTemplate'
import { enviarEmailTransacional } from './enviarEmail'
import { primeiroNome, type PedidoParaEmail } from './pedidoParaEmail'

/* ────────────────────────────────────────────────────────────────────────────
   E-mails do pedido para o CLIENTE — um por etapa.

   Antes não existia nenhum: quem pagava só via o comprovante do Mercado Pago
   e não sabia mais nada até o pacote chegar (ou não chegar). Cada e-mail traz
   o pedido inteiro — itens, valores, endereço — para o cliente não precisar
   entrar no site para conferir.

   `montarEmailDoCliente` é pura (sem banco, sem envio) para dar para
   pré-visualizar; `enviarEmailDoCliente` busca a empresa e envia.
   ──────────────────────────────────────────────────────────────────────────── */

export type EtapaDoPedido =
  | 'recebido'
  | 'pago'
  | 'enviado'
  | 'entregue'
  | 'cancelado'
  | 'reembolsado'
  | 'retido'

export interface EmailMontado {
  assunto: string
  html: string
}

const prazoDeEntrega = (dias?: number | null): string | undefined =>
  dias ? `até ${dias} dia${dias > 1 ? 's' : ''} úteis após a postagem` : undefined

function itensDoPedido(p: PedidoParaEmail): NonNullable<EmailBaseArgs['itens']> {
  return p.itens.map((i) => ({
    titulo: i.titulo,
    linhas: [i.artista, [...i.descricao, i.variante].filter(Boolean).join(' · ')].filter(
      (l): l is string => Boolean(l),
    ),
    quantidade: i.quantidade,
    valor: reais(i.unitario * i.quantidade),
    imagem: i.imagem,
  }))
}

function totaisDoPedido(p: PedidoParaEmail): NonNullable<EmailBaseArgs['totais']> {
  return [
    { rotulo: 'Subtotal', valor: reais(p.subtotal) },
    { rotulo: p.servicoDeFrete ? `Frete (${p.servicoDeFrete})` : 'Frete', valor: reais(p.frete) },
    ...(p.desconto > 0 ? [{ rotulo: 'Desconto', valor: `− ${reais(p.desconto)}` }] : []),
    { rotulo: 'Total', valor: reais(p.total), forte: true },
  ]
}

function secaoDeEntrega(p: PedidoParaEmail): NonNullable<EmailBaseArgs['secoes']>[number] {
  const prazo = prazoDeEntrega(p.prazoDias)
  return {
    titulo: 'Entrega',
    linhas: [
      { rotulo: 'Para', valor: p.destinatario.nome },
      { rotulo: 'Endereço', valor: p.destinatario.endereco.join(', ') },
      ...(p.servicoDeFrete ? [{ rotulo: 'Envio', valor: p.servicoDeFrete }] : []),
      ...(prazo ? [{ rotulo: 'Prazo', valor: prazo }] : []),
    ],
  }
}

export function montarEmailDoCliente(
  etapa: EtapaDoPedido,
  p: PedidoParaEmail,
  empresa?: DadosDaEmpresa,
  extra: { estavaPago?: boolean } = {},
): EmailMontado {
  const loja = storefrontUrl()
  const nome = primeiroNome(p)
  const comum = {
    empresa,
    saudacao: nome ? `Olá, ${nome}` : undefined,
    itens: itensDoPedido(p),
  }
  const acompanhar = { botaoTexto: 'Acompanhar pedido', botaoUrl: `${loja}/meus-pedidos` }

  switch (etapa) {
    case 'recebido':
      return {
        assunto: `Recebemos seu pedido ${p.numero} — Elessar Records`,
        html: emailBase({
          ...comum,
          titulo: 'Pedido recebido',
          corpo: [
            `Seu pedido **${p.numero}** foi registrado.`,
            'Os itens são separados assim que o pagamento é confirmado. Se ainda não pagou, é só usar o botão ' +
              'abaixo. Se já pagou, pode ignorar: a confirmação chega em outro e-mail.',
          ],
          totais: totaisDoPedido(p),
          secoes: [secaoDeEntrega(p)],
          botaoTexto: 'Pagar agora',
          botaoUrl: `${loja}/pedido-confirmado/${encodeURIComponent(p.numero)}`,
          rodape: 'Pedido não pago não é cobrado. Se desistir, você pode cancelar em Meus Pedidos.',
        }),
      }

    case 'pago':
      return {
        assunto: `Pagamento confirmado — pedido ${p.numero}`,
        html: emailBase({
          ...comum,
          titulo: 'Pagamento confirmado',
          corpo: [
            `Recebemos o pagamento do pedido **${p.numero}**. Agora a gente separa seus itens e prepara o envio.`,
            'Quando o pacote for postado, você recebe outro e-mail com o código de rastreio.',
          ],
          totais: totaisDoPedido(p),
          secoes: [
            secaoDeEntrega(p),
            {
              titulo: 'Pagamento',
              linhas: [
                ...(p.formaDePagamento ? [{ rotulo: 'Forma', valor: p.formaDePagamento }] : []),
                { rotulo: 'Total pago', valor: reais(p.total) },
              ],
            },
          ],
          ...acompanhar,
          rodape: 'Precisa mudar algo no pedido? Fale com a loja o quanto antes — antes da postagem.',
        }),
      }

    case 'enviado':
      return {
        assunto: `Seu pedido ${p.numero} foi enviado`,
        html: emailBase({
          ...comum,
          titulo: 'Pedido a caminho',
          corpo: [
            `Seu pedido **${p.numero}** foi postado${p.servicoDeFrete ? ` via ${p.servicoDeFrete}` : ''}.`,
            p.codigoRastreio
              ? `Código de rastreio: **${p.codigoRastreio}**. Use no site da transportadora para acompanhar a entrega.`
              : 'O código de rastreio aparece em Meus Pedidos assim que a loja cadastrar.',
          ],
          secoes: [secaoDeEntrega(p)],
          ...acompanhar,
        }),
      }

    case 'entregue':
      return {
        assunto: `Pedido ${p.numero} entregue — Elessar Records`,
        html: emailBase({
          ...comum,
          titulo: 'Pedido entregue',
          corpo: [
            `Seu pedido **${p.numero}** consta como entregue. Boa audição!`,
            'Algum problema com o que chegou? Você tem **7 dias** a partir do recebimento para pedir troca ou devolução.',
          ],
          botaoTexto: 'Trocas e devoluções',
          botaoUrl: `${loja}/trocas`,
        }),
      }

    case 'cancelado':
      return {
        assunto: `Pedido ${p.numero} cancelado`,
        html: emailBase({
          ...comum,
          titulo: 'Pedido cancelado',
          corpo: extra.estavaPago
            ? [
                `O pedido **${p.numero}** foi cancelado.`,
                'Como ele já estava pago, a loja vai devolver o valor. Você recebe outro e-mail quando o reembolso for feito.',
              ]
            : [
                `O pedido **${p.numero}** foi cancelado.`,
                '**Nada foi cobrado.** Se ainda tiver aberta a página de pagamento do Mercado Pago, não conclua.',
              ],
          totais: totaisDoPedido(p),
          botaoTexto: 'Ver os produtos',
          botaoUrl: `${loja}/catalogo`,
        }),
      }

    case 'reembolsado':
      return {
        assunto: `Reembolso do pedido ${p.numero}`,
        html: emailBase({
          ...comum,
          titulo: 'Reembolso feito',
          corpo: [
            `A loja devolveu **${reais(p.total)}** referente ao pedido **${p.numero}**.`,
            'No PIX o valor volta na hora. No cartão, o estorno aparece na fatura em até dois ciclos, conforme o banco.',
          ],
          ...acompanhar,
        }),
      }

    case 'retido':
      return {
        assunto: `Pedido ${p.numero}: pagamento recebido, item esgotado`,
        html: emailBase({
          ...comum,
          titulo: 'Pagamento recebido',
          corpo: [
            `Recebemos o pagamento do pedido **${p.numero}**, mas um dos itens esgotou antes da confirmação.`,
            'A loja já foi avisada e vai falar com você para repor o item ou devolver o valor. ' +
              '**Não é preciso pagar de novo.**',
          ],
          totais: totaisDoPedido(p),
          ...acompanhar,
        }),
      }
  }
}

export async function enviarEmailDoCliente(
  payload: Payload,
  etapa: EtapaDoPedido,
  p: PedidoParaEmail,
  extra: { estavaPago?: boolean } = {},
): Promise<void> {
  // A conta é o endereço confirmado de quem comprou; o do destinatário pode ser
  // de quem só recebe o presente.
  const para = p.cliente.email || p.destinatario.email
  if (!para) {
    payload.logger.error(`[email] pedido ${p.numero} sem e-mail de cliente — etapa "${etapa}" não enviada.`)
    return
  }
  const { assunto, html } = montarEmailDoCliente(etapa, p, await dadosDaEmpresa(payload), extra)
  await enviarEmailTransacional({ payload, tipo: `pedido-${etapa}`, para, assunto, html })
}
