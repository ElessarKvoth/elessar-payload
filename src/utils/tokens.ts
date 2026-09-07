import crypto from 'crypto'

/**
 * Geração e conferência de tokens de e-mail.
 *
 * Fica separado de `emailVerificacao.ts` porque aquele arquivo é importado pela
 * collection Users, que o painel também carrega. `crypto` é de servidor e não
 * tem por que entrar nesse caminho.
 */

/**
 * Token no MESMO formato que o Payload gera internamente
 * (`crypto.randomBytes(20).toString('hex')`, collections/operations/create.js:183).
 *
 * Igualar o formato importa: o token do reenvio vai para a mesma coluna
 * `_verificationToken` que o `verifyEmail` nativo consulta. Fossem formatos
 * diferentes, os dois caminhos divergiriam sem erro visível.
 *
 * 20 bytes = 160 bits de aleatoriedade criptográfica. Adivinhar está fora de
 * cogitação, mesmo sem limite de tentativas.
 */
export const gerarToken = (): string => crypto.randomBytes(20).toString('hex')

/**
 * Hash do token, para guardar em banco o que já foi consumido.
 *
 * Guardamos o hash — e não o token — porque o valor original não precisa mais
 * existir depois de usado. Serve só para responder "este link já foi usado"
 * em vez de "link inválido", que é a diferença entre o cliente entender que
 * está tudo certo e ele achar que a conta quebrou.
 */
export const hashDoToken = (token: string): string => hashDeConteudo(token)

/**
 * SHA-256 de um texto qualquer, em hexadecimal.
 *
 * Além dos tokens, é o que registra QUAL texto de termos o cliente aceitou:
 * guardar o documento inteiro em cada conta seria desperdício, e guardar só o
 * número da versão não prova nada (o texto de uma versão pode ser editado
 * depois). O hash prende o número ao conteúdo exato daquele momento.
 */
export const hashDeConteudo = (conteudo: string): string =>
  crypto.createHash('sha256').update(conteudo, 'utf8').digest('hex')

/**
 * Comparação em tempo constante.
 *
 * Comparar token com `===` vaza, pelo tempo de resposta, quantos caracteres
 * iniciais estavam certos. Aqui o risco é pequeno (o token é aleatório e a
 * consulta é por índice), mas o custo de fazer certo é uma linha.
 */
export function tokensIguais(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}
