import type { Endpoint, PayloadRequest } from 'payload'
import { addDataAndFileToRequest, headersWithCors } from 'payload'

import { montarPacote, type ItemPacote } from '../utils/freteCalculo'

// Item enviado pelo cliente no corpo da requisição.
// `productType` é opcional e assume 'records' (retrocompatível com a Fase 1).
interface ItemEntrada {
  recordId: string | number
  quantidade: number
  productType: 'records' | 'apparel'
}

// Uma opção de frete retornada pela SuperFrete. Tipamos só o que usamos; opções
// indisponíveis vêm com `error` e/ou sem `price` válido.
interface OpcaoSuperFrete {
  id?: number
  name?: string
  price?: number | string
  error?: string
  delivery_time?: number
  delivery_range?: { min?: number; max?: number }
  company?: { name?: string }
}

function respostaJson(req: PayloadRequest, body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: headersWithCors({ headers: new Headers(), req }),
  })
}

const respostaErro = (req: PayloadRequest, status: number, erro: string): Response =>
  respostaJson(req, { erro }, status)

/**
 * POST /api/frete/cotar
 * Cotação de frete (calculadora SuperFrete). Acesso público, somente leitura.
 * Nunca retorna o preço bruto da SuperFrete — apenas o valor já acrescido.
 */
