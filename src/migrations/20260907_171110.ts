import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "pagina_sobre_nos_secoes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"titulo" varchar NOT NULL,
  	"texto" jsonb NOT NULL,
  	"imagem_id" integer
  );
  
  CREATE TABLE "pagina_sobre_nos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"titulo" varchar DEFAULT 'Sobre a Loja' NOT NULL,
  	"chamada" varchar,
  	"texto" jsonb,
  	"imagem_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "paginas_legais" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"como_comprar_titulo" varchar DEFAULT 'Como comprar' NOT NULL,
  	"como_comprar_texto" jsonb,
  	"como_comprar_atualizado_em" timestamp(3) with time zone,
  	"entrega_titulo" varchar DEFAULT 'Entrega e frete' NOT NULL,
  	"entrega_texto" jsonb,
  	"entrega_atualizado_em" timestamp(3) with time zone,
  	"trocas_titulo" varchar DEFAULT 'Trocas e devoluções' NOT NULL,
  	"trocas_texto" jsonb,
  	"trocas_atualizado_em" timestamp(3) with time zone,
  	"privacidade_titulo" varchar DEFAULT 'Política de Privacidade' NOT NULL,
  	"privacidade_texto" jsonb,
  	"privacidade_atualizado_em" timestamp(3) with time zone,
  	"termos_titulo" varchar DEFAULT 'Termos de Uso' NOT NULL,
  	"termos_texto" jsonb,
  	"termos_atualizado_em" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "perguntas_frequentes_perguntas" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"pergunta" varchar NOT NULL,
  	"resposta" jsonb NOT NULL
  );
  
  CREATE TABLE "perguntas_frequentes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"titulo" varchar DEFAULT 'Perguntas Frequentes' NOT NULL,
  	"introducao" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "pagina_sobre_nos_secoes" ADD CONSTRAINT "pagina_sobre_nos_secoes_imagem_id_media_id_fk" FOREIGN KEY ("imagem_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pagina_sobre_nos_secoes" ADD CONSTRAINT "pagina_sobre_nos_secoes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pagina_sobre_nos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pagina_sobre_nos" ADD CONSTRAINT "pagina_sobre_nos_imagem_id_media_id_fk" FOREIGN KEY ("imagem_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "perguntas_frequentes_perguntas" ADD CONSTRAINT "perguntas_frequentes_perguntas_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."perguntas_frequentes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pagina_sobre_nos_secoes_order_idx" ON "pagina_sobre_nos_secoes" USING btree ("_order");
  CREATE INDEX "pagina_sobre_nos_secoes_parent_id_idx" ON "pagina_sobre_nos_secoes" USING btree ("_parent_id");
  CREATE INDEX "pagina_sobre_nos_secoes_imagem_idx" ON "pagina_sobre_nos_secoes" USING btree ("imagem_id");
  CREATE INDEX "pagina_sobre_nos_imagem_idx" ON "pagina_sobre_nos" USING btree ("imagem_id");
  CREATE INDEX "perguntas_frequentes_perguntas_order_idx" ON "perguntas_frequentes_perguntas" USING btree ("_order");
  CREATE INDEX "perguntas_frequentes_perguntas_parent_id_idx" ON "perguntas_frequentes_perguntas" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "pagina_sobre_nos_secoes" CASCADE;
  DROP TABLE "pagina_sobre_nos" CASCADE;
  DROP TABLE "paginas_legais" CASCADE;
  DROP TABLE "perguntas_frequentes_perguntas" CASCADE;
  DROP TABLE "perguntas_frequentes" CASCADE;`)
}
