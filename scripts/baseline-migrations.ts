/**
 * Baseline das migrations — roda UMA vez, e é idempotente.
 *
 * SITUAÇÃO QUE ISTO RESOLVE
 * As tabelas deste banco foram criadas pelo push automático do modo de
 * desenvolvimento, não por migrations. Por isso `payload_migrations` só tem a
 * linha `dev` (batch -1) e os 6 arquivos de `src/migrations/` aparecem como
 * "Ran: No". Se alguém rodasse `payload migrate` nesse estado, o Payload
 * começaria pela primeira migration e tentaria `CREATE TABLE "records"` numa
 * tabela que já existe — o comando morre e o deploy junto.
 *
 * O QUE ESTE SCRIPT FAZ
 * Registra as migrations existentes como JÁ APLICADAS, sem executar o SQL delas.
 * É o "baseline": a partir daqui `payload migrate` não tem nada pendente, e toda
 * mudança de schema nova passa a virar migration de verdade.
 *
 * Confirmado lendo o código do Payload:
 *   - migrate.js:18 compara por NOME (`existing.name === migration.name`), então
 *     basta a linha existir para a migration ser pulada.
 *   - getMigrations.js ignora batch -1, então a linha `dev` não atrapalha e não
 *     precisa ser apagada.
 *
 * Uso: npm run db:baseline
 */
import 'dotenv/config'
import { Client } from 'pg'

import { migrations } from '../src/migrations'
import { exigirConfirmacao } from './confirmarAlvo'

// Batch 1 para todas: `getMigrations` usa o maior batch como base, então a
// próxima migration de verdade entra como batch 2.
const BATCH_DO_BASELINE = 1

async function main(): Promise<void> {
  const alvo = await exigirConfirmacao(
    `registrar ${migrations.length} migrations como já aplicadas (não executa o SQL delas)`,
    'Nenhum dado é apagado: só são inseridas linhas de controle em payload_migrations.',
  )

  const client = new Client({
    connectionString: alvo.url,
    ssl: alvo.local ? undefined : { rejectUnauthorized: false },
  })
  await client.connect()

  try {
    const { rows: existentes } = await client.query<{ name: string; batch: string | null }>(
      `SELECT name, batch FROM payload_migrations`,
    )
    const jaRegistradas = new Set(
      existentes.filter((r) => Number(r.batch) !== -1).map((r) => r.name),
    )

    console.log(`\nMigrations em src/migrations/: ${migrations.length}`)
    console.log(`Já registradas no banco:       ${jaRegistradas.size}\n`)

    let inseridas = 0
    for (const migration of migrations) {
      if (jaRegistradas.has(migration.name)) {
        console.log(`  · já registrada  ${migration.name}`)
        continue
      }
      await client.query(`INSERT INTO payload_migrations (name, batch) VALUES ($1, $2)`, [
        migration.name,
        BATCH_DO_BASELINE,
      ])
      console.log(`  ✓ registrada     ${migration.name}`)
      inseridas++
    }

    console.log(
      inseridas === 0
        ? '\nNada a fazer — o baseline já estava feito.\n'
        : `\n✓ ${inseridas} migration(s) registrada(s). Nenhum SQL de schema foi executado.\n` +
            '  Confira com: npx payload migrate:status (tudo deve aparecer como "Yes")\n',
    )
  } finally {
    await client.end()
  }
}

main().catch((err: unknown) => {
  console.error('\n✗ Falhou:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
