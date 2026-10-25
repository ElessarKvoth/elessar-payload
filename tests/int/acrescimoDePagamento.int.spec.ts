import { describe, expect, it } from 'vitest'

import {
  acrescimoDe,
  acrescimoDoPedido,
  formaDoPagamento,
  formaValida,
  totalBase,
  valorNaForma,
} from '@/utils/acrescimoDePagamento'

// Funções puras — não tocam no banco (o api.int.spec.ts toca, e o banco é o de produção).
describe('acréscimo de pagamento', () => {
  it('Pix é o preço-base; cartão é +5%', () => {
    expect(valorNaForma(10000, 'pix')).toBe(10000)
    expect(valorNaForma(10000, 'cartao')).toBe(10500)
  })

  it('arredonda ao centavo, meio centavo para cima', () => {
    expect(valorNaForma(10099, 'cartao')).toBe(10604) // 100,99 → 106,04 (504,95 → 505)
    expect(acrescimoDe(10010)).toBe(501) // 500,5 → 501
    expect(acrescimoDe(1)).toBe(0)
    expect(acrescimoDe(0)).toBe(0)
  })

  it('pedido com vários itens soma o acréscimo por unidade, mais o do frete', () => {
    const pedido = {
      items: [
        { unitPrice: 10099, quantity: 3 },
        { unitPrice: 8990, quantity: 1 },
      ],
      shipping: 2537,
    }
    // 505×3 + 450 (449,5) + 127 (126,85)
    expect(acrescimoDoPedido(pedido)).toBe(1515 + 450 + 127)
    // A soma dos itens no cartão bate com o que a Preference cobra item a item.
    const naPreference =
      valorNaForma(10099, 'cartao') * 3 + valorNaForma(8990, 'cartao') + valorNaForma(2537, 'cartao')
    expect(10099 * 3 + 8990 + 2537 + acrescimoDoPedido(pedido)).toBe(naPreference)
  })

  it('pedido de um item, sem frete', () => {
    expect(acrescimoDoPedido({ items: [{ unitPrice: 15000, quantity: 1 }], shipping: null })).toBe(750)
  })

  it('não acumula: o acréscimo sai dos valores-base, nunca do total', () => {
    const pedido = { items: [{ unitPrice: 10000, quantity: 2 }], shipping: 3000, subtotal: 20000, discount: 0 }
    const primeiro = acrescimoDoPedido(pedido)
    const total = totalBase(pedido) + primeiro
    // Recalcular depois de gravado dá o mesmo número.
    expect(acrescimoDoPedido(pedido)).toBe(primeiro)
    expect(totalBase(pedido) + acrescimoDoPedido(pedido)).toBe(total)
    expect(total).toBe(23000 + 1150)
  })

  it('total-base = subtotal + frete − desconto', () => {
    expect(totalBase({ subtotal: 20000, shipping: 3000, discount: 500 })).toBe(22500)
    expect(totalBase({ subtotal: 20000, shipping: null, discount: null })).toBe(20000)
  })

  it('forma ausente ou manipulada vira Pix', () => {
    expect(formaValida('cartao')).toBe('cartao')
    expect(formaValida('pix')).toBe('pix')
    expect(formaValida(undefined)).toBe('pix')
    expect(formaValida('CARTAO')).toBe('pix')
    expect(formaValida({ forma: 'cartao' })).toBe('pix')
  })

  it('a forma do pagamento vem do metadata da Preference; sem ele, é legado', () => {
    expect(formaDoPagamento({ metadata: { forma: 'cartao' } })).toBe('cartao')
    expect(formaDoPagamento({ metadata: { forma: 'pix' } })).toBe('pix')
    expect(formaDoPagamento({ metadata: {} })).toBeNull()
    expect(formaDoPagamento({})).toBeNull()
    expect(formaDoPagamento({ metadata: { forma: 'boleto' } })).toBeNull()
  })
})
