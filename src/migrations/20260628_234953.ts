import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_orders_status_etiqueta" AS ENUM('a_emitir', 'emitida', 'erro');
  CREATE TABLE "configuracoes_de_frete" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"cep_origem" varchar DEFAULT '13084551' NOT NULL,
  	"acrescimo_frete" numeric DEFAULT 8 NOT NULL,
  	"caixa_padrao_comprimento" numeric DEFAULT 33,
  	"caixa_padrao_largura" numeric DEFAULT 33,
  	"caixa_padrao_altura" numeric DEFAULT 3,
  	"peso_padrao_item" numeric DEFAULT 350,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'aguardando_pagamento'::text;
  DROP TYPE "public"."enum_orders_status";
  CREATE TYPE "public"."enum_orders_status" AS ENUM('aguardando_pagamento', 'pago', 'etiqueta_criada', 'enviado', 'entregue', 'cancelado', 'reembolsado');
  ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'aguardando_pagamento'::"public"."enum_orders_status";
  ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."enum_orders_status" USING "status"::"public"."enum_orders_status";
  DROP INDEX "users_cpf_idx";
  ALTER TABLE "users_addresses" ALTER COLUMN "street" DROP NOT NULL;
  ALTER TABLE "users_addresses" ALTER COLUMN "number" DROP NOT NULL;
  ALTER TABLE "users_addresses" ALTER COLUMN "neighborhood" DROP NOT NULL;
  ALTER TABLE "users_addresses" ALTER COLUMN "city" DROP NOT NULL;
  ALTER TABLE "users_addresses" ALTER COLUMN "state" DROP NOT NULL;
  ALTER TABLE "users_addresses" ALTER COLUMN "zip_code" DROP NOT NULL;
  ALTER TABLE "users" ALTER COLUMN "cpf" DROP NOT NULL;
  ALTER TABLE "users" ALTER COLUMN "birth_date" DROP NOT NULL;
  ALTER TABLE "users" ALTER COLUMN "role" DROP NOT NULL;
  ALTER TABLE "orders" ADD COLUMN "frete_escolhido_servico_id" numeric;
  ALTER TABLE "orders" ADD COLUMN "frete_escolhido_transportadora" varchar;
  ALTER TABLE "orders" ADD COLUMN "frete_escolhido_nome" varchar;
  ALTER TABLE "orders" ADD COLUMN "frete_escolhido_prazo" numeric;
  ALTER TABLE "orders" ADD COLUMN "frete_escolhido_preco" numeric;
  ALTER TABLE "orders" ADD COLUMN "id_pagamento_mercado_pago" varchar;
  ALTER TABLE "orders" ADD COLUMN "destinatario_nome" varchar;
  ALTER TABLE "orders" ADD COLUMN "destinatario_cpf" varchar;
  ALTER TABLE "orders" ADD COLUMN "destinatario_email" varchar;
  ALTER TABLE "orders" ADD COLUMN "destinatario_telefone" varchar;
  ALTER TABLE "orders" ADD COLUMN "destinatario_cep" varchar;
  ALTER TABLE "orders" ADD COLUMN "destinatario_rua" varchar;
  ALTER TABLE "orders" ADD COLUMN "destinatario_numero" varchar;
  ALTER TABLE "orders" ADD COLUMN "destinatario_complemento" varchar;
  ALTER TABLE "orders" ADD COLUMN "destinatario_bairro" varchar;
  ALTER TABLE "orders" ADD COLUMN "destinatario_cidade" varchar;
  ALTER TABLE "orders" ADD COLUMN "destinatario_uf" varchar;
  ALTER TABLE "orders" ADD COLUMN "id_etiqueta_super_frete" varchar;
  ALTER TABLE "orders" ADD COLUMN "status_etiqueta" "enum_orders_status_etiqueta";
  ALTER TABLE "orders" ADD COLUMN "erro_etiqueta" varchar;
  ALTER TABLE "orders" ADD COLUMN "codigo_rastreio" varchar;
  ALTER TABLE "users" DROP COLUMN "_verificationtoken";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "configuracoes_de_frete" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "configuracoes_de_frete" CASCADE;
  ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending'::text;
  DROP TYPE "public"."enum_orders_status";
  CREATE TYPE "public"."enum_orders_status" AS ENUM('pending', 'confirmed', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
  ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."enum_orders_status";
  ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."enum_orders_status" USING "status"::"public"."enum_orders_status";
  ALTER TABLE "users_addresses" ALTER COLUMN "street" SET NOT NULL;
  ALTER TABLE "users_addresses" ALTER COLUMN "number" SET NOT NULL;
  ALTER TABLE "users_addresses" ALTER COLUMN "neighborhood" SET NOT NULL;
  ALTER TABLE "users_addresses" ALTER COLUMN "city" SET NOT NULL;
  ALTER TABLE "users_addresses" ALTER COLUMN "state" SET NOT NULL;
  ALTER TABLE "users_addresses" ALTER COLUMN "zip_code" SET NOT NULL;
  ALTER TABLE "users" ALTER COLUMN "cpf" SET NOT NULL;
  ALTER TABLE "users" ALTER COLUMN "birth_date" SET NOT NULL;
  ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;
  ALTER TABLE "users" ADD COLUMN "_verificationtoken" varchar;
  CREATE UNIQUE INDEX "users_cpf_idx" ON "users" USING btree ("cpf");
  ALTER TABLE "orders" DROP COLUMN "frete_escolhido_servico_id";
  ALTER TABLE "orders" DROP COLUMN "frete_escolhido_transportadora";
  ALTER TABLE "orders" DROP COLUMN "frete_escolhido_nome";
  ALTER TABLE "orders" DROP COLUMN "frete_escolhido_prazo";
  ALTER TABLE "orders" DROP COLUMN "frete_escolhido_preco";
  ALTER TABLE "orders" DROP COLUMN "id_pagamento_mercado_pago";
  ALTER TABLE "orders" DROP COLUMN "destinatario_nome";
  ALTER TABLE "orders" DROP COLUMN "destinatario_cpf";
  ALTER TABLE "orders" DROP COLUMN "destinatario_email";
  ALTER TABLE "orders" DROP COLUMN "destinatario_telefone";
  ALTER TABLE "orders" DROP COLUMN "destinatario_cep";
  ALTER TABLE "orders" DROP COLUMN "destinatario_rua";
  ALTER TABLE "orders" DROP COLUMN "destinatario_numero";
  ALTER TABLE "orders" DROP COLUMN "destinatario_complemento";
  ALTER TABLE "orders" DROP COLUMN "destinatario_bairro";
  ALTER TABLE "orders" DROP COLUMN "destinatario_cidade";
  ALTER TABLE "orders" DROP COLUMN "destinatario_uf";
  ALTER TABLE "orders" DROP COLUMN "id_etiqueta_super_frete";
  ALTER TABLE "orders" DROP COLUMN "status_etiqueta";
  ALTER TABLE "orders" DROP COLUMN "erro_etiqueta";
  ALTER TABLE "orders" DROP COLUMN "codigo_rastreio";
  DROP TYPE "public"."enum_orders_status_etiqueta";`)
}
