/**
 * Zera o conteúdo do banco para a loja ser cadastrada do zero.
 *
 * DIFERENÇA PARA `npm run clear`
 * O `clear` preserva os usuários administradores (`role != 'admin'` no filtro).
 * Este script apaga TODOS os usuários, inclusive os admins, porque o objetivo é
 * que a primeira conta criada depois seja a do dono da loja.
 *
 * O QUE ELE NÃO FAZ
 * Não apaga tabela nem coluna: o schema fica intacto. Só remove linhas.
 * Também não apaga os arquivos já enviados para o Cloudinary — as imagens sarão
 * do painel, mas continuam ocupando espaço lá. Limpar aquilo é pelo painel do
 * Cloudinary, e não é urgente.
 *
 * A TRAVA QUE IMPORTA
 * Neste projeto o papel de administrador NÃO é dado ao primeiro usuário que se
 * cadastra: ele é derivado do e-mail estar em ADMIN_EMAILS
 * (`src/utils/adminEmails.ts`, aplicado no `beforeChange` de Users). Isso é
 * proposital e é o que impede um visitante qualquer de virar dono do painel.
 *
 * Mas cria um risco sério na hora de zerar: se apagarmos todos os usuários e o
 * e-mail do dono NÃO estiver em ADMIN_EMAILS, ele se cadastra como cliente
 * comum, não consegue entrar no painel, e não sobra nenhum admin para
 * consertar. Ficaria todo mundo trancado do lado de fora.
 *
 * Por isso este script EXIGE que você informe o e-mail de quem vai assumir o
 * painel, e recusa continuar se esse e-mail não estiver configurado.
 *
 * Uso:
 *   npm run db:zerar -- --admin=email-do-dono@dominio.com
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import type { CollectionSlug, Payload } from 'payload'

import config from '../src/payload.config'
import { emailEhAdmin, listaAdminEmails } from '../src/utils/adminEmails'
import { exigirConfirmacao } from './confirmarAlvo'

// Ordem importa: quem aponta para outro é apagado antes de quem é apontado,
// senão o banco recusa por causa das chaves estrangeiras. `records` referencia
// `genres` e `artists`, então vem antes dos dois.
const COLECOES_NA_ORDEM: CollectionSlug[] = [
  'orders',
  'banners',
  'records',
  'apparel',
  'users',
  'artists',
  'genres',
  'categories',
  'media',
]

/** Lê --admin=... da linha de comando. */
function emailInformado(): string | null {
  const arg = process.argv.find((a) => a.startsWith('--admin='))
  return arg ? arg.slice('--admin='.length).trim() : null
}

function abortar(mensagem: string): never {
  console.error(`\n✗ ${mensagem}\n`)
  process.exit(1)
}

