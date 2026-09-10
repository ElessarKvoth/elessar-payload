import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Tempo de troca do carrossel da home, em segundos, editável em "Página Inicial".
 *
 * Nasce NULL, e o site trata nulo como os 6 segundos que antes eram fixos no
 * código — o comportamento não muda enquanto ninguém preencher.
 *
 * POR QUE É UMA MIGRATION SEPARADA:
 * esta coluna chegou a ser escrita dentro de `20260910_000000_recorte_de_banner`,
 * DEPOIS que aquela migration já havia rodado. Migration executada não roda de
 * novo — o Payload guarda o nome numa tabela de controle e pula —, então o
 * `ALTER TABLE` nunca chegou ao banco, enquanto o código já esperava a coluna.
 * A home inteira parou, porque a consulta do global passou a pedir uma coluna
 * inexistente.
 *
 * A lição, que vale para a próxima: migration já aplicada é imutável. Mudança
 * de schema depois dela é sempre um arquivo novo, mesmo que o assunto seja o
 * mesmo e mesmo que a anterior tenha sido criada minutos antes.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "tempo_do_carrossel" numeric;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "homepage" DROP COLUMN IF EXISTS "tempo_do_carrossel";
  `)
}
