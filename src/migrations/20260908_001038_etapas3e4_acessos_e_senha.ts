import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "users_acessos_recentes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"data_hora" timestamp(3) with time zone,
  	"dispositivo" varchar,
  	"local" varchar,
  	"origem" varchar,
  	"aviso_enviado" boolean
  );
  
  CREATE TABLE "users_dispositivos_conhecidos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"impressao" varchar,
  	"descricao" varchar,
  	"avisado_em" timestamp(3) with time zone,
  	"ultimo_acesso_em" timestamp(3) with time zone
  );
  
  CREATE TABLE "seguranca_da_conta" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"avisar_novo_acesso" boolean DEFAULT true,
  	"dias_para_avisar_de_novo" numeric DEFAULT 30,
  	"quantos_acessos_guardar" numeric DEFAULT 10,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users_acessos_recentes" ADD CONSTRAINT "users_acessos_recentes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_dispositivos_conhecidos" ADD CONSTRAINT "users_dispositivos_conhecidos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_acessos_recentes_order_idx" ON "users_acessos_recentes" USING btree ("_order");
  CREATE INDEX "users_acessos_recentes_parent_id_idx" ON "users_acessos_recentes" USING btree ("_parent_id");
  CREATE INDEX "users_dispositivos_conhecidos_order_idx" ON "users_dispositivos_conhecidos" USING btree ("_order");
  CREATE INDEX "users_dispositivos_conhecidos_parent_id_idx" ON "users_dispositivos_conhecidos" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_acessos_recentes" CASCADE;
  DROP TABLE "users_dispositivos_conhecidos" CASCADE;
  DROP TABLE "seguranca_da_conta" CASCADE;`)
}
