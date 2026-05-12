import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { runSeed, runClear } from '../src/utils/seedHelpers'

const payload = await getPayload({ config })
const arg = process.argv[2]

if (arg === '--clear') {
  const counts = await runClear(payload)
  console.log('\n✅ Limpo:', counts, '\n')
} else {
  const counts = await runSeed(payload)
  console.log('\n✅ Seed concluído:', counts, '\n')
}

process.exit(0)
