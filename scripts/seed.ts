import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { runSeed, runClear } from '../src/utils/seedHelpers'
import { exigirConfirmacao } from './confirmarAlvo'

const arg = process.argv[2]

// `--clear` apaga discos, vestuário, pedidos, imagens e artistas do banco que o
// DATABASE_URI apontar — que aqui é o de produção. Confirma antes de subir o
// Payload, para nem chegar perto do banco se a pessoa cancelar.
if (arg === '--clear') {
  await exigirConfirmacao('apagar discos, vestuário, pedidos, imagens, artistas e usuários não-admin')
}

// Só carregar o Payload já cria/atualiza o schema no banco (push).
const payload = await getPayload({ config })

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
