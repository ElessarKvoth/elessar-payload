import { vercelPostgresAdapter } from '@payloadcms/db-vercel-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { resendAdapter } from '@payloadcms/email-resend'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Artists } from './collections/Artists'
import { Categories } from './collections/Categories'
import { Records } from './collections/Records'
import { Apparel } from './collections/Apparel'
import { Orders } from './collections/Orders'
import { Banners } from './collections/Banners'
import { Genres } from './collections/Genres'
import { Homepage } from './globals/Homepage'
import { ConfiguracoesDeFrete } from './globals/ConfiguracoesDeFrete'
import { cotarFrete } from './endpoints/cotarFrete'
import { criarPagamentoMercadoPago } from './endpoints/criarPagamentoMercadoPago'
import { mercadopagoWebhook } from './endpoints/mercadopagoWebhook'
import { confirmarRetornoMercadoPago } from './endpoints/confirmarRetornoMercadoPago'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '— Elessar Records',
    },
  },
  collections: [Records, Apparel, Banners, Artists, Genres, Categories, Media, Orders, Users],
  globals: [Homepage, ConfiguracoesDeFrete],
  endpoints: [cotarFrete, criarPagamentoMercadoPago, mercadopagoWebhook, confirmarRetornoMercadoPago],
  editor: lexicalEditor(),
  // Sem RESEND_API_KEY o Payload cai no transporte padrão (loga no console em vez
  // de enviar) — o boot não quebra, mas nenhum e-mail sai de verdade.
  email: process.env.RESEND_API_KEY
    ? resendAdapter({
        defaultFromAddress: process.env.EMAIL_FROM || 'nao-responda@elessarrecords.com.br',
        defaultFromName: 'Elessar Records',
        apiKey: process.env.RESEND_API_KEY,
      })
    : undefined,
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: vercelPostgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || process.env.DATABASE_URL || process.env.POSTGRES_URL || '',
    },
  }),
  upload: {
    limits: {
      fileSize: 4_400_000, // 4.4 MB (Vercel serverless body limit)
    },
  },
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL,
  cors: [
    // FRONTEND_URL accepts comma-separated URLs for multiple environments
    ...(process.env.FRONTEND_URL ?? '').split(',').map((u) => u.trim()).filter(Boolean),
    'https://elessar-front.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ],
  csrf: [
    ...(process.env.FRONTEND_URL ?? '').split(',').map((u) => u.trim()).filter(Boolean),
    'https://elessar-front.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ],
  sharp,
  plugins: [],
})
