import type { Payload, PayloadRequest } from 'payload'
import type { Order } from '../payload-types'
import { montarPacote, type ItemPacote, type CaixaPadrao, type PacoteConsolidado } from './freteCalculo'

// Reconstrói o pacote consolidado de um pedido reaproveitando a MESMA heurística
// de empilhamento do endpoint de cotação (montarPacote). Carrega o peso/dimensões
// de cada produto (records ou apparel); se o produto sumiu, usa o fallback da caixa.
export async function construirPacoteDoPedido(
  payload: Payload,
  items: Order['items'],
  caixa: CaixaPadrao,
  pesoPadraoItem: number,
  req?: PayloadRequest,
): Promise<PacoteConsolidado> {
  const itensPacote: ItemPacote[] = []

  for (const item of items) {
    const prod = item.product
    const idRaw = prod.value
    const productId = typeof idRaw === 'object' && idRaw !== null ? idRaw.id : idRaw

    try {
      if (prod.relationTo === 'apparel') {
        const ap = await payload.findByID({
          collection: 'apparel',
          id: productId,
          depth: 0,
          req,
          select: { weight: true },
        })
        itensPacote.push({ pesoGramas: ap?.weight ?? null, dimensoes: null, quantidade: item.quantity })
      } else {
        const rec = await payload.findByID({
          collection: 'records',
          id: productId,
          depth: 0,
          req,
          select: { weight: true, dimensions: true },
        })
        itensPacote.push({ pesoGramas: rec?.weight ?? null, dimensoes: rec?.dimensions ?? null, quantidade: item.quantity })
      }
    } catch {
      // Produto não encontrado — usa o fallback da caixa padrão para este item.
      itensPacote.push({ pesoGramas: null, dimensoes: null, quantidade: item.quantity })
    }
  }

  return montarPacote(itensPacote, caixa, pesoPadraoItem)
}
