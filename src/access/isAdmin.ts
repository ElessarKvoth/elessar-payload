import type { Access } from 'payload'

export const isAdmin: Access = ({ req: { user } }) => Boolean(user)
export const isAdminOrPublic: Access = () => true
