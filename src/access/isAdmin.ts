import type { Access } from 'payload'

type WithRole = { role?: 'admin' | 'client' }

export const isAdmin: Access = ({ req: { user } }) =>
  Boolean(user) && (user as WithRole).role === 'admin'

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
