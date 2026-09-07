import type { Endpoint, PayloadRequest } from 'payload'
import { addDataAndFileToRequest, headersWithCors } from 'payload'

import { consumir, ipDoRequest } from '../utils/rateLimit'
import { enviarEmailTransacional } from '../utils/enviarEmail'
import { emailDeVerificacao, PRAZO_VERIFICACAO_MS } from '../utils/emailVerificacao'
import { gerarToken } from '../utils/tokens'

/**
 * POST /api/conta/reenviar-verificacao   { email }
 *
 * A saída do beco sem saída: quem não confirmou o e-mail não consegue logar
 * (o Payload recusa com 401), então também não conseguiria pedir um novo link
 * de dentro da conta. Sem este endpoint, perder o primeiro e-mail significava
 * perder a conta — só um administrador mexendo no banco resolvia.
 *
 * RESPOSTA SEMPRE IGUAL, aconteça o que acontecer: conta inexistente, conta já
 * confirmada, reenvio bloqueado pelo limite ou e-mail realmente enviado, tudo
 * devolve o mesmo 200. Se a resposta variasse, este endereço viraria uma
 * ferramenta para descobrir quem tem conta na loja — bastaria um laço com uma
 * lista de e-mails para separar clientes de não-clientes.
 */

// Por IP: seguro para uso humano (pedir de novo, trocar de aba), apertado para
// script. O estado é por processo — em serverless o teto real é este número
// vezes o de instâncias ativas (ver o comentário em utils/rateLimit.ts).
const REENVIOS_POR_IP = 5
const JANELA_IP_MS = 60 * 60_000

// Por conta, em memória: teto por hora.
const REENVIOS_POR_CONTA = 5
const JANELA_CONTA_MS = 60 * 60_000

// Por conta, no banco: intervalo mínimo entre dois envios. Diferente do limite
// acima, este sobrevive a reinício e vale entre instâncias — é o que de fato
// impede usar a caixa de entrada de alguém como alvo de flood.
const INTERVALO_MINIMO_MS = 60_000

interface ContaCrua {
  id: number | string
  email: string
  name?: string | null
  _verified?: boolean | null
  verificacaoUltimoEnvioEm?: string | null
}

export const reenviarVerificacao: Endpoint = {
  path: '/conta/reenviar-verificacao',
  method: 'post',
  handler: async (req) => {
    const cors = (headers: Headers = new Headers()): Headers => headersWithCors({ headers, req })

    // A ÚNICA resposta de sucesso. Uma função só, para não existir a chance de
    // um caminho responder diferente do outro e vazar a existência da conta.
    const respostaGenerica = (): Response =>
      Response.json(
        {
          estado: 'enviado',
          mensagem:
            'Se este e-mail estiver cadastrado e ainda não confirmado, enviamos um novo link. ' +
            'Confira sua caixa de entrada e o spam.',
        },
        { status: 200, headers: cors() },
      )

    const limiteIp = consumir(`reenvio-ip:${ipDoRequest(req)}`, REENVIOS_POR_IP, JANELA_IP_MS)
    if (!limiteIp.permitido) {
      return Response.json(
        {
          estado: 'muitas_tentativas',
          mensagem: 'Você pediu muitos reenvios seguidos. Tente de novo mais tarde.',
        },
        { status: 429, headers: cors(new Headers({ 'Retry-After': String(limiteIp.esperarSegundos) })) },
      )
    }

    await addDataAndFileToRequest(req)
    const body = (req.data ?? {}) as { email?: unknown }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    // Formato inválido é o único 400: não diz nada sobre a base de clientes.
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return Response.json(
        { estado: 'email_invalido', mensagem: 'Informe um e-mail válido.' },
        { status: 400, headers: cors() },
      )
    }

    const conta = (await req.payload.db.findOne({
      collection: 'users',
      where: { email: { equals: email } },
      req: req as PayloadRequest,
    })) as ContaCrua | null

    // Daqui para baixo, TODA saída é a resposta genérica.
    if (!conta || conta._verified) return respostaGenerica()

    const ultimoEnvio = conta.verificacaoUltimoEnvioEm
      ? new Date(conta.verificacaoUltimoEnvioEm).getTime()
      : 0
    if (Date.now() - ultimoEnvio < INTERVALO_MINIMO_MS) {
      req.payload.logger.info(`[conta] reenvio recusado pelo intervalo mínimo (id ${conta.id})`)
      return respostaGenerica()
    }

    const limiteConta = consumir(`reenvio-conta:${conta.id}`, REENVIOS_POR_CONTA, JANELA_CONTA_MS)
    if (!limiteConta.permitido) {
      req.payload.logger.info(`[conta] reenvio recusado pelo teto por hora (id ${conta.id})`)
      return respostaGenerica()
    }

    // Token novo invalida o anterior: o link antigo para de funcionar assim que
    // este é gravado. Dois links válidos ao mesmo tempo dobrariam a janela de
    // exposição sem nenhum ganho para o cliente.
    const token = gerarToken()

    await req.payload.db.updateOne({
      collection: 'users',
      id: conta.id,
      data: {
        _verificationToken: token,
        verificacaoExpiraEm: new Date(Date.now() + PRAZO_VERIFICACAO_MS).toISOString(),
        verificacaoUltimoEnvioEm: new Date().toISOString(),
      },
      req: req as PayloadRequest,
      returning: false,
    })

    const { assunto, html } = emailDeVerificacao({ nome: conta.name, token, reenvio: true })

    // Falha de e-mail NÃO derruba a resposta: o token já está gravado e o
    // cliente pode pedir de novo. O log é que registra o problema.
    const envio = await enviarEmailTransacional({
      payload: req.payload,
      tipo: 'reenvio-verificacao',
      para: conta.email,
      assunto,
      html,
    })

    if (!envio.enviado) {
      req.payload.logger.error(`[conta] reenvio de confirmação falhou (id ${conta.id}): ${envio.erro}`)
    }

    return respostaGenerica()
  },
}
