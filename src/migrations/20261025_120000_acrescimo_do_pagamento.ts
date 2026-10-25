import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Taxa do cartão/boleto no pedido.
 *
 * O preço do site passou a ser o preço no Pix; cartão e boleto pagam 5% a mais
 * sobre produtos e frete (ver utils/acrescimoDePagamento.ts). A confirmação do
 * pagamento grava esse acréscimo aqui e soma no `total`, para o painel e o
 * e-mail mostrarem o que o cliente de fato pagou.
 *
 *  • `orders.acrescimo_pagamento` — centavos. DEFAULT 0: todo pedido que já
 *    existe fica com zero, que é exatamente o que ele pagou (antes não havia
 *    taxa). O `total` desses pedidos continua batendo com a validação.
 *
 * ADITIVA E SEGURA: uma coluna nova com default; nada é renomeado, removido ou
 * reescrito.
 *
 * ORDEM: rodar ANTES do deploy do backend. O código novo lê e grava a coluna
 * em todo pedido; sem ela, criar pedido e confirmar pagamento quebram.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "acrescimo_pagamento" numeric DEFAULT 0;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN IF EXISTS "acrescimo_pagamento";`)
}
