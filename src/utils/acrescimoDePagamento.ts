import type { Order } from '../payload-types'

/**
 * Preço por forma de pagamento.
 *
 * O preço cadastrado no painel é o preço NO PIX. Cartão e boleto pagam 5% a
 * mais, sobre os produtos e sobre o frete — é a taxa que o Mercado Pago cobra
 * nesses meios e que antes saía da margem da loja. Saldo Mercado Pago paga o
 * preço do Pix: o MP não deixa excluí-lo da Preference de Pix.
 *
 * GÊMEO NO FRONT: `elessar-front/lib/utils/precoPorForma.ts`. As duas regras
 * precisam dar o mesmo centavo — o front mostra, este aqui cobra.
 *
 * O acréscimo é calculado POR UNIDADE, em centavos inteiros: assim o "no
 * cartão" da página do disco bate com o carrinho e com o que o MP cobra. E é
 * sempre derivado dos valores-base do pedido (itens e frete), nunca do
 * `total` — que já pode conter o acréscimo. Por isso aplicá-lo de novo dá o
 * mesmo número, e não 5% sobre 5%.
 */
export const PERCENTUAL_ACRESCIMO = 5

export type FormaDePagamento = 'pix' | 'cartao'

/** Qualquer coisa que não seja `cartao` é Pix — o preço mais baixo nunca é o padrão de um erro. */
export function formaValida(valor: unknown): FormaDePagamento {
  return valor === 'cartao' ? 'cartao' : 'pix'
}

/** Acréscimo de um valor em centavos, arredondado ao centavo (meio centavo sobe). */
export function acrescimoDe(centavos: number): number {
  return Math.round((centavos * PERCENTUAL_ACRESCIMO) / 100)
}

/** Valor unitário (centavos) que o Mercado Pago cobra na forma escolhida. */
export function valorNaForma(centavos: number, forma: FormaDePagamento): number {
  return forma === 'cartao' ? centavos + acrescimoDe(centavos) : centavos
}

type PedidoParaAcrescimo = {
  items: Array<{ unitPrice: number; quantity: number }>
  shipping?: number | null
}

/** Acréscimo do pedido inteiro no cartão: Σ acréscimo da unidade × quantidade + acréscimo do frete. */
export function acrescimoDoPedido(pedido: PedidoParaAcrescimo): number {
  const itens = pedido.items.reduce((soma, item) => soma + acrescimoDe(item.unitPrice) * item.quantity, 0)
  return itens + acrescimoDe(pedido.shipping ?? 0)
}

/** Total do pedido no Pix — subtotal + frete − desconto, sem acréscimo nenhum. */
export function totalBase(pedido: Pick<Order, 'subtotal' | 'shipping' | 'discount'>): number {
  return (pedido.subtotal ?? 0) + (pedido.shipping ?? 0) - (pedido.discount ?? 0)
}

/**
 * Forma da Preference que gerou o pagamento, lida do `metadata` que o próprio
 * servidor gravou nela (o MP copia para o pagamento, e o pagamento é relido na
 * API do MP — o cliente não tem como alterar).
 *
 * `null` = pagamento de Preference criada antes desta regra, que cobrava o
 * preço-base em qualquer meio. Esses pagamentos continuam valendo pelo base.
 */
export function formaDoPagamento(payment: { metadata?: unknown }): FormaDePagamento | null {
  const forma = (payment.metadata as { forma?: unknown } | null | undefined)?.forma
  return forma === 'pix' || forma === 'cartao' ? forma : null
}
