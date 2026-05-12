export const generateSlug = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    // Strip combining diacritical marks — U+0300–U+036F (accents, cedillas, tildes, etc.)
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
