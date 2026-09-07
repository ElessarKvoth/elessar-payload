import type { Access, FieldAccess } from 'payload'

type WithRole = { role?: 'admin' | 'client' }

export const isAdmin: Access = ({ req: { user } }) =>
  Boolean(user) && (user as WithRole).role === 'admin'

/**
 * Versão a nível de CAMPO. O `Access` de collection pode devolver uma `Where`;
 * o `FieldAccess` só aceita booleano, então são tipos distintos e não dá para
 * reaproveitar o `isAdmin` acima num campo.
 *
 * Lembrete de comportamento: quando o acesso de campo nega, o Payload REMOVE o
 * campo do payload silenciosamente — não devolve 403. Um cliente que tentar
 * gravar `status: 'pago'` recebe um pedido normal em `aguardando_pagamento`.
 * Isso é intencional: falha fechada e sem dar retorno ao atacante.
 *
 * Nada disso afeta o Local API, que roda com `overrideAccess: true` por padrão
 * — os hooks e a confirmação de pagamento continuam escrevendo normalmente.
 */
export const isAdminField: FieldAccess = ({ req: { user } }) =>
  Boolean(user) && (user as WithRole).role === 'admin'

/** Campo que o cliente nunca escreve: nem na criação, nem na atualização. */
export const somenteServidor = { create: () => false, update: isAdminField }

export const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false
  if ((user as WithRole).role === 'admin') return true
  return { id: { equals: user.id } }
}

export const isAdminOrCustomer: Access = ({ req: { user } }) => {
  if (!user) return false
  if ((user as WithRole).role === 'admin') return true
  return { customer: { equals: user.id } }
}

export const isAdminOrPublic: Access = () => true

/**
 * Logado E com e-mail confirmado.
 *
 * REFORÇO, não correção: a estratégia JWT já recusa autenticar conta não
 * verificada quando `auth.verify` está ligado — ela recarrega o usuário a cada
 * requisição e testa `user._verified` (auth/strategies/jwt.js:78). Ou seja,
 * hoje `req.user` nunca chega aqui sem confirmação.
 *
 * A trava existe porque essa garantia mora numa condição do framework, longe
 * daqui: bastaria alguém remover `auth.verify` da collection Users — ou o
 * Payload mudar esse comportamento numa atualização — para que comprar sem
 * confirmar e-mail voltasse a ser possível, em silêncio. Aqui a exigência fica
 * escrita no lugar onde ela importa.
 */
export const isVerificadoOuAdmin: Access = ({ req: { user } }) => {
  if (!user) return false
  if ((user as WithRole).role === 'admin') return true
  return (user as { _verified?: boolean | null })._verified === true
}
