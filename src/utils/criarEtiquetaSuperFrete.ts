import type { Payload, PayloadRequest } from 'payload'
import type { Order, ConfiguracoesDeFrete } from '../payload-types'
import { construirPacoteDoPedido } from './construirPacoteDoPedido'

export interface ResultadoEtiqueta {
  id?: string
  status?: string
  erro?: string
}

const limpar = (s?: string | null): string => (s ?? '').replace(/\D/g, '')

// Cria a etiqueta PENDENTE no carrinho da SuperFrete (POST /api/v0/cart).
// NÃO paga/emite — o lojista finaliza manualmente no painel. Nunca loga/expõe o token.
export async function criarEtiquetaSuperFrete(
  payload: Payload,
  order: Order,
  config: ConfiguracoesDeFrete,
  req?: PayloadRequest,
): Promise<ResultadoEtiqueta> {
  const token = process.env.SUPERFRETE_TOKEN
  if (!token) return { erro: 'SUPERFRETE_TOKEN não configurado.' }

  const servicoId = order.freteEscolhido?.servicoId
  if (!servicoId) return { erro: 'Pedido sem serviço de frete (servicoId).' }

  const dest = order.destinatario
  if (!dest) return { erro: 'Pedido sem destinatário.' }

  const rem = config.remetente
  const base =
    process.env.SUPERFRETE_ENV === 'production'
      ? 'https://api.superfrete.com'
      : 'https://sandbox.superfrete.com'

  const caixa = {
    comprimento: config.caixaPadrao?.comprimento ?? 33,
    largura: config.caixaPadrao?.largura ?? 33,
    altura: config.caixaPadrao?.altura ?? 3,
  }
  const pacote = await construirPacoteDoPedido(payload, order.items, caixa, config.pesoPadraoItem ?? 350, req)

  const body = {
    from: {
      name: rem?.nome ?? '',
      address: rem?.rua ?? '',
      number: rem?.numero ?? '',
      complement: rem?.complemento ?? '',
      district: rem?.bairro ?? '',
      city: rem?.cidade ?? '',
      state_abbr: rem?.uf ?? '',
      postal_code: limpar(config.cepOrigem),
      document: limpar(rem?.documento) || undefined,
      phone: rem?.telefone ?? undefined,
      email: rem?.email ?? undefined,
    },
    to: {
      name: dest.nome ?? '',
      address: dest.rua ?? '',
      number: dest.numero ?? '',
      complement: dest.complemento ?? '',
      district: dest.bairro ?? '',
      city: dest.cidade ?? '',
      state_abbr: dest.uf ?? '',
      postal_code: limpar(dest.cep),
      document: limpar(dest.cpf),
      phone: dest.telefone ?? undefined,
      email: dest.email ?? undefined,
    },
    service: servicoId,
    volumes: {
      height: pacote.altura,
      width: pacote.largura,
      length: pacote.comprimento,
      weight: pacote.weightKg,
    },
    products: order.items.map((it) => ({
      name: it.productTitle,
      quantity: it.quantity,
      unitary_value: Number((it.unitPrice / 100).toFixed(2)),
    })),
    platform: 'Elessar Records',
  }

  let resp: Response
  try {
    resp = await fetch(`${base}/api/v0/cart`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': `Elessar Records (${process.env.SUPERFRETE_USER_AGENT_EMAIL ?? ''})`,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    return { erro: `Falha ao contatar a SuperFrete: ${(err as Error).message}` }
  }

  const raw: unknown = await resp.json().catch(() => null)

  if (!resp.ok) {
    let msg = `SuperFrete retornou ${resp.status}`
    if (raw && typeof raw === 'object' && 'message' in raw) {
      const m = (raw as { message?: unknown }).message
      if (typeof m === 'string') msg = m
    }
    return { erro: msg }
  }

  // Resposta esperada: objeto único { id, price, status }.
  const data = (Array.isArray(raw) ? raw[0] : raw) as { id?: string; status?: string } | null
  if (!data || typeof data.id !== 'string') {
    return { erro: 'Resposta da SuperFrete sem id da etiqueta.' }
  }
  return { id: data.id, status: data.status }
}
