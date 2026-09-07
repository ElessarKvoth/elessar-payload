import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { runSeed } from '@/utils/seedHelpers'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export const GET = async () => {
  // Popula o banco com dados de demonstração, sem pedir login. Rodar isso em
  // produção mistura fixtures com o acervo real e é difícil de desfazer depois.
  // Mesma regra do /clear: livre em desenvolvimento, fechado em produção.
  if (process.env.NODE_ENV === 'production') {
    return new Response(null, { status: 404 })
  }

  try {
    const payload = await getPayload({ config: configPromise })
    const counts = await runSeed(payload)
    return Response.json({ ok: true, seeded: counts })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
