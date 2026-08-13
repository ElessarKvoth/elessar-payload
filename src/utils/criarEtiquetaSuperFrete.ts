import type { Payload, PayloadRequest } from 'payload'
import type { Order, ConfiguracoesDeFrete } from '../payload-types'
import { construirPacoteDoPedido } from './construirPacoteDoPedido'

export interface ResultadoEtiqueta {
  id?: string
  status?: string
  erro?: string
}

const limpar = (s?: string | null): string => (s ?? '').replace(/\D/g, '')

const vazio = (s?: string | null): boolean => (s ?? '').trim() === ''

// Confere os dados do remetente ANTES de chamar a SuperFrete. Sem isso a API
// devolve um erro genérico ("Ocorreu um ou mais erros") que não diz o que falta,
// e o lojista fica sem saber que é só preencher Configurações de Frete.
function validarRemetente(
  rem: ConfiguracoesDeFrete['remetente'],
  cepOrigem: string,
): string | null {
  const faltando: string[] = []
  if (vazio(rem?.nome)) faltando.push('Nome / Razão social')
  if (limpar(rem?.documento).length !== 11 && limpar(rem?.documento).length !== 14) {
    faltando.push('CPF ou CNPJ (11 ou 14 dígitos)')
  }
  if (vazio(rem?.telefone)) faltando.push('Telefone')
  if (vazio(rem?.email)) faltando.push('E-mail')
  if (vazio(rem?.rua)) faltando.push('Rua')
  if (vazio(rem?.numero)) faltando.push('Número')
  if (vazio(rem?.bairro)) faltando.push('Bairro')
  if (vazio(rem?.cidade)) faltando.push('Cidade')
  if (vazio(rem?.uf)) faltando.push('UF')
  if (limpar(cepOrigem).length !== 8) faltando.push('CEP de origem (8 dígitos)')

  if (faltando.length === 0) return null
  return `Dados do remetente incompletos em Configurações de Frete: ${faltando.join(', ')}.`
}

// Extrai a mensagem mais útil do corpo de erro da SuperFrete, que varia de
// formato (string em `message`, array de erros, ou mapa campo → mensagem).
function mensagemDeErro(raw: unknown, status: number): string {
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>

    if (typeof obj.message === 'string' && obj.message.trim() !== '') {
      const detalhes = obj.errors ?? obj.error
      if (detalhes && typeof detalhes === 'object') {
        const partes = Object.entries(detalhes as Record<string, unknown>)
          .map(([campo, msg]) => `${campo}: ${Array.isArray(msg) ? msg.join(', ') : String(msg)}`)
          .filter(Boolean)
        if (partes.length > 0) return `${obj.message} — ${partes.join('; ')}`
      }
      return obj.message
    }

    if (typeof obj.error === 'string' && obj.error.trim() !== '') return obj.error

    if (obj.errors && typeof obj.errors === 'object') {
      const partes = Object.entries(obj.errors as Record<string, unknown>)
        .map(([campo, msg]) => `${campo}: ${Array.isArray(msg) ? msg.join(', ') : String(msg)}`)
        .filter(Boolean)
      if (partes.length > 0) return partes.join('; ')
    }
  }
  return `SuperFrete retornou ${status}`
}

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
  const erroRemetente = validarRemetente(rem, config.cepOrigem)
  if (erroRemetente) return { erro: erroRemetente }

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
    return { erro: mensagemDeErro(raw, resp.status) }
  }

  // Resposta esperada: objeto único { id, price, status }.
  const data = (Array.isArray(raw) ? raw[0] : raw) as { id?: string; status?: string } | null
  if (!data || typeof data.id !== 'string') {
    return { erro: 'Resposta da SuperFrete sem id da etiqueta.' }
  }
  return { id: data.id, status: data.status }
}
