import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Devolve o campo "Destaque" ao disco.
 *
 * POR QUE ELE SUMIU. A coluna existia desde a primeira migration e foi
 * derrubada em `20260520_010721` (`ALTER TABLE "records" DROP COLUMN IF EXISTS
 * "featured"`), junto de outras limpezas. O storefront, porém, nunca deixou de
 * consultá-la: `getFeaturedRecords()` filtra por `featured = true`, e o Payload
 * responde HTTP 400 a filtro em campo que não existe. Como o front engole o
 * erro (`if (!res.ok) return []`), a prateleira "Em destaque" do catálogo
 * simplesmente nunca aparecia, e `/catalogo?featured=true` caía em "Nenhum
 * produto encontrado" — sem erro em tela, console ou log.
 *
 * Isto NÃO é o mesmo que os três discos da Página Inicial. Aqueles saem de uma
 * lista escolhida à mão no global `homepage` (`featuredRecords`) e sempre
 * funcionaram. Este campo é a marcação por disco, igual à que o vestuário já
 * tem, e é ela que alimenta a prateleira do catálogo.
 *
 * ADITIVA E SEGURA:
 *  • acrescenta UMA coluna; nada é renomeado, removido ou reescrito;
 *  • nasce com DEFAULT false, então todo disco do acervo continua exatamente
 *    como está — nenhum vira destaque por acidente;
 *  • nenhuma linha é tocada: o DEFAULT responde pelas que já existem.
 *
 * O `down` remove a coluna e, com ela, as marcações de destaque. O acervo em si
 * não é afetado.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "records" ADD COLUMN IF NOT EXISTS "featured" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "records" DROP COLUMN IF EXISTS "featured";
  `)
}
