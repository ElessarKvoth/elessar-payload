import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "verificacao_expira_em" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "verificacao_ultimo_envio_em" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "verificacao_token_usado_hash" varchar;
  CREATE INDEX "users_verificacao_token_usado_hash_idx" ON "users" USING btree ("verificacao_token_usado_hash");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "users_verificacao_token_usado_hash_idx";
  ALTER TABLE "users" DROP COLUMN "verificacao_expira_em";
  ALTER TABLE "users" DROP COLUMN "verificacao_ultimo_envio_em";
  ALTER TABLE "users" DROP COLUMN "verificacao_token_usado_hash";`)
}
