import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Destino do clique no banner — o banner inteiro vira um link.
 *
 * Antes disto só existia `link`, um texto que virava o href do botão "Explorar",
 * e o botão só era desenhado quando o banner tinha `title`. Quem sobe ARTE
 * PRONTA (imagem já com o texto desenhado) não preenche título nenhum — e ficava
 * com um banner que não levava a lugar nenhum.
 *
 * ADITIVA E SEGURA:
 *  • quatro colunas novas, todas nascendo NULL;
 *  • nenhuma coluna é removida, renomeada ou alterada — `link` e `link_label`
 *    continuam exatamente como estão, com o mesmo conteúdo;
 *  • as chaves estrangeiras são `ON DELETE set null`: apagar um disco que era
 *    destino de banner NÃO apaga o banner, só desfaz o destino.
 *
 * O BACKFILL no fim do `up()` escreve só na coluna `tipo_de_destino`, que acaba
 * de nascer — nenhuma linha do acervo é alterada. Ele existe para que os banners
 * já cadastrados continuem se comportando como hoje: quem tinha `link`
 * preenchido passa a ser do tipo "Outro endereço" com o mesmo endereço; o resto
 * fica "não leva a lugar nenhum", que é o que já acontecia na prática.
 *
 * Sem o backfill, `tipo_de_destino` ficaria NULL e o painel abriria o seletor
 * vazio num banner que tem link — parecendo campo perdido.
 *
 * ORDEM DE APLICAÇÃO: rodar ESTA migration antes de publicar o front novo. As
 * colunas são nulas e aditivas, então o site que está no ar hoje não sente a
 * presença delas; o contrário — código pedindo coluna que ainda não existe —
 * derruba a home inteira, como já aconteceu em
 * `20260910_100000_tempo_do_carrossel`.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_banners_tipo_de_destino" AS ENUM(
      'nada',
      'disco',
      'artista',
      'vestuario',
      'pagina_catalogo',
      'pagina_raridades',
      'pagina_vestuario',
      'pagina_artistas',
      'link'
    );

    ALTER TABLE "banners" ADD COLUMN "tipo_de_destino" "public"."enum_banners_tipo_de_destino";
    ALTER TABLE "banners" ADD COLUMN "destino_disco_id" integer;
    ALTER TABLE "banners" ADD COLUMN "destino_artista_id" integer;
    ALTER TABLE "banners" ADD COLUMN "destino_vestuario_id" integer;

    ALTER TABLE "banners" ADD CONSTRAINT "banners_destino_disco_id_records_id_fk"
      FOREIGN KEY ("destino_disco_id") REFERENCES "public"."records"("id")
      ON DELETE set null ON UPDATE no action;
    ALTER TABLE "banners" ADD CONSTRAINT "banners_destino_artista_id_artists_id_fk"
      FOREIGN KEY ("destino_artista_id") REFERENCES "public"."artists"("id")
      ON DELETE set null ON UPDATE no action;
    ALTER TABLE "banners" ADD CONSTRAINT "banners_destino_vestuario_id_apparel_id_fk"
      FOREIGN KEY ("destino_vestuario_id") REFERENCES "public"."apparel"("id")
      ON DELETE set null ON UPDATE no action;

    CREATE INDEX "banners_destino_disco_idx" ON "banners" USING btree ("destino_disco_id");
    CREATE INDEX "banners_destino_artista_idx" ON "banners" USING btree ("destino_artista_id");
    CREATE INDEX "banners_destino_vestuario_idx" ON "banners" USING btree ("destino_vestuario_id");
  `)

  // Backfill — preserva o comportamento atual dos banners já cadastrados.
  await db.execute(sql`
    UPDATE "banners" SET "tipo_de_destino" = 'link'
      WHERE "link" IS NOT NULL AND "link" <> '';
    UPDATE "banners" SET "tipo_de_destino" = 'nada'
      WHERE "tipo_de_destino" IS NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "banners_destino_disco_idx";
    DROP INDEX IF EXISTS "banners_destino_artista_idx";
    DROP INDEX IF EXISTS "banners_destino_vestuario_idx";

    ALTER TABLE "banners" DROP COLUMN IF EXISTS "tipo_de_destino";
    ALTER TABLE "banners" DROP COLUMN IF EXISTS "destino_disco_id";
    ALTER TABLE "banners" DROP COLUMN IF EXISTS "destino_artista_id";
    ALTER TABLE "banners" DROP COLUMN IF EXISTS "destino_vestuario_id";

    DROP TYPE IF EXISTS "public"."enum_banners_tipo_de_destino";
  `)
}
