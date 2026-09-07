import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "artists" ADD COLUMN "ano_de_formacao" numeric;
  ALTER TABLE "artists" DROP COLUMN "founded_at";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "artists" ADD COLUMN "founded_at" timestamp(3) with time zone;
  ALTER TABLE "artists" DROP COLUMN "ano_de_formacao";`)
}
