import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Etiquetas do disco: as digitadas à mão e a escolhida para o card.
 *
 * O gerente quer (1) escrever etiquetas livres — "Gatefold branco", "Capa
 * dura" — além das situações fixas, e (2) escolher qual delas aparece no card
 * da loja; a página do produto mostra todas.
 *
 *  • `records.etiqueta_do_card` — qual etiqueta vai no card. Nula = automático,
 *    exatamente o comportamento de antes.
 *  • `records_texts` — onde o Payload guarda campo de texto com vários valores
 *    (`type: 'text', hasMany: true`). Estrutura copiada do que o adapter gera
 *    (`@payloadcms/drizzle/dist/schema/build.js`, bloco `hasManyTextField`):
 *    uma linha por etiqueta, ligada ao disco por `parent_id`, com `path` dizendo
 *    de qual campo ela é.
 *
 * ADITIVA E SEGURA:
 *  • uma coluna NULA e uma tabela NOVA; nada é renomeado, removido ou reescrito;
 *  • nenhum disco do acervo é tocado — todos continuam no automático e sem
 *    etiqueta personalizada até o gerente escolher.
 *
 * ORDEM: rodar ANTES do deploy do backend. O código novo lê `records_texts` em
 * toda consulta de disco; sem a tabela, a loja inteira para de listar discos.
 *
 * O `down` remove a tabela e a coluna — e com elas as etiquetas digitadas. O
 * acervo em si não é afetado.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "records" ADD COLUMN IF NOT EXISTS "etiqueta_do_card" varchar;
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "records_texts" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "text" varchar
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "records_texts"
        ADD CONSTRAINT "records_texts_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."records"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "records_texts_order_parent"
      ON "records_texts" USING btree ("order", "parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "records_texts" CASCADE;`)
  await db.execute(sql`ALTER TABLE "records" DROP COLUMN IF EXISTS "etiqueta_do_card";`)
}
