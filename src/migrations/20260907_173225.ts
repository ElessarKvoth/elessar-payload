import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "configuracoes_gerais" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"nome_da_loja" varchar DEFAULT 'Elessar Records' NOT NULL,
  	"tagline" varchar,
  	"email_contato" varchar,
  	"telefone" varchar,
  	"endereco" varchar,
  	"horario_atendimento" varchar,
  	"instagram" varchar,
  	"youtube" varchar,
  	"facebook" varchar,
  	"razao_social" varchar,
  	"cnpj" varchar,
  	"aviso_ativo" boolean DEFAULT false,
  	"aviso_texto" varchar,
  	"aviso_link" varchar,
  	"aviso_valido_ate" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "whatsapp" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"ativo" boolean DEFAULT true,
  	"numero" varchar NOT NULL,
  	"mensagem_padrao" varchar DEFAULT 'Olá! Vim pelo site da Elessar Records.' NOT NULL,
  	"mensagem_no_produto" varchar DEFAULT 'Olá! Tenho uma dúvida sobre o produto {{produto}}.',
  	"texto_do_botao" varchar DEFAULT 'Fale conosco',
  	"horario_atendimento" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "rodape_colunas_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"texto" varchar NOT NULL,
  	"endereco" varchar NOT NULL
  );
  
  CREATE TABLE "rodape_colunas" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"titulo" varchar NOT NULL
  );
  
  CREATE TABLE "rodape" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"texto_copyright" varchar,
  	"formas_de_pagamento" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "rodape_colunas_links" ADD CONSTRAINT "rodape_colunas_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."rodape_colunas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rodape_colunas" ADD CONSTRAINT "rodape_colunas_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."rodape"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "rodape_colunas_links_order_idx" ON "rodape_colunas_links" USING btree ("_order");
  CREATE INDEX "rodape_colunas_links_parent_id_idx" ON "rodape_colunas_links" USING btree ("_parent_id");
  CREATE INDEX "rodape_colunas_order_idx" ON "rodape_colunas" USING btree ("_order");
  CREATE INDEX "rodape_colunas_parent_id_idx" ON "rodape_colunas" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "configuracoes_gerais" CASCADE;
  DROP TABLE "whatsapp" CASCADE;
  DROP TABLE "rodape_colunas_links" CASCADE;
  DROP TABLE "rodape_colunas" CASCADE;
  DROP TABLE "rodape" CASCADE;`)
}
