import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "homepage_band_icons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"artist_id" integer NOT NULL
  );
  
  ALTER TABLE "users" ALTER COLUMN "cpf" SET NOT NULL;
  ALTER TABLE "banners" ADD COLUMN "image_mobile_id" integer;
  ALTER TABLE "media" ADD COLUMN "aviso_qualidade" varchar;
  ALTER TABLE "users" ADD COLUMN "_verificationtoken" varchar;
  ALTER TABLE "configuracoes_de_frete" ADD COLUMN "remetente_nome" varchar NOT NULL;
  ALTER TABLE "configuracoes_de_frete" ADD COLUMN "remetente_documento" varchar NOT NULL;
  ALTER TABLE "configuracoes_de_frete" ADD COLUMN "remetente_telefone" varchar NOT NULL;
  ALTER TABLE "configuracoes_de_frete" ADD COLUMN "remetente_email" varchar NOT NULL;
  ALTER TABLE "configuracoes_de_frete" ADD COLUMN "remetente_rua" varchar NOT NULL;
  ALTER TABLE "configuracoes_de_frete" ADD COLUMN "remetente_numero" varchar NOT NULL;
  ALTER TABLE "configuracoes_de_frete" ADD COLUMN "remetente_complemento" varchar;
  ALTER TABLE "configuracoes_de_frete" ADD COLUMN "remetente_bairro" varchar NOT NULL;
  ALTER TABLE "configuracoes_de_frete" ADD COLUMN "remetente_cidade" varchar NOT NULL;
  ALTER TABLE "configuracoes_de_frete" ADD COLUMN "remetente_uf" varchar NOT NULL;
  ALTER TABLE "homepage_band_icons" ADD CONSTRAINT "homepage_band_icons_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_band_icons" ADD CONSTRAINT "homepage_band_icons_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_band_icons" ADD CONSTRAINT "homepage_band_icons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "homepage_band_icons_order_idx" ON "homepage_band_icons" USING btree ("_order");
  CREATE INDEX "homepage_band_icons_parent_id_idx" ON "homepage_band_icons" USING btree ("_parent_id");
  CREATE INDEX "homepage_band_icons_image_idx" ON "homepage_band_icons" USING btree ("image_id");
  CREATE INDEX "homepage_band_icons_artist_idx" ON "homepage_band_icons" USING btree ("artist_id");
  ALTER TABLE "banners" ADD CONSTRAINT "banners_image_mobile_id_media_id_fk" FOREIGN KEY ("image_mobile_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "banners_image_mobile_idx" ON "banners" USING btree ("image_mobile_id");
  CREATE UNIQUE INDEX "users_cpf_idx" ON "users" USING btree ("cpf");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "homepage_band_icons" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "homepage_band_icons" CASCADE;
  ALTER TABLE "banners" DROP CONSTRAINT "banners_image_mobile_id_media_id_fk";
  
  DROP INDEX "banners_image_mobile_idx";
  DROP INDEX "users_cpf_idx";
  ALTER TABLE "users" ALTER COLUMN "cpf" DROP NOT NULL;
  ALTER TABLE "banners" DROP COLUMN "image_mobile_id";
  ALTER TABLE "media" DROP COLUMN "aviso_qualidade";
  ALTER TABLE "users" DROP COLUMN "_verificationtoken";
  ALTER TABLE "configuracoes_de_frete" DROP COLUMN "remetente_nome";
  ALTER TABLE "configuracoes_de_frete" DROP COLUMN "remetente_documento";
  ALTER TABLE "configuracoes_de_frete" DROP COLUMN "remetente_telefone";
  ALTER TABLE "configuracoes_de_frete" DROP COLUMN "remetente_email";
  ALTER TABLE "configuracoes_de_frete" DROP COLUMN "remetente_rua";
  ALTER TABLE "configuracoes_de_frete" DROP COLUMN "remetente_numero";
  ALTER TABLE "configuracoes_de_frete" DROP COLUMN "remetente_complemento";
  ALTER TABLE "configuracoes_de_frete" DROP COLUMN "remetente_bairro";
  ALTER TABLE "configuracoes_de_frete" DROP COLUMN "remetente_cidade";
  ALTER TABLE "configuracoes_de_frete" DROP COLUMN "remetente_uf";`)
}
