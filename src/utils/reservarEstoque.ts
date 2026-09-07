import { sql } from 'drizzle-orm'
import type { Payload, PayloadRequest } from 'payload'

/**
 * Reserva estoque de forma atômica.
 *
 * O decremento original era read-then-write: `findByID` → subtrai em JS →
 * `update` com valor absoluto. Dois pagamentos confirmados no mesmo instante
 * liam o mesmo estoque e ambos passavam pela checagem, vendendo o mesmo item
 * duas vezes. A transação que já existe garante ATOMICIDADE (tudo ou nada),
 * mas não ISOLAMENTO: em READ COMMITTED, que é o padrão do Postgres, as duas
 * leituras enxergam o mesmo valor.
 *
 * A correção é deixar o banco decidir, num único comando:
 *
 *     UPDATE ... SET stock = stock - $qtd WHERE id = $id AND stock >= $qtd
 *
 * A segunda transação fica bloqueada na linha até a primeira encerrar e então
 * o Postgres REAVALIA o `WHERE` contra o valor já atualizado — se não houver
 * mais saldo, afeta zero linhas. É essa reavaliação que fecha a janela.
 *
 * Devolve o novo estoque, ou `null` quando não havia saldo suficiente.
 *
 * IMPORTANTE: isto faz só a reserva. Quem chama deve seguir com o
 * `payload.update()` normal, porque os hooks de `Records`/`Apparel` é que
 * desativam o produto sem estoque e recalculam o `totalStock` do vestuário.
 */

type Executor = { execute: (query: unknown) => Promise<unknown> }

/** Drizzle ligado à transação corrente; cai para o global se não houver. */
function executorDaTransacao(payload: Payload, req: PayloadRequest): Executor {
  const db = payload.db as unknown as {
    drizzle?: Executor
    sessions?: Record<string, { db?: Executor } | undefined>
  }

  const idTransacao = req.transactionID
  const daSessao =
    typeof idTransacao === 'string' || typeof idTransacao === 'number'
      ? db.sessions?.[String(idTransacao)]?.db
      : undefined

  const alvo = daSessao ?? db.drizzle
  if (!alvo) {
    throw new Error('[estoque] Adapter sem acesso ao drizzle — reserva atômica indisponível.')
  }
  return alvo
}

/** Lê a contagem de linhas afetadas nos formatos que os drivers devolvem. */
function linhasAfetadas(resultado: unknown): number {
  const r = resultado as { rows?: unknown[]; rowCount?: number | null } | null
  if (Array.isArray(r?.rows)) return r.rows.length
  return r?.rowCount ?? 0
}

function estoqueRetornado(resultado: unknown): number | null {
  const r = resultado as { rows?: Array<{ stock?: unknown }> } | null
  const bruto = r?.rows?.[0]?.stock
  // A coluna é `numeric`, que alguns drivers devolvem como string.
  const n = typeof bruto === 'string' ? Number(bruto) : bruto
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

export async function reservarEstoqueDisco(
  payload: Payload,
  req: PayloadRequest,
  discoId: number | string,
  quantidade: number,
): Promise<number | null> {
  const resultado = await executorDaTransacao(payload, req).execute(
    sql`UPDATE "records"
           SET "stock" = "stock" - ${quantidade}
         WHERE "id" = ${discoId} AND "stock" >= ${quantidade}
     RETURNING "stock"`,
  )
  if (linhasAfetadas(resultado) === 0) return null
  return estoqueRetornado(resultado)
}

/**
 * O adapter do Postgres normaliza o array `variants` numa tabela própria
 * (`apparel_variants`, com PK `id` varchar e coluna `stock`), então cada
 * variante é uma linha e o mesmo UPDATE condicional serve — sem precisar
 * reescrever o array inteiro, que era o pior problema do código anterior:
 * duas variantes vendidas ao mesmo tempo faziam uma sobrescrever a outra.
 */
export async function reservarEstoqueVariante(
  payload: Payload,
  req: PayloadRequest,
  varianteId: string,
  quantidade: number,
): Promise<number | null> {
  const resultado = await executorDaTransacao(payload, req).execute(
    sql`UPDATE "apparel_variants"
           SET "stock" = "stock" - ${quantidade}
         WHERE "id" = ${varianteId} AND "stock" >= ${quantidade}
     RETURNING "stock"`,
  )
  if (linhasAfetadas(resultado) === 0) return null
  return estoqueRetornado(resultado)
}

/**
 * Recalcula `totalStock` e desativa o produto sem saldo, derivando o total das
 * PRÓPRIAS linhas de variante.
 *
 * POR QUE NÃO USAR `payload.update()` AQUI: o adapter grava campos `array` por
 * DELETE + INSERT (`@payloadcms/drizzle/dist/upsertRow`). Reescrever `variants`
 * apagaria e recriaria todas as linhas — jogando fora o travamento por linha e
 * sobrescrevendo o decremento que outra transação tenha feito em OUTRA variante
 * do mesmo produto. Era exatamente esse o pior caso do código original.
 *
 * CUSTO ASSUMIDO: isto duplica a regra que vive em `Apparel.beforeChange`
 * (somar variantes e desativar no zero). Se a regra mudar lá, precisa mudar
 * aqui também. Aceitei a duplicação porque a alternativa é uma escrita
 * incorreta sob concorrência.
 *
 * Nunca reativa um produto desativado à mão — só desativa quando zera.
 */
export async function recalcularTotalDoVestuario(
  payload: Payload,
  req: PayloadRequest,
  apparelId: number | string,
): Promise<void> {
  await executorDaTransacao(payload, req).execute(
    sql`UPDATE "apparel" AS a
           SET "total_stock" = sub.total,
               "active" = CASE WHEN sub.total = 0 THEN false ELSE a."active" END
          FROM (SELECT COALESCE(SUM("stock"), 0) AS total
                  FROM "apparel_variants"
                 WHERE "_parent_id" = ${apparelId}) AS sub
         WHERE a."id" = ${apparelId}`,
  )
}
