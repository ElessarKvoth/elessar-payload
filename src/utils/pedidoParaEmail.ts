import type { Payload } from 'payload'

import type { Apparel, Artist, Media, Order, Record as Disco, User } from '../payload-types'

/* ────────────────────────────────────────────────────────────────────────────
   O pedido no formato que os e-mails precisam.

   Lê do banco DEPOIS da gravação (os e-mails saem só quando a transação já foi
   confirmada) e junta o que está espalhado: o cliente da conta, o disco com
   artista e capa, o estoque que sobrou. Cada e-mail escolhe o que mostrar —
   o do cliente é enxuto, o da separação leva tudo.
   ──────────────────────────────────────────────────────────────────────────── */

export interface ItemDoPedido {
  titulo: string
  artista?: string
  /** Formato, modelo, condição — o que diz "qual cópia" pegar. */
  descricao: string[]
  /** Gravadora e ano: confere a prensagem certa na prateleira. */
  prensagem?: string
  /** Tamanho/cor, quando é vestuário. */
  variante?: string
  sku: string
  quantidade: number
  /** Centavos. */
  unitario: number
  imagem?: string | null
  /** Saldo atual do produto (ou da variante), já descontada esta venda. */
  estoqueRestante?: number | null
}

export interface PedidoParaEmail {
  id: number
  numero: string
  criadoEm: string
  status: Order['status']
  paymentStatus: Order['paymentStatus']
  formaDePagamento?: string
  idPagamento?: string | null
  itens: ItemDoPedido[]
  /** Centavos. */
  subtotal: number
  frete: number
  desconto: number
  total: number
  servicoDeFrete?: string
  prazoDias?: number | null
  destinatario: {
    nome: string
    cpf: string
    email: string
    telefone: string
    /** Endereço pronto para etiqueta, uma linha por item. */
    endereco: string[]
  }
  observacoes?: string | null
  statusEtiqueta?: Order['statusEtiqueta']
  erroEtiqueta?: string | null
  codigoRastreio?: string | null
  cliente: { nome?: string; email?: string; telefone?: string }
}

const FORMATO: Record<Disco['format'], string> = { vinyl: 'Vinil', cd: 'CD' }

const MODELO_DO_VINIL: Record<Exclude<NonNullable<Disco['vinylModel']>, 'other'>, string> = {
  black: 'preto',
  clear: 'transparente',
  splatter: 'splatter',
  picture_disc: 'picture disc',
}

const CONDICAO: Record<string, string> = {
  new: 'Novo',
  used: 'Usado',
  rare: 'Raro',
  collectible: 'Colecionável',
}

const TIPO_DE_VESTUARIO: Record<Apparel['apparelType'], string> = {
  tshirt: 'Camiseta',
  hoodie: 'Moletom',
  jacket: 'Jaqueta',
  cap: 'Boné',
  belt: 'Cinto',
  poster: 'Pôster',
  patch: 'Patch',
  accessory: 'Acessório',
}

const FORMA_DE_PAGAMENTO: Record<NonNullable<Order['paymentMethod']>, string> = {
  pix: 'PIX',
  credit_card: 'Cartão de crédito',
  boleto: 'Boleto',
  other: 'Outro',
}

/**
 * Miniatura leve da capa. O painel guarda a URL limpa do Cloudinary; pedimos
 * 112px em JPG (o dobro do exibido, para telas densas). JPG e não `f_auto`
 * porque WebP/AVIF ainda falham em parte dos clientes de e-mail.
 */
function miniatura(media: number | Media | null | undefined): string | null {
  const url = typeof media === 'object' && media !== null ? media.url : null
  if (!url) return null
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url
  return url.replace('/upload/', '/upload/c_fill,w_112,h_112,q_auto,f_jpg/')
}

const nomeDoArtista = (a: number | Artist | null | undefined): string | undefined =>
  typeof a === 'object' && a !== null ? a.name : undefined

const cepFormatado = (cep: string): string => {
  const d = cep.replace(/\D/g, '')
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : cep
}

