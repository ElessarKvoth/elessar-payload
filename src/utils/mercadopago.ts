import { MercadoPagoConfig } from 'mercadopago'

let client: MercadoPagoConfig | null = null

// Client único e lazy (só falha se realmente for usado sem o token configurado).
export function mercadoPagoClient(): MercadoPagoConfig {
  if (!client) {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!accessToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado.')
    client = new MercadoPagoConfig({ accessToken })
  }
  return client
}

// Primeira URL da lista (FRONTEND_URL aceita várias, separadas por vírgula).
export function frontendBaseUrl(): string {
  const first = (process.env.FRONTEND_URL ?? '').split(',').map((u) => u.trim()).filter(Boolean)[0]
  return first ?? 'http://localhost:3001'
}

export function paymentMethodFromTipo(paymentTypeId?: string | null): 'pix' | 'credit_card' | 'boleto' | 'other' {
  switch (paymentTypeId) {
    case 'credit_card':
      return 'credit_card'
    case 'bank_transfer':
      return 'pix'
    case 'ticket':
      return 'boleto'
    default:
      return 'other'
  }
}
