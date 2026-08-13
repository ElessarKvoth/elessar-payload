import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { runSeed, runClear } from '../src/utils/seedHelpers'

// Só carregar o Payload já cria/atualiza o schema no banco (push).
const payload = await getPayload({ config })
const arg = process.argv[2]

if (arg === '--clear') {
  const counts = await runClear(payload)
  console.log('\n✅ Limpo:', counts, '\n')
} else if (arg === '--schema-only') {
  // Banco pronto e VAZIO: só as tabelas, nenhum dado fictício.
  // Use quando a loja vai ser cadastrada do zero pelo dono.
  console.log('\n✅ Schema criado. Banco vazio, sem dados de exemplo.')
  console.log('   Próximo passo: suba o admin (npm run dev) e acesse /admin —')
  console.log('   o primeiro usuário criado vira administrador automaticamente.\n')
} else {
  const counts = await runSeed(payload)
  console.log('\n✅ Seed concluído:', counts, '\n')
}

process.exit(0)