async function detalharItem(payload: Payload, item: Order['items'][number]): Promise<ItemDoPedido> {
  const base: ItemDoPedido = {
    titulo: item.productTitle,
    descricao: [],
    sku: item.productSku,
    quantidade: item.quantity,
    unitario: item.unitPrice,
  }
  const id = typeof item.product.value === 'object' ? item.product.value.id : item.product.value

  if (item.product.relationTo === 'records') {
    const disco = (await payload
      .findByID({ collection: 'records', id, depth: 1, overrideAccess: true })
      .catch(() => null)) as Disco | null
    if (!disco) return base

    const modelo =
      disco.format === 'vinyl' && disco.vinylModel
        ? disco.vinylModel === 'other'
          ? disco.vinylModelCustom?.trim() || null // "outro" sozinho não ajuda a achar a cópia
          : MODELO_DO_VINIL[disco.vinylModel]
        : null
    return {
      ...base,
      artista: nomeDoArtista(disco.artist),
      descricao: [
        [FORMATO[disco.format], modelo].filter(Boolean).join(' '),
        CONDICAO[disco.condition] ?? disco.condition,
      ].filter(Boolean),
      prensagem: [disco.recordLabel, disco.releaseYear].filter(Boolean).join(' · ') || undefined,
      imagem: miniatura(disco.images?.[0]?.image),
      estoqueRestante: disco.stock,
    }
  }

  const peca = (await payload
    .findByID({ collection: 'apparel', id, depth: 1, overrideAccess: true })
    .catch(() => null)) as Apparel | null
  if (!peca) return base

  const variante = peca.variants?.find(
    (v) => v.size === item.variantSize && (!item.variantColor || v.color === item.variantColor),
  )
  const tamanho = item.variantSize === 'unico' ? 'Tamanho único' : item.variantSize ? `Tam. ${item.variantSize}` : null
  return {
    ...base,
    artista: nomeDoArtista(peca.artist),
    descricao: [TIPO_DE_VESTUARIO[peca.apparelType], CONDICAO[peca.condition] ?? peca.condition].filter(Boolean),
    variante: [tamanho, item.variantColor].filter(Boolean).join(' · ') || undefined,
    imagem: miniatura(peca.images?.[0]?.image),
    estoqueRestante: variante ? variante.stock : null,
  }
}

/** Lê o pedido já gravado. `null` se ele não existir (ex: a transação foi desfeita). */
export async function carregarPedidoParaEmail(
  payload: Payload,
  orderId: number | string,
): Promise<PedidoParaEmail | null> {
  const pedido = (await payload
    .findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true })
    .catch(() => null)) as Order | null
  if (!pedido) return null

  const idCliente = typeof pedido.customer === 'object' ? pedido.customer.id : pedido.customer
  const cliente = (await payload
    .findByID({ collection: 'users', id: idCliente, depth: 0, overrideAccess: true })
    .catch(() => null)) as User | null

  const itens = await Promise.all(pedido.items.map((it) => detalharItem(payload, it)))
  const d = pedido.destinatario ?? {}
  const frete = pedido.freteEscolhido ?? {}

  return {
    id: pedido.id,
    numero: pedido.orderNumber,
    criadoEm: pedido.createdAt,
    status: pedido.status,
    paymentStatus: pedido.paymentStatus,
    formaDePagamento: pedido.paymentMethod ? FORMA_DE_PAGAMENTO[pedido.paymentMethod] : undefined,
    idPagamento: pedido.idPagamentoMercadoPago,
    itens,
    subtotal: pedido.subtotal,
    frete: pedido.shipping ?? 0,
    desconto: pedido.discount ?? 0,
    total: pedido.total,
    servicoDeFrete: [frete.nome, frete.transportadora].filter(Boolean).join(' · ') || undefined,
    prazoDias: frete.prazo,
    destinatario: {
      nome: d.nome ?? '',
      cpf: d.cpf ?? '',
      email: d.email ?? '',
      telefone: d.telefone ?? '',
      endereco: [
        [`${d.rua ?? ''}, ${d.numero ?? ''}`, d.complemento].filter(Boolean).join(' — '),
        `${d.bairro ?? ''} — ${d.cidade ?? ''}/${d.uf ?? ''}`,
        `CEP ${cepFormatado(d.cep ?? '')}`,
      ],
    },
    observacoes: pedido.customerNotes?.trim() || null,
    statusEtiqueta: pedido.statusEtiqueta,
    erroEtiqueta: pedido.erroEtiqueta,
    codigoRastreio: pedido.codigoRastreio?.trim() || null,
    cliente: {
      nome: cliente?.name ?? undefined,
      email: cliente?.email ?? undefined,
      telefone: cliente?.phone ?? undefined,
    },
  }
}

/** Primeiro nome para a saudação ("Olá, Ana"). */
export const primeiroNome = (p: PedidoParaEmail): string | undefined =>
  (p.cliente.nome || p.destinatario.nome).trim().split(/\s+/)[0] || undefined