export const cotarFrete: Endpoint = {
  path: '/frete/cotar',
  method: 'post',
  handler: async (req) => {
    await addDataAndFileToRequest(req)
    const body = (req.data ?? {}) as { cepDestino?: unknown; itens?: unknown }

    // ── 1. Validação de entrada ───────────────────────────────────────────
    const cepDestino = (typeof body.cepDestino === 'string' ? body.cepDestino : '').replace(
      /\D/g,
      '',
    )
    if (cepDestino.length !== 8) {
      return respostaErro(req, 400, 'CEP de destino inválido. Informe 8 dígitos.')
    }

    if (!Array.isArray(body.itens) || body.itens.length === 0) {
      return respostaErro(req, 400, 'Informe ao menos um item para cotar o frete.')
    }

    const itens: ItemEntrada[] = []
    for (const raw of body.itens) {
      const it = (raw ?? {}) as { recordId?: unknown; quantidade?: unknown; productType?: unknown }
      const recordId = it.recordId
      const quantidade = Number(it.quantidade)
      if ((typeof recordId !== 'string' && typeof recordId !== 'number') || recordId === '') {
        return respostaErro(req, 400, 'Item inválido: recordId é obrigatório.')
      }
      if (!Number.isFinite(quantidade) || quantidade < 1) {
        return respostaErro(req, 400, 'Item inválido: quantidade deve ser no mínimo 1.')
      }
      let productType: 'records' | 'apparel' = 'records'
      if (it.productType !== undefined) {
        if (it.productType !== 'records' && it.productType !== 'apparel') {
          return respostaErro(req, 400, 'Item inválido: productType deve ser "records" ou "apparel".')
        }
        productType = it.productType
      }
      itens.push({ recordId, quantidade: Math.floor(quantidade), productType })
    }

    // ── 2. Carrega cada produto e valida disponibilidade ──────────────────
    // Suporta discos (records) e vestuário (apparel). Vestuário não tem grupo de
    // dimensões cadastrado, então cai no fallback da caixa padrão em montarPacote.
    const itensPacote: ItemPacote[] = []
    for (const item of itens) {
      let pesoGramas: number | null = null
      let dimensoes: ItemPacote['dimensoes'] = null
      let ativo = true
      try {
        if (item.productType === 'apparel') {
          const ap = await req.payload.findByID({
            collection: 'apparel',
            id: item.recordId,
            depth: 0,
            select: { weight: true, active: true },
          })
          if (!ap) return respostaErro(req, 404, `Produto não encontrado (id: ${item.recordId}).`)
          pesoGramas = ap.weight ?? null
          ativo = ap.active !== false
        } else {
          const rec = await req.payload.findByID({
            collection: 'records',
            id: item.recordId,
            depth: 0,
            select: { weight: true, dimensions: true, active: true },
          })
          if (!rec) return respostaErro(req, 404, `Disco não encontrado (id: ${item.recordId}).`)
          pesoGramas = rec.weight ?? null
          dimensoes = rec.dimensions ?? null
          ativo = rec.active !== false
        }
      } catch {
        return respostaErro(req, 404, `Produto não encontrado (id: ${item.recordId}).`)
      }
      if (!ativo) {
        return respostaErro(req, 409, `Produto indisponível (id: ${item.recordId}).`)
      }
      itensPacote.push({ pesoGramas, dimensoes, quantidade: item.quantidade })
    }

    // ── 3. Lê a configuração de frete (defaults aplicados mesmo sem registro) ──
    const config = await req.payload.findGlobal({ slug: 'configuracoes-de-frete' })
    const caixa = {
      comprimento: config.caixaPadrao?.comprimento ?? 33,
      largura: config.caixaPadrao?.largura ?? 33,
      altura: config.caixaPadrao?.altura ?? 3,
    }
    const pesoPadraoItem = config.pesoPadraoItem ?? 350
    const acrescimoFrete = config.acrescimoFrete ?? 8
    const cepOrigem = (config.cepOrigem ?? '').replace(/\D/g, '')

    // ── 4. Monta o pacote consolidado ─────────────────────────────────────
    const pacote = montarPacote(itensPacote, caixa, pesoPadraoItem)

    // ── 5. Chama a calculadora da SuperFrete ──────────────────────────────
    const token = process.env.SUPERFRETE_TOKEN
    if (!token) {
      req.payload.logger.error('[frete] SUPERFRETE_TOKEN não configurado.')
      return respostaErro(req, 500, 'Serviço de frete indisponível no momento.')
    }

    const base =
      process.env.SUPERFRETE_ENV === 'production'
        ? 'https://api.superfrete.com'
        : 'https://sandbox.superfrete.com'

    let resp: Response
    try {
      resp = await fetch(`${base}/api/v0/calculator`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': `Elessar Records (${process.env.SUPERFRETE_USER_AGENT_EMAIL ?? ''})`,
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: { postal_code: cepOrigem },
          to: { postal_code: cepDestino },
          services: '1,2,17', // PAC, SEDEX e Mini Envios
          package: {
            height: pacote.altura,
            width: pacote.largura,
            length: pacote.comprimento,
            weight: pacote.weightKg,
          },
        }),
      })
    } catch (err) {
      req.payload.logger.error(
        `[frete] Falha ao contatar a SuperFrete: ${(err as Error).message}`,
      )
      return respostaErro(req, 502, 'Não foi possível calcular o frete agora. Tente novamente.')
    }

    if (!resp.ok) {
      // Loga status e corpo (nunca os headers, que carregam o token).
      const corpo = await resp.text().catch(() => '')
      req.payload.logger.error(`[frete] SuperFrete retornou ${resp.status}: ${corpo.slice(0, 500)}`)
      return respostaErro(req, 502, 'Não foi possível calcular o frete agora. Tente novamente.')
    }

    const dados: unknown = await resp.json().catch(() => null)
    if (!Array.isArray(dados)) {
      req.payload.logger.error('[frete] Resposta inesperada da SuperFrete (esperado um array).')
      return respostaErro(req, 502, 'Não foi possível calcular o frete agora. Tente novamente.')
    }

    // ── 6. Filtra e marca o preço (o preço bruto NUNCA sai daqui) ─────────
    const opcoes = (dados as OpcaoSuperFrete[])
      .map((o) => {
        if (!o || o.error != null) return null
        const precoBruto = Number(o.price)
        if (!Number.isFinite(precoBruto)) return null
        return {
          // id do serviço na SuperFrete (1=PAC, 2=SEDEX, 17=Mini Envios).
          // Necessário para emitir a etiqueta nas próximas fases.
          servicoId: o.id ?? null,
          nome: o.name ?? '',
          transportadora: o.company?.name ?? '',
          prazoDias: o.delivery_time ?? o.delivery_range?.max ?? null,
          preco: Number((precoBruto + acrescimoFrete).toFixed(2)),
        }
      })
      .filter((o): o is NonNullable<typeof o> => o !== null)

    return respostaJson(req, { opcoes })
  },
}
