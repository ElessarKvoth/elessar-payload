import type { PacoteConsolidado } from './freteCalculo'

// Uma opção retornada pela calculadora. Opções indisponíveis vêm com `error`
// e/ou sem `price` numérico válido.
export interface OpcaoCalculadora {
  id?: number
  name?: string
  price?: number | string
  error?: string
  delivery_time?: number
  delivery_range?: { min?: number; max?: number }
  company?: { name?: string }
}

export type ResultadoCalculadora =
  | { ok: true; opcoes: OpcaoCalculadora[] }
  | { ok: false; erro: string }

// Chama a calculadora da SuperFrete (POST /api/v0/calculator).
// Compartilhado entre o endpoint público /api/frete/cotar e a revalidação
// server-side do frete na criação de pedidos. Nunca loga/expõe o token.
export async function cotarSuperFrete(
  cepOrigem: string,
  cepDestino: string,
  pacote: PacoteConsolidado,
): Promise<ResultadoCalculadora> {
  const token = process.env.SUPERFRETE_TOKEN
  if (!token) return { ok: false, erro: 'SUPERFRETE_TOKEN não configurado.' }

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
    return { ok: false, erro: `Falha ao contatar a SuperFrete: ${(err as Error).message}` }
  }

  if (!resp.ok) {
    // Corpo sanitizado para log (nunca os headers, que carregam o token).
    const corpo = await resp.text().catch(() => '')
    return { ok: false, erro: `SuperFrete retornou ${resp.status}: ${corpo.slice(0, 500)}` }
  }

  const dados: unknown = await resp.json().catch(() => null)
  if (!Array.isArray(dados)) {
    return { ok: false, erro: 'Resposta inesperada da SuperFrete (esperado um array).' }
  }

  return { ok: true, opcoes: dados as OpcaoCalculadora[] }
}
