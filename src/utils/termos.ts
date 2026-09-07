import type { Payload, PayloadRequest } from 'payload'

import { hashDeConteudo } from './tokens'

/**
 * Aceite de termos — a parte de prova, não a de texto.
 *
 * O TEXTO dos documentos mora no global "Páginas de Regras", editável pelo
 * gerente. Aqui fica só o que é preciso para provar, depois, o que exatamente
 * um cliente aceitou no dia em que criou a conta.
 */

/** Usada quando o gerente ainda não preencheu a versão no painel. */
export const VERSAO_TERMOS_PADRAO = '1.0'

export interface TermosVigentes {
  versao: string
  /**
   * Impressão digital do texto que estava no ar neste instante.
   *
   * Guardar só "versão 1.2" não provaria nada: nada impede alguém de editar o
   * texto da 1.2 depois e o registro do cliente passar a apontar para palavras
   * que ele nunca leu. O hash amarra o número ao conteúdo exato — se o texto
   * mudar sem trocar a versão, os hashes divergem e a diferença fica visível.
   */
  hash: string
}

interface PaginaLegal {
  titulo?: string | null
  texto?: unknown
}

/**
 * Lê a versão e calcula o hash do texto vigente de Termos + Privacidade.
 *
 * Nunca lança: se o global estiver indisponível, devolve a versão padrão com
 * hash vazio. Um problema de leitura não pode impedir alguém de criar conta —
 * o aceite continua registrado, apenas sem a impressão digital.
 */
export async function termosVigentes(
  payload: Payload,
  req?: PayloadRequest,
): Promise<TermosVigentes> {
  try {
    const global = (await payload.findGlobal({ slug: 'paginas-legais', depth: 0, req })) as {
      versaoDosTermos?: string | null
      termos?: PaginaLegal
      privacidade?: PaginaLegal
    }

    const versao = global.versaoDosTermos?.trim() || VERSAO_TERMOS_PADRAO

    // Serializa os dois documentos juntos: o cliente aceita o par, não um só.
    const conteudo = JSON.stringify({
      versao,
      termos: global.termos?.texto ?? null,
      privacidade: global.privacidade?.texto ?? null,
    })

    return { versao, hash: hashDeConteudo(conteudo) }
  } catch (err) {
    payload.logger.error(
      `[termos] Não foi possível ler as páginas de regras para registrar o aceite: ${
        (err as Error).message
      }`,
    )
    return { versao: VERSAO_TERMOS_PADRAO, hash: '' }
  }
}

/**
 * A conta precisa aceitar os termos de novo?
 *
 * Verdadeiro quando o cliente nunca aceitou, ou quando aceitou uma versão
 * diferente da que está no ar. Trocar o número da versão no painel é, portanto,
 * o gatilho que marca TODAS as contas antigas como pendentes — é assim que o
 * gerente comunica uma mudança de regras sem precisar de deploy.
 *
 * De propósito NÃO bloqueia nada sozinho: quem decide o que fazer com o
 * pendente é quem chama (o storefront pede o novo aceite na próxima entrada).
 * Barrar login por causa disso trancaria clientes para fora da própria conta.
 */
export function precisaAceitarNovosTermos(
  usuario: { aceitouTermos?: boolean | null; versaoTermosAceita?: string | null } | null | undefined,
  versaoVigente: string,
): boolean {
  if (!usuario) return false
  if (!usuario.aceitouTermos) return true
  return (usuario.versaoTermosAceita ?? '') !== versaoVigente
}
