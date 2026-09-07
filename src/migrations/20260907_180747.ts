import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// A migration gerada automaticamente adicionava `ano_de_formacao` e apagava
// `founded_at` na sequência, SEM copiar o valor de uma coluna para a outra.
// Como o banco já tinha artista cadastrado com data de formação preenchida
// (2016-01-01), aplicar assim perderia o ano em silêncio — o campo apareceria
// vazio no painel e ninguém saberia dizer se estava assim desde sempre.
//
// O `UPDATE` no meio é a correção: extrai o ano antes de a coluna sumir.
// Fixado em UTC de propósito, para o resultado não depender do fuso da sessão
// que rodar a migration (um 01/01 à meia-noite UTC vira 31/12 do ano anterior
// em São Paulo).

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "artists" ADD COLUMN "ano_de_formacao" numeric;
  UPDATE "artists" SET "ano_de_formacao" = EXTRACT(YEAR FROM "founded_at" AT TIME ZONE 'UTC') WHERE "founded_at" IS NOT NULL;
  ALTER TABLE "artists" DROP COLUMN "founded_at";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // A volta é aproximada e não tem como não ser: o ano não guarda mês e dia.
  // Restaura como 1º de janeiro do ano gravado, que é o mesmo critério que o
  // painel usava para exibir só o ano.
  await db.execute(sql`
   ALTER TABLE "artists" ADD COLUMN "founded_at" timestamp(3) with time zone;
  UPDATE "artists" SET "founded_at" = make_timestamptz("ano_de_formacao"::int, 1, 1, 0, 0, 0, 'UTC') WHERE "ano_de_formacao" IS NOT NULL;
  ALTER TABLE "artists" DROP COLUMN "ano_de_formacao";`)
}
