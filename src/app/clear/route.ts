import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { runClear } from '@/utils/seedHelpers'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export const GET = async () => {
  try {
    const payload = await getPayload({ config: configPromise })
    const counts = await runClear(payload)
    return Response.json({ ok: true, cleared: counts })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
