import 'dotenv/config'
import { Pool } from 'pg'

// Zera o banco SEM subir o Payload (evita o push de schema que está crashando).
// Apaga TODAS as tabelas/enums do schema public e recria vazio.
// Depois rode `npm run seed` para recriar o schema novo e popular.

const connectionString =
  process.env.DATABASE_URI || process.env.DATABASE_URL || process.env.POSTGRES_URL || ''

if (!connectionString) {
  console.error('❌ DATABASE_URI não encontrada no .env.')
  process.exit(1)
}

const isLocal = /localhost|127\.0\.0\.1/.test(connectionString)
const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
})

try {
  // Mostra só host + nome do banco (nunca usuário/senha) para você confirmar o alvo.
  const u = new URL(connectionString)
  console.log(`⚠️  Zerando o banco: ${u.host}${u.pathname}`)

  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')

  console.log('✅ Schema "public" recriado vazio. Agora rode: npm run seed')
} catch (err) {
  console.error('❌ Falha ao zerar o banco:', (err as Error).message)
  process.exit(1)
} finally {
  await pool.end()
}

process.exit(0)
