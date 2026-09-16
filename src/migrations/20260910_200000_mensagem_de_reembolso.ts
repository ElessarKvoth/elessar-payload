import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Mensagem pronta de solicitação de cancelamento/reembolso, editável na tela
 * "Botão de WhatsApp".
 *
 * É o texto que abre no WhatsApp quando o cliente pede cancelamento de um
 * pedido JÁ PAGO — caso que não pode ser resolvido por botão, porque envolve
 * estorno, devolução de estoque e, se já despachado, logística de volta.
 *
 * ADITIVA: uma coluna nova, nascendo NULL. Nulo significa "usa o texto padrão",
 * então nada muda de comportamento enquanto ninguém preencher no painel.
 *
 * Arquivo separado de propósito. As migrations anteriores já foram aplicadas, e
 * migration executada NÃO roda de novo — o Payload guarda o nome numa tabela de
 * controle e pula. Acrescentar um ALTER a um arquivo já aplicado deixa o código
 * esperando uma coluna que nunca chega ao banco; foi exatamente assim que a home
 * caiu em 10/09/2026. Mudança de schema depois de aplicar é sempre arquivo novo.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "whatsapp" ADD COLUMN IF NOT EXISTS "mensagem_de_reembolso" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "whatsapp" DROP COLUMN IF EXISTS "mensagem_de_reembolso";
  `)
}
