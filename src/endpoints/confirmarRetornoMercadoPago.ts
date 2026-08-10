import type { Endpoint, PayloadRequest } from 'payload'
import { addDataAndFileToRequest, headersWithCors } from 'payload'

import { confirmarPagamentoMercadoPago } from '../utils/confirmarPagamentoMercadoPago'

// Confirmação síncrona, disparada pelo FRONT quando o cliente volta do checkout
// do Mercado Pago (a URL de retorno traz o payment_id). Existe pra não depender
// só do webhook assíncrono — que pode atrasar ou, em ambientes de teste sem URL
// pública, nem ser alcançável. O webhook continua sendo a rede de segurança para
// quando o cliente fecha a aba antes de voltar ao site.
export const confirmarRetornoMercadoPago: Endpoint = {
  path: '/pedidos/confirmar-retorno',
  method: 'post',
  handler: async (req) => {
    const resp = (body: unknown, status = 200): Response =>
      Response.json(body, { status, headers: headersWithCors({ headers: new Headers(), req }) })

    if (!req.user) return resp({ erro: 'Não autenticado.' }, 401)

    await addDataAndFileToRequest(req)
    const body = (req.data ?? {}) as { paymentId?: unknown }
    const paymentId =
      typeof body.paymentId === 'string' || typeof body.paymentId === 'number' ? String(body.paymentId) : ''
    if (!paymentId) return resp({ erro: 'paymentId é obrigatório.' }, 400)

    const resultado = await confirmarPagamentoMercadoPago(req.payload, paymentId, req as PayloadRequest)
    if (!resultado.ok) return resp({ erro: resultado.erro ?? 'Não foi possível confirmar o pagamento.' }, 502)

    // O pagamento pode pertencer a um pedido de outro cliente (payment_id não é
    // segredo) — a atualização no banco já é segura (vem do MP), mas só devolvemos
    // os detalhes pro dono do pedido ou admin.
    const isAdmin = (req.user as { role?: string }).role === 'admin'
    if (!isAdmin && resultado.customerId !== req.user.id) return resp({ erro: 'Sem permissão.' }, 403)

    return resp({
      ok: true,
      status: resultado.status,
      statusEtiqueta: resultado.statusEtiqueta ?? null,
      erroEtiqueta: resultado.erroEtiqueta ?? null,
    })
  },
}
