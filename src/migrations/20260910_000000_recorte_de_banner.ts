import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Recorte manual do banner, com proporção travada.
 *
 * Guarda a janela que o admin desenhou por cima da arte, em PORCENTAGEM do
 * original (`{ x, y, largura, altura }`). Uma coluna por contexto, porque as
 * duas artes têm proporções diferentes: o computador é 8:3 e o celular 4:5.
 *
 * ADITIVA E SEGURA:
 *  • só acrescenta duas colunas, nenhuma é renomeada ou removida;
 *  • as colunas nascem NULL, e nulo significa "sem recorte manual" — os
 *    banners que já existem continuam funcionando pelo ponto de foco, do jeito
 *    que estão hoje;
 *  • nada é reescrito, nenhuma linha é tocada.
 *
 * O `down` remove as duas colunas. Isso descarta os recortes gravados — e só
 * eles: as artes, os textos e o agendamento não são afetados.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "recorte_desktop" jsonb;
    ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "recorte_mobile" jsonb;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "banners" DROP COLUMN IF EXISTS "recorte_desktop";
    ALTER TABLE "banners" DROP COLUMN IF EXISTS "recorte_mobile";
  `)
}
