import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { montarMinutas, aPreencher, type ChaveMinuta, type DadosDaLoja } from '../src/content/minutasLegais'

/**
 * Carrega as minutas dos documentos legais no painel.
 *
 *   npm run legais:carregar             → só preenche páginas VAZIAS
 *   npm run legais:carregar -- --ver    → mostra o que faria, sem gravar
 *   npm run legais:carregar -- --forcar <pagina>  → sobrescreve uma página
 *
 * Por padrão NUNCA sobrescreve texto existente. Depois de carregadas, quem
 * manda é o painel: se o gerente reescreveu a política de trocas, rodar este
 * script de novo não pode desfazer o trabalho dele. Sobrescrever exige dizer
 * exatamente qual página, uma por vez.
 *
 * ⚠️  As minutas PRECISAM DE REVISÃO DE ADVOGADO — ver o cabeçalho de
 *     src/content/minutasLegais.ts.
 */

const args = process.argv.slice(2)
const apenasVer = args.includes('--ver')
const indiceForcar = args.indexOf('--forcar')
const paginaForcada = indiceForcar >= 0 ? (args[indiceForcar + 1] as ChaveMinuta | undefined) : undefined

const payload = await getPayload({ config })

// ── Dados da loja, lidos do painel ───────────────────────────────────────────
// Preenchidos no texto das minutas. O que faltar vira marcador visível, para o
// gerente enxergar exatamente o que precisa completar em vez de publicar um
// documento com lacuna silenciosa.
const gerais = (await payload.findGlobal({ slug: 'configuracoes-gerais', depth: 0 })) as {
  nomeDaLoja?: string | null
  razaoSocial?: string | null
  cnpj?: string | null
  endereco?: string | null
  emailContato?: string | null
  telefone?: string | null
}

const loja: DadosDaLoja = {
  nome: gerais.nomeDaLoja?.trim() || 'Elessar Records',
  razaoSocial: gerais.razaoSocial?.trim() || aPreencher('razão social em Dados da Loja'),
  cnpj: gerais.cnpj?.trim() || aPreencher('CNPJ em Dados da Loja'),
  endereco: gerais.endereco?.trim().replace(/\s*\n\s*/g, ', ') || aPreencher('endereço em Dados da Loja'),
  email: gerais.emailContato?.trim() || aPreencher('e-mail de contato em Dados da Loja'),
  telefone: gerais.telefone?.trim() || '',
}

const faltando = Object.entries(loja)
  .filter(([, v]) => typeof v === 'string' && v.startsWith('[PREENCHER'))
  .map(([k]) => k)

console.log('\n━━━ Dados da loja usados nos documentos ━━━')
for (const [chave, valor] of Object.entries(loja)) {
  console.log(`  ${chave.padEnd(12)}: ${valor || '(vazio)'}`)
}
if (faltando.length > 0) {
  console.log(
    `\n⚠️  ${faltando.length} dado(s) ausente(s). Os documentos vão sair com marcador [PREENCHER: …] no texto.`,
  )
  console.log('   Preencha em Painel → Dados da Loja e rode de novo com --forcar para atualizar.')
}

// ── Estado atual das páginas ─────────────────────────────────────────────────
const legais = (await payload.findGlobal({ slug: 'paginas-legais', depth: 0 })) as unknown as Record<
  string,
  unknown
>

const temConteudo = (chave: string): boolean => {
  const pagina = legais[chave] as { texto?: { root?: { children?: unknown[] } } } | undefined
  return Array.isArray(pagina?.texto?.root?.children) && pagina.texto.root.children.length > 0
}

const minutas = montarMinutas(loja)
const chaves = Object.keys(minutas) as ChaveMinuta[]

console.log('\n━━━ Situação das páginas ━━━')
const aGravar: ChaveMinuta[] = []
for (const chave of chaves) {
  const ocupada = temConteudo(chave)
  if (paginaForcada && paginaForcada !== chave) {
    console.log(`  ${chave.padEnd(12)}: ignorada (--forcar ${paginaForcada})`)
    continue
  }
  if (ocupada && paginaForcada !== chave) {
    console.log(`  ${chave.padEnd(12)}: ⏭️  JÁ TEM TEXTO — preservada`)
    continue
  }
  console.log(`  ${chave.padEnd(12)}: ${ocupada ? '♻️  será SOBRESCRITA' : '✍️  será preenchida'}`)
  aGravar.push(chave)
}

if (aGravar.length === 0) {
  console.log('\nNada a fazer.\n')
  process.exit(0)
}

if (apenasVer) {
  console.log(`\n👀 --ver: nada foi gravado. Rode sem --ver para aplicar.\n`)
  process.exit(0)
}

// ── Grava ────────────────────────────────────────────────────────────────────
// Uma chamada só, com as páginas escolhidas. O Payload preenche o global
// inteiro, então enviar só o que muda evita apagar o resto sem querer.
const dados: Record<string, unknown> = {}
for (const chave of aGravar) {
  dados[chave] = {
    titulo: minutas[chave].titulo,
    texto: minutas[chave].texto,
    atualizadoEm: new Date().toISOString(),
  }
}

await payload.updateGlobal({ slug: 'paginas-legais', data: dados, overrideAccess: true })

console.log(`\n✅ ${aGravar.length} página(s) gravada(s): ${aGravar.join(', ')}`)
console.log('\n⚠️  ESTES TEXTOS SÃO MINUTAS E PRECISAM DE REVISÃO DE ADVOGADO.')
console.log('   Leia cada um no painel (Páginas de Regras) antes de considerar publicado.')
console.log('   Depois de revisar, mude a "Versão dos termos em vigor" se algo mudou de verdade.\n')

process.exit(0)
