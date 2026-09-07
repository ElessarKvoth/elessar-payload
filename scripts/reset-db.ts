import 'dotenv/config'
import { Pool } from 'pg'

import { exigirConfirmacao } from './confirmarAlvo'

// Zera o banco SEM subir o Payload (evita o push de schema que está crashando).
// Apaga TODAS as tabelas/enums do schema public e recria vazio.
// Depois rode `npm run seed` para recriar o schema novo e popular.

// Antes isto rodava direto: imprimia o alvo e já dropava o schema, sem esperar
// resposta. Como o DATABASE_URI aponta para o banco de produção, um comando
// errado no terminal apagava o acervo inteiro sem chance de cancelar.
const alvo = await exigirConfirmacao('apagar TODAS as tabelas (DROP SCHEMA public CASCADE)')

const pool = new Pool({
  connectionString: alvo.url,
  ssl: alvo.local ? false : { rejectUnauthorized: false },
})

try {
  console.log(`⚠️  Zerando o banco: ${alvo.host}/${alvo.banco}`)

  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')

  console.log('✅ Schema "public" recriado vazio. Agora rode: npm run seed')
} catch (err) {
  console.error('❌ Falha ao zerar o banco:', (err as Error).message)
  process.exit(1)
} finally {
  await pool.end()
}

process.exit(0)
