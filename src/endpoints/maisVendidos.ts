import type { Endpoint, PayloadRequest } from 'payload'
import { headersWithCors } from 'payload'

/* ────────────────────────────────────────────────────────────────────────────
   GET /api/produtos/mais-vendidos

   Ranking de produtos por quantidade vendida, para a vitrine e para o selo
   "Mais vendido" do card.

   POR QUE UM ENDPOINT, E NÃO UM CAMPO CONTADOR
   ────────────────────────────────────────────
   Um `soldCount` em `records` e `apparel` seria mais barato de ler, mas
   custaria: (1) migration em duas collections, (2) um hook novo dentro do
   `afterChange` de Orders — que é exatamente o lugar onde mora a reserva
   atômica de estoque e a criação de etiqueta, o código mais delicado do
   sistema. Contador desincronizado por um pedido cancelado ou reembolsado
   viraria "mais vendido" mentiroso, e consertar exigiria recontar tudo de
   qualquer forma.

   Agregar na leitura é reversível e não encosta em nada do fluxo de pagamento.
   Se um dia o volume justificar, o contador entra como cache DESTE cálculo.

   O QUE NUNCA SAI DAQUI
   ─────────────────────
   Só id e quantidade agregada. Nenhum dado de pedido, cliente, endereço ou
   valor. A collection `orders` tem `read: isAdminOrCustomer` justamente para
   ninguém ver pedido alheio, e este endpoint não abre exceção nenhuma a isso:
   ele lê pelo Local API (contexto de servidor) e devolve um ranking anônimo.

   CUSTO
   ─────
   Uma consulta a `orders` por cálculo, com `depth: 0`, teto de linhas e recorte
   por janela de tempo. O resultado fica em cache de processo por 10 minutos, e
   o storefront ainda põe o cache dele por cima. Em pico, o banco vê no máximo
   uma consulta a cada 10 minutos por instância.
   ──────────────────────────────────────────────────────────────────────────── */

/** Status que contam como venda concretizada. */
const STATUS_DE_VENDA = ['pago', 'etiqueta_criada', 'enviado', 'entregue']

/** Janela do ranking. "Mais vendido" é sobre agora, não sobre 2024. */
const DIAS_DE_JANELA = 180

/** Teto de pedidos lidos por cálculo. Segura o custo se a loja explodir. */
const MAXIMO_DE_PEDIDOS = 500

/** Vida do cache em memória. */
const CACHE_MS = 10 * 60_000

interface Ranking {
  records: Array<{ id: string; vendas: number }>
  apparel: Array<{ id: string; vendas: number }>
}

interface ItemDoPedido {
  product?: { relationTo?: 'records' | 'apparel'; value?: number | string | { id: number | string } }
  quantity?: number
}

let cache: { em: number; dados: Ranking } | null = null

/**
 * O id do produto dentro da relação polimórfica.
 *
 * Com `depth: 0` o Payload devolve o id cru, mas a forma hidratada aparece
 * quando alguém muda a profundidade da consulta — e um `String({...})` viraria
 * "[object Object]" como chave do ranking, em silêncio. Cobrir os dois casos
 * custa uma linha.
 */
const idDoValue = (v: number | string | { id: number | string }): string =>
  typeof v === 'object' && v !== null ? String(v.id) : String(v)

async function calcular(req: PayloadRequest): Promise<Ranking> {
  const desde = new Date(Date.now() - DIAS_DE_JANELA * 86_400_000).toISOString()

  const pedidos = await req.payload.find({
    collection: 'orders',
    where: {
      and: [{ status: { in: STATUS_DE_VENDA } }, { createdAt: { greater_than: desde } }],
    },
    // `depth: 0` é o que mantém isto barato: sem ele o Payload hidrataria
    // produto, cliente e mídia de cada pedido só para contar quantidade.
    depth: 0,
    limit: MAXIMO_DE_PEDIDOS,
    sort: '-createdAt',
    pagination: false,
    // Só os itens interessam. Nenhum campo de cliente, endereço ou pagamento
    // chega sequer a ser lido.
    select: { items: true },
    req,
  })

  const contagem = { records: new Map<string, number>(), apparel: new Map<string, number>() }

  for (const pedido of pedidos.docs) {
    const itens = (pedido as { items?: ItemDoPedido[] }).items ?? []
    for (const item of itens) {
      const colecao = item.product?.relationTo
      if (colecao !== 'records' && colecao !== 'apparel') continue
      const bruto = item.product?.value
      if (bruto == null) continue
      const id = idDoValue(bruto)
      const qtd = Number(item.quantity ?? 0)
      if (!Number.isFinite(qtd) || qtd <= 0) continue
      contagem[colecao].set(id, (contagem[colecao].get(id) ?? 0) + qtd)
    }
  }

  const ordenar = (mapa: Map<string, number>) =>
    [...mapa.entries()]
      .map(([id, vendas]) => ({ id, vendas }))
      .sort((a, b) => b.vendas - a.vendas)

  return { records: ordenar(contagem.records), apparel: ordenar(contagem.apparel) }
}

export const maisVendidos: Endpoint = {
  path: '/produtos/mais-vendidos',
  method: 'get',
  handler: async (req) => {
    const agora = Date.now()
    if (!cache || agora - cache.em > CACHE_MS) {
      try {
        cache = { em: agora, dados: await calcular(req) }
      } catch (erro) {
        req.payload.logger.error(`[mais-vendidos] falha ao agregar: ${String(erro)}`)
        // Nunca derruba a vitrine por causa do ranking: ranking vazio faz o
        // storefront cair no fallback dele (novidades) sem mostrar erro.
        return Response.json(
          { records: [], apparel: [] } satisfies Ranking,
          { status: 200, headers: headersWithCors({ headers: new Headers(), req }) },
        )
      }
    }

    const limiteBruto = Number(req.searchParams?.get('limit') ?? '12')
    const limite = Number.isFinite(limiteBruto) ? Math.min(Math.max(1, limiteBruto), 50) : 12

    return Response.json(
      {
        records: cache.dados.records.slice(0, limite),
        apparel: cache.dados.apparel.slice(0, limite),
      } satisfies Ranking,
      {
        status: 200,
        headers: headersWithCors({
          headers: new Headers({ 'Cache-Control': 'public, max-age=600' }),
          req,
        }),
      },
    )
  },
}
