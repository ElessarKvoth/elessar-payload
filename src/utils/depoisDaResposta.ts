import { after } from 'next/server'
import type { Payload } from 'payload'

/**
 * Agenda uma tarefa para DEPOIS que a resposta da requisição sair.
 *
 * Os hooks de `Orders` rodam dentro da transação — inclusive a da confirmação
 * de pagamento, que segura a linha do pedido travada. Mandar e-mail ali tinha
 * dois problemas: segurava a trava enquanto falava com o provedor, e se a
 * transação fosse desfeita depois o cliente já teria recebido "pagamento
 * confirmado" de um pedido que não mudou.
 *
 * `after()` do Next roda quando a resposta já foi enviada — portanto depois do
 * commit — e a Vercel mantém a função viva até a tarefa terminar. Como ele
 * roda mesmo quando a requisição falha, quem agenda deve RELER o estado do
 * banco antes de enviar.
 *
 * Fora de uma requisição (scripts no terminal) `after` lança erro; aí a tarefa
 * roda na hora.
 */
export function depoisDaResposta(payload: Payload, rotulo: string, tarefa: () => Promise<void>): void {
  const segura = async (): Promise<void> => {
    try {
      await tarefa()
    } catch (err) {
      payload.logger.error(`[email] ${rotulo}: ${(err as Error).message}`)
    }
  }

  try {
    after(segura)
  } catch {
    void segura()
  }
}
