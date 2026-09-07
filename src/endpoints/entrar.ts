import type { Endpoint, PayloadRequest } from 'payload'
import { addDataAndFileToRequest, headersWithCors, LockedAuth, UnverifiedEmail } from 'payload'

import { consumir, ipDoRequest } from '../utils/rateLimit'
import { precisaAceitarNovosTermos, termosVigentes } from '../utils/termos'

/**
 * POST /api/conta/entrar   { email, password }
 *
 * Login com ESTADO NOMEADO, envolvendo o `payload.login` nativo.
 *
 * Existe porque o endpoint nativo devolve os três motivos de recusa em prosa
 * inglesa, e dois deles compartilham o mesmo código HTTP:
 *
 *   403  "Please verify your email before logging in."
 *   401  "This user is locked due to having too many failed login attempts."
 *   401  "The email or password provided is incorrect."
 *
 * O storefront precisa dos três separados — o de e-mail não confirmado tem que
 * abrir o botão de reenvio, e o de conta travada tem que explicar a espera de
 * 10 minutos. Fazer o front decidir por `.includes('locked')` seria pendurar o
 * comportamento numa string em inglês que o Payload pode reescrever a qualquer
 * atualização, sem erro de compilação e sem teste quebrando.
 *
 * Aqui a distinção usa `instanceof` nas classes de erro que o Payload exporta,
 * então nenhuma string entra na lógica.
 */

// Tentativas de senha são o alvo clássico de força bruta. O Payload já trava a
// conta em 5 erros, mas isso protege UMA conta: nada impede varrer muitas
// contas com uma senha comum em cada. O teto por IP fecha essa porta.
const TENTATIVAS_POR_IP = 10
const JANELA_MS = 60_000

type Estado =
  | 'sucesso'
  | 'email_nao_confirmado'
  | 'conta_travada'
  | 'credenciais_invalidas'
  | 'muitas_tentativas'

export const entrar: Endpoint = {
  path: '/conta/entrar',
  method: 'post',
  handler: async (req) => {
    const responder = (estado: Estado, status: number, extra: Record<string, unknown> = {}): Response =>
      Response.json(
        { estado, ...extra },
        { status, headers: headersWithCors({ headers: new Headers(), req }) },
      )

    const limite = consumir(`entrar:${ipDoRequest(req)}`, TENTATIVAS_POR_IP, JANELA_MS)
    if (!limite.permitido) {
      return Response.json(
        {
          estado: 'muitas_tentativas',
          mensagem: 'Muitas tentativas de entrada. Aguarde um minuto e tente de novo.',
        },
        {
          status: 429,
          headers: headersWithCors({
            headers: new Headers({ 'Retry-After': String(limite.esperarSegundos) }),
            req,
          }),
        },
      )
    }

    await addDataAndFileToRequest(req)
    const body = (req.data ?? {}) as { email?: unknown; password?: unknown }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || !password) {
      return responder('credenciais_invalidas', 400, {
        mensagem: 'Informe seu e-mail e sua senha.',
      })
    }

    try {
      const resultado = await req.payload.login({
        collection: 'users',
        data: { email, password },
        req: req as PayloadRequest,
      })

      // Se o gerente publicou uma versão nova das regras, o storefront pede o
      // novo aceite. Não bloqueamos a entrada por isso de propósito: trancar
      // alguém para fora da própria conta por causa de uma vírgula alterada
      // nos termos seria desproporcional.
      const vigentes = await termosVigentes(req.payload, req as PayloadRequest)
      const pendente = precisaAceitarNovosTermos(
        resultado.user as { aceitouTermos?: boolean | null; versaoTermosAceita?: string | null },
        vigentes.versao,
      )

      return responder('sucesso', 200, {
        token: resultado.token,
        exp: resultado.exp,
        user: resultado.user,
        precisaAceitarNovosTermos: pendente,
        versaoDosTermosVigente: vigentes.versao,
      })
    } catch (err) {
      // Distinção por CLASSE, não por texto: as três classes são exportadas
      // pelo `payload`, então isto quebra em tempo de compilação se mudarem.
      if (err instanceof UnverifiedEmail) {
        return responder('email_nao_confirmado', 403, {
          mensagem:
            'Confirme seu e-mail antes de entrar. Se não recebeu o link, podemos enviar outro.',
          // Sinaliza ao front que vale mostrar o botão de reenvio.
          podeReenviarConfirmacao: true,
        })
      }

      if (err instanceof LockedAuth) {
        return responder('conta_travada', 423, {
          mensagem:
            'Sua conta está temporariamente bloqueada por tentativas de senha erradas. ' +
            'Aguarde 10 minutos antes de tentar de novo — durante o bloqueio, mesmo a senha ' +
            'certa é recusada.',
        })
      }

      // Qualquer outra falha vira credencial inválida. Nunca diga "este e-mail
      // não existe": isso transforma o login numa forma de descobrir quem é
      // cliente da loja.
      return responder('credenciais_invalidas', 401, {
        mensagem: 'E-mail ou senha incorretos.',
      })
    }
  },
}