async function esvaziarColecao(payload: Payload, slug: CollectionSlug): Promise<number> {
  const { docs } = await payload.find({
    collection: slug,
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  for (const doc of docs) {
    await payload.delete({ collection: slug, id: doc.id, overrideAccess: true })
  }
  return docs.length
}

async function main(): Promise<void> {
  // ── 1. A trava do administrador, ANTES de qualquer coisa ─────────────────
  const email = emailInformado()

  if (!email) {
    abortar(
      'Informe quem vai assumir o painel depois de zerar.\n' +
        '  Exemplo:  npm run db:zerar -- --admin=seupai@gmail.com\n\n' +
        '  Esse e-mail precisa ser o mesmo que ele vai usar para criar a conta.',
    )
  }

  // Este script roda no SEU computador e só enxerga o .env local. Mas quem
  // decide se o dono vira admin é o ambiente onde ele vai se cadastrar — a
  // Vercel. As duas configurações podem divergir, e é comum divergirem.
  const configurados = listaAdminEmails()
  const confirmouVercel = process.argv.includes('--confirmo-vercel')

  if (configurados.length === 0) {
    if (!confirmouVercel) {
      abortar(
        'ADMIN_EMAILS não está configurada NESTE COMPUTADOR.\n\n' +
          '  Isso sozinho não impede nada: se ela estiver configurada na Vercel,\n' +
          '  seu pai vira administrador normalmente ao se cadastrar pelo painel\n' +
          '  publicado. Eu simplesmente não consigo verificar a Vercel daqui.\n\n' +
          '  ANTES DE CONTINUAR, abra a Vercel em Settings → Environment Variables\n' +
          `  e confirme com os próprios olhos que ADMIN_EMAILS contém:\n` +
          `      ${email}\n\n` +
          '  Confirmado, rode de novo acrescentando --confirmo-vercel:\n' +
          `      npm run db:zerar -- --admin=${email} --confirmo-vercel\n\n` +
          '  RECOMENDAÇÃO À PARTE: configure ADMIN_EMAILS também no .env local, com\n' +
          '  o mesmo valor. Sem ela, salvar qualquer usuário pelo painel rodando na\n' +
          '  sua máquina rebaixa esse usuário para cliente comum — e como o banco é\n' +
          '  o mesmo da produção, o rebaixamento vale para o site no ar. Se isso\n' +
          '  acontecer com a conta de administrador, ninguém mais entra no painel.',
      )
    }
    console.log(
      `\n⚠ ADMIN_EMAILS não existe aqui, mas você confirmou que "${email}" está na Vercel.\n` +
        '  Seguindo com base nessa confirmação.\n',
    )
  } else if (!emailEhAdmin(email)) {
    abortar(
      `O e-mail "${email}" NÃO está no ADMIN_EMAILS deste computador.\n\n` +
        `  Há ${configurados.length} e-mail(s) configurado(s) aqui, e nenhum é esse.\n\n` +
        '  Se a Vercel também não tiver esse e-mail, ele criaria a conta como\n' +
        '  cliente comum, não entraria no painel, e não sobraria nenhum\n' +
        '  administrador para consertar.\n\n' +
        `  Corrija o .env local para:\n` +
        `      ADMIN_EMAILS=${[...configurados, email].join(',')}\n\n` +
        '  Ou, se tiver certeza de que a Vercel já está correta, use --confirmo-vercel.',
    )
  } else {
    console.log(`\n✓ "${email}" está em ADMIN_EMAILS — vira administrador ao se cadastrar.`)
    console.log('  Confirme que a MESMA variável está na Vercel: é lá que ele vai se')
    console.log('  cadastrar, e as duas configurações são independentes.\n')
  }

  // ── 2. Mostrar o estrago antes de pedir confirmação ──────────────────────
  const payload = await getPayload({ config })

  console.log('O que existe hoje e será apagado:\n')
  let total = 0
  for (const slug of COLECOES_NA_ORDEM) {
    const { totalDocs } = await payload.count({ collection: slug, overrideAccess: true })
    console.log(`  ${String(totalDocs).padStart(5)}  ${slug}`)
    total += totalDocs
  }
  console.log(`  ${'—'.repeat(5)}\n  ${String(total).padStart(5)}  no total\n`)

  if (total === 0) {
    console.log('Banco já está vazio. Nada a fazer.\n')
    process.exit(0)
  }

  const alvo = await exigirConfirmacao(
    `apagar ${total} registro(s) e TODOS os usuários, inclusive administradores`,
    'Isto NÃO tem desfazer. Se ainda não fez um backup no Neon, cancele e faça agora.',
  )
  console.log(`Zerando ${alvo.host}/${alvo.banco}...\n`)

  // ── 3. Zerar os globals antes das collections ────────────────────────────
  // A página inicial aponta para banners, discos, imagens e artistas. Se ela
  // ficasse apontando para registros apagados, a home quebraria.
  await payload.updateGlobal({
    slug: 'homepage',
    data: { banners: [], featuredRecords: [], exclusiveReleases: [], bandIcons: [] },
    overrideAccess: true,
  })
  console.log('  ✓ página inicial esvaziada')

  // ── 4. Apagar as collections ─────────────────────────────────────────────
  for (const slug of COLECOES_NA_ORDEM) {
    const n = await esvaziarColecao(payload, slug)
    console.log(`  ✓ ${String(n).padStart(5)} apagado(s) de ${slug}`)
  }

  console.log('\n✓ Banco zerado.\n')
  console.log('  PRÓXIMO PASSO — na ordem:')
  console.log('   1. Abra o painel no navegador. Ele vai pedir para criar o primeiro usuário.')
  console.log(`   2. Cadastre com o e-mail ${email} — é o que dá acesso de administrador.`)
  console.log('   3. Confira em Configurações → Frete se os dados do Remetente continuam lá')
  console.log('      (são de um global, não foram apagados).')
  console.log('   4. Comece pelas imagens, depois artistas. A ordem está no MANUAL-DO-PAINEL.md.\n')

  process.exit(0)
}

main().catch((err: unknown) => {
  console.error('\n✗ Falhou:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
