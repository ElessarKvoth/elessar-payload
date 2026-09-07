import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "aceitou_termos" boolean;
  ALTER TABLE "users" ADD COLUMN "versao_termos_aceita" varchar;
  ALTER TABLE "users" ADD COLUMN "data_hora_aceite" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "ip_do_aceite" varchar;
  ALTER TABLE "users" ADD COLUMN "hash_dos_termos_aceitos" varchar;
  ALTER TABLE "users" ADD COLUMN "aceitou_comunicacoes_marketing" boolean DEFAULT false;
  ALTER TABLE "paginas_legais" ADD COLUMN "versao_dos_termos" varchar DEFAULT '1.0';
  ALTER TABLE "paginas_legais" ADD COLUMN "cookies_titulo" varchar DEFAULT 'Política de Cookies' NOT NULL;
  ALTER TABLE "paginas_legais" ADD COLUMN "cookies_texto" jsonb;
  ALTER TABLE "paginas_legais" ADD COLUMN "cookies_atualizado_em" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN "aceitou_termos";
  ALTER TABLE "users" DROP COLUMN "versao_termos_aceita";
  ALTER TABLE "users" DROP COLUMN "data_hora_aceite";
  ALTER TABLE "users" DROP COLUMN "ip_do_aceite";
  ALTER TABLE "users" DROP COLUMN "hash_dos_termos_aceitos";
  ALTER TABLE "users" DROP COLUMN "aceitou_comunicacoes_marketing";
  ALTER TABLE "paginas_legais" DROP COLUMN "versao_dos_termos";
  ALTER TABLE "paginas_legais" DROP COLUMN "cookies_titulo";
  ALTER TABLE "paginas_legais" DROP COLUMN "cookies_texto";
  ALTER TABLE "paginas_legais" DROP COLUMN "cookies_atualizado_em";`)
}
