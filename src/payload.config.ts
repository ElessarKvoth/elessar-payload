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
import { PaginaSobreNos } from './globals/PaginaSobreNos'
import { PaginasLegais } from './globals/PaginasLegais'
import { PerguntasFrequentes } from './globals/PerguntasFrequentes'
import { cotarFrete } from './endpoints/cotarFrete'
import { criarPagamentoMercadoPago } from './endpoints/criarPagamentoMercadoPago'
import { mercadopagoWebhook } from './endpoints/mercadopagoWebhook'
import { confirmarRetornoMercadoPago } from './endpoints/confirmarRetornoMercadoPago'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/** O header `Origin` nunca traz barra no fim; a env var costuma trazer. */
const comoOrigem = (url: string): string => url.trim().replace(/\/+$/, '')

/** Lê uma env var que aceita várias URLs separadas por vírgula. */
const origensDaEnv = (valor: string | undefined): string[] =>
  (valor ?? '')
    .split(',')
    .map(comoOrigem)
    .filter(Boolean)

/**
 * Domínios do BACKEND — é onde o painel admin roda.
 *
 * Sem eles aqui o painel loga mas não salva NADA em produção, e o motivo é
 * discreto: o Payload valida CSRF descartando o cookie de sessão quando o
 * `Origin` não está nesta lista (`payload/dist/auth/extractJWT.js`). Como o
 * navegador só manda `Origin` em requisições que alteram dados, o GET (abrir o
 * painel, listar registros) passa e todo POST/PATCH/DELETE volta como não
 * autenticado. O login também passa, porque ele CRIA o cookie em vez de
 * depender de um — daí o sintoma "eu entro mas não consigo editar nada".
 *
 * No localhost isso nunca apareceu porque `http://localhost:3000` sempre esteve
 * na lista abaixo.
 */
const ORIGENS_DO_PAINEL = [
  // URL pública deste backend. É a fonte principal.
  ...origensDaEnv(process.env.NEXT_PUBLIC_SERVER_URL),
  // Domínio próprio do painel, quando houver (ex: admin.elessarrecords.com.br).
  ...origensDaEnv(process.env.ADMIN_URL),
  // Domínios que a própria Vercel injeta: o de produção e o do deploy atual
  // (cada preview tem URL única, e sem isto nenhum preview consegue salvar).
  ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
    : []),
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
]

const ORIGENS_PERMITIDAS = [
  ...new Set([
    // Storefront.
    ...origensDaEnv(process.env.FRONTEND_URL),
    'https://elessarrecords.com.br',
    'https://www.elessarrecords.com.br',
    'https://elessar-front.vercel.app',
    // Painel admin.
    ...ORIGENS_DO_PAINEL,
    // Desenvolvimento.
    'http://localhost:3000',
    'http://localhost:3001',
  ]),
]

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
  // A ordem aqui é a ordem do menu lateral: o Payload não ordena nada sozinho,
  // e os globals sempre aparecem depois de todas as collections.
  globals: [Homepage, PaginaSobreNos, PaginasLegais, PerguntasFrequentes, ConfiguracoesDeFrete],
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
    // Desliga o push automático de schema.
    //
    // Antes disto, `npm run dev` comparava o schema do código com o do banco e
    // aplicava a diferença na hora (`db-vercel-postgres/dist/connect.js:81`).
    // Como o DATABASE_URI aponta para o MESMO Neon que a Vercel usa, cada boot
    // do desenvolvimento era um deploy de schema em produção, sem revisão — e um
    // rename de campo viraria coluna apagada com o acervo dentro.
    //
    // Com `push: false`, toda mudança de tabela passa a exigir migration
    // explícita: `npx payload migrate:create` gera o SQL, você lê, e
    // `npx payload migrate` aplica.
    push: false,
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
  // Origens autorizadas a chamar a API pelo navegador. Sem a origem na lista, o
  // browser bloqueia login, cotação de frete e checkout — mesmo com a API no ar.
  // FRONTEND_URL aceita várias URLs separadas por vírgula; os domínios oficiais
  // ficam fixos aqui como rede de segurança, para não dependerem de env var.
  cors: ORIGENS_PERMITIDAS,
  csrf: ORIGENS_PERMITIDAS,
  sharp,
  plugins: [],
})
