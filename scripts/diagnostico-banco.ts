/**
 * Diagnóstico do banco — SOMENTE LEITURA.
 *
 * Responde, sem alterar nada e sem imprimir credenciais:
 *   1. Para qual banco o DATABASE_URI aponta (só host e nome — nunca a senha).
 *   2. Se as migrations já foram registradas (`payload_migrations`).
 *   3. Se as colunas novas já existem (ou seja, se o push do dev já as criou).
 *   4. Se a migration nova vai falhar por causa dos `NOT NULL` sem padrão.
 *
 * Uso: npx tsx scripts/diagnostico-banco.ts
 */
import 'dotenv/config'
import { Client } from 'pg'

const conexao =
  process.env.DATABASE_URI || process.env.DATABASE_URL || process.env.POSTGRES_URL || ''

if (!conexao) {
  console.error('✗ Nenhuma variável de conexão encontrada (DATABASE_URI / DATABASE_URL / POSTGRES_URL).')
  process.exit(1)
}

/** Extrai só host e nome do banco. Usuário e senha nunca são impressos. */
function identificarBanco(url: string): { host: string; banco: string } {
  try {
    const u = new URL(url)
    return { host: u.hostname, banco: u.pathname.replace(/^\//, '') || '(padrão)' }
  } catch {
    return { host: '(não consegui interpretar a URL)', banco: '?' }
  }
}

async function main(): Promise<void> {
  const { host, banco } = identificarBanco(conexao)
  const local = /^(localhost|127\.0\.0\.1|::1)$/.test(host)

  console.log('\n═══ BANCO ═══')
  console.log(`  host:  ${host}`)
  console.log(`  banco: ${banco}`)
  console.log(`  → ${local ? 'LOCAL (na sua máquina)' : 'REMOTO (provavelmente o mesmo da Vercel)'}`)

  const client = new Client({
    connectionString: conexao,
    ssl: local ? undefined : { rejectUnauthorized: false },
  })
  await client.connect()

  // ── 1. Migrations registradas ────────────────────────────────────────────
  console.log('\n═══ MIGRATIONS REGISTRADAS ═══')
  const tabelaMigrations = await client.query(
    `SELECT to_regclass('public.payload_migrations') IS NOT NULL AS existe`,
  )
  if (!tabelaMigrations.rows[0].existe) {
    console.log('  tabela payload_migrations NÃO existe → banco nunca migrado')
  } else {
    const { rows } = await client.query(
      `SELECT name, batch FROM payload_migrations ORDER BY id`,
    )
    console.log(rows.length === 0 ? '  (vazia) → banco nunca migrado' : '')
    for (const r of rows) console.log(`  ✓ ${r.name} (batch ${r.batch})`)
  }

  // ── 2. As colunas da migration nova já existem? ───────────────────────────
  console.log('\n═══ COLUNAS DA MIGRATION NOVA ═══')
  const alvos: Array<[string, string]> = [
    ['media', 'aviso_qualidade'],
    ['banners', 'image_mobile_id'],
    ['configuracoes_de_frete', 'remetente_nome'],
    ['users', '_verificationtoken'],
  ]
  for (const [tabela, coluna] of alvos) {
    const { rows } = await client.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
      [tabela, coluna],
    )
    console.log(`  ${rows.length ? '✓ existe  ' : '✗ FALTANDO'}  ${tabela}.${coluna}`)
  }
  const tabelaIcons = await client.query(
    `SELECT to_regclass('public.homepage_band_icons') IS NOT NULL AS existe`,
  )
  console.log(`  ${tabelaIcons.rows[0].existe ? '✓ existe  ' : '✗ FALTANDO'}  homepage_band_icons (tabela)`)

  // ── 3. A migration nova vai falhar? ──────────────────────────────────────
  console.log('\n═══ RISCO DE FALHA DA MIGRATION ═══')

  const frete = await client.query(`SELECT count(*)::int AS n FROM configuracoes_de_frete`)
  const linhasFrete = frete.rows[0].n
  console.log(
    linhasFrete === 0
      ? '  ✓ configuracoes_de_frete vazia → os 9 NOT NULL passam sem problema'
      : `  ✗ configuracoes_de_frete tem ${linhasFrete} linha(s) → os 9 ADD COLUMN NOT NULL VÃO FALHAR`,
  )

  const temCpf = await client.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users' AND column_name='cpf'`,
  )
  if (temCpf.rows.length === 0) {
    console.log('  · coluna users.cpf ainda não existe')
  } else {
    const nulos = await client.query(`SELECT count(*)::int AS n FROM users WHERE cpf IS NULL`)
    const dup = await client.query(
      `SELECT count(*)::int AS n FROM (
         SELECT cpf FROM users WHERE cpf IS NOT NULL GROUP BY cpf HAVING count(*) > 1
       ) d`,
    )
    const total = await client.query(`SELECT count(*)::int AS n FROM users`)
    console.log(`  · users: ${total.rows[0].n} no total`)
    console.log(
      nulos.rows[0].n === 0
        ? '  ✓ nenhum usuário sem CPF → SET NOT NULL passa'
        : `  ✗ ${nulos.rows[0].n} usuário(s) sem CPF → "ALTER COLUMN cpf SET NOT NULL" VAI FALHAR`,
    )
    console.log(
      dup.rows[0].n === 0
        ? '  ✓ nenhum CPF repetido → o índice único passa'
        : `  ✗ ${dup.rows[0].n} CPF(s) repetido(s) → "CREATE UNIQUE INDEX users_cpf_idx" VAI FALHAR`,
    )
  }

  // ── 4. Volume de conteúdo já cadastrado ──────────────────────────────────
  console.log('\n═══ CONTEÚDO JÁ CADASTRADO ═══')
  for (const t of ['records', 'apparel', 'media', 'orders', 'artists', 'banners']) {
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM ${t}`)
    console.log(`  ${String(rows[0].n).padStart(5)}  ${t}`)
  }

  await client.end()
  console.log('\nNada foi alterado — todas as consultas acima são de leitura.\n')
}

main().catch((err: unknown) => {
  console.error('\n✗ Falhou:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
