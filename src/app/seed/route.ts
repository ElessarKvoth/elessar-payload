import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { runSeed } from '@/utils/seedHelpers'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export const GET = async () => {
  try {
    const payload = await getPayload({ config: configPromise })
    const counts = await runSeed(payload)
    return Response.json({ ok: true, seeded: counts })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
