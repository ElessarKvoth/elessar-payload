import type { PayloadRequest } from 'payload'

/**
 * Limite de requisições por IP, em memória.
 *
 * LIMITAÇÃO CONHECIDA: o estado vive no processo. Em serverless (Vercel) cada
 * instância tem o seu, então o teto real é `limite × instâncias ativas`. Isso
 * não protege contra um ataque distribuído — protege contra o caso que
 * importa aqui: um script simples drenando a cota PAGA da SuperFrete.
 * Se um dia precisar de garantia real, trocar por Redis/Upstash mantendo
 * esta mesma assinatura.
 */

interface Janela {
  contagem: number
  reiniciaEm: number
}

const janelas = new Map<string, Janela>()

// Evita crescer sem limite se o processo viver muito: a cada limpeza,
// descarta as janelas já expiradas.
const LIMPEZA_A_CADA = 500
let desdeALimpeza = 0

function limparExpiradas(agora: number): void {
  for (const [chave, janela] of janelas) {
    if (janela.reiniciaEm <= agora) janelas.delete(chave)
  }
}

/** IP do cliente atrás do proxy da Vercel; cai para 'desconhecido' se ausente. */
export function ipDoRequest(req: PayloadRequest): string {
  const encaminhado = req.headers.get('x-forwarded-for') ?? ''
  const primeiro = encaminhado.split(',')[0]?.trim()
  return primeiro || req.headers.get('x-real-ip') || 'desconhecido'
}

export interface ResultadoLimite {
  permitido: boolean
  /** Segundos até a janela reiniciar — vai no header Retry-After. */
  esperarSegundos: number
}

/**
 * Consome uma unidade da cota de `chave`. Janela fixa.
 *
 * @param chave   identificador do consumidor (ex: `frete:${ip}`)
 * @param limite  requisições permitidas por janela
 * @param janelaMs duração da janela
 */
export function consumir(chave: string, limite: number, janelaMs: number): ResultadoLimite {
  const agora = Date.now()

  if (++desdeALimpeza >= LIMPEZA_A_CADA) {
    desdeALimpeza = 0
    limparExpiradas(agora)
  }

  const atual = janelas.get(chave)

  if (!atual || atual.reiniciaEm <= agora) {
    janelas.set(chave, { contagem: 1, reiniciaEm: agora + janelaMs })
    return { permitido: true, esperarSegundos: 0 }
  }

  atual.contagem += 1

  if (atual.contagem > limite) {
    return {
      permitido: false,
      esperarSegundos: Math.max(1, Math.ceil((atual.reiniciaEm - agora) / 1000)),
    }
  }

  return { permitido: true, esperarSegundos: 0 }
}
