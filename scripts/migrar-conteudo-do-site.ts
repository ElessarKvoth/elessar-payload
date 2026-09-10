import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { documento, paragrafo } from '../src/utils/lexical'

/**
 * Migração única: leva para o painel o conteúdo que estava cravado no código do
 * storefront.
 *
 *   npm run conteudo:migrar
 *
 * POR QUE EXISTE
 * ──────────────
 * O rodapé, a página "Sobre a Loja", o CNPJ, o Instagram e a frase da loja
 * eram texto fixo dentro dos componentes React. Ao ligar essas telas aos
 * globals do painel, os campos vazios passariam a significar "não mostrar" — e
 * o site perderia os links do rodapé e o texto do Sobre no mesmo instante.
 * Este script preenche os globals com exatamente o que já estava no ar, para
 * que a troca não mude nada na tela e o gerente encontre o conteúdo pronto para
 * editar em vez de uma página em branco.
 *
 * NÃO SOBRESCREVE NADA. Campo já preenchido é deixado como está: o que o
 * gerente digitou vale mais que o padrão que veio do código. Rodar duas vezes
 * não faz mal — a segunda não muda nada.
 */

const payload = await getPayload({ config })

let mudancas = 0
const registrar = (campo: string): void => {
  mudancas++
  console.log(`  ✅ preenchido: ${campo}`)
}
const pular = (campo: string): void => console.log(`  ↷ já preenchido, mantido: ${campo}`)

const vazio = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

// ── Dados da Loja ────────────────────────────────────────────────────────────
console.log('\n── Dados da Loja ──')

const loja = (await payload.findGlobal({
  slug: 'configuracoes-gerais',
  depth: 0,
})) as unknown as Record<string, unknown>

const camposDaLoja: Record<string, string> = {}

// A frase que estava no rodapé, em itálico, embaixo do logo.
if (vazio(loja.tagline)) {
  camposDaLoja.tagline =
    'Discos selecionados a mão. Metal pesado, rock, underground e cultura alternativa.'
  registrar('frase que descreve a loja')
} else pular('frase que descreve a loja')

// Estava no <a> do rodapé, endereço completo com parâmetro de compartilhamento.
if (vazio(loja.instagram)) {
  camposDaLoja.instagram = '@elessarrecords'
  registrar('Instagram')
} else pular('Instagram')

// Estava escrito na faixa de baixo do rodapé.
if (vazio(loja.cnpj)) {
  camposDaLoja.cnpj = '66.012.563/0001-08'
  registrar('CNPJ')
} else pular('CNPJ')

if (Object.keys(camposDaLoja).length > 0) {
  await payload.updateGlobal({
    slug: 'configuracoes-gerais',
    data: camposDaLoja,
    overrideAccess: true,
  })
}

// ── Rodapé ───────────────────────────────────────────────────────────────────
console.log('\n── Rodapé do Site ──')

const rodape = (await payload.findGlobal({
  slug: 'rodape',
  depth: 0,
})) as unknown as Record<string, unknown>
const colunasAtuais = Array.isArray(rodape.colunas) ? rodape.colunas : []
const camposDoRodape: Record<string, unknown> = {}

if (colunasAtuais.length === 0) {
  camposDoRodape.colunas = [
    {
      titulo: 'Loja',
      links: [
        { texto: 'Catálogo', endereco: '/catalogo' },
        { texto: 'Vestuário', endereco: '/catalogo?tipo=vestuario' },
        { texto: 'Artistas e Bandas', endereco: '/artistas' },
        { texto: 'Raridades', endereco: '/catalogo?isRare=true' },
      ],
    },
    {
      titulo: 'Informações',
      links: [
        { texto: 'Sobre a Loja', endereco: '/sobre' },
        { texto: 'Como Comprar', endereco: '/como-comprar' },
        { texto: 'Entrega e Frete', endereco: '/entrega' },
        { texto: 'Trocas e Devoluções', endereco: '/trocas' },
        // Página nova: existia no painel sem nada no site consumindo.
        { texto: 'Perguntas Frequentes', endereco: '/perguntas-frequentes' },
      ],
    },
  ]
  registrar('duas listas de links (as mesmas que estavam no ar)')
} else pular(`listas de links (${colunasAtuais.length} já cadastradas)`)

if (vazio(rodape.textoCopyright)) {
  camposDoRodape.textoCopyright = 'Todos os direitos reservados.'
  registrar('aviso de direitos autorais')
} else pular('aviso de direitos autorais')

if (vazio(rodape.formasDePagamento)) {
  camposDoRodape.formasDePagamento = 'PIX · Cartão · Boleto'
  registrar('formas de pagamento')
} else pular('formas de pagamento')

if (Object.keys(camposDoRodape).length > 0) {
  await payload.updateGlobal({
    slug: 'rodape',
    data: camposDoRodape,
    overrideAccess: true,
  })
}

// ── Sobre a Loja ─────────────────────────────────────────────────────────────
console.log('\n── Sobre a Loja ──')

const sobre = (await payload.findGlobal({
  slug: 'pagina-sobre-nos',
  depth: 0,
})) as unknown as Record<string, unknown>

const raizDoTexto = (sobre.texto as { root?: { children?: unknown[] } } | null)?.root
const textoEscrito = Array.isArray(raizDoTexto?.children) && raizDoTexto.children.length > 0

if (!textoEscrito) {
  const textoDoSobre: Record<string, unknown> = {
    texto: documento([
        paragrafo(
          'A Elessar Records nasceu da paixão por música de verdade — aquela que não ' +
            'some com o tempo e que você guarda com cuidado na prateleira.',
        ),
        paragrafo(
          'Aqui você encontra discos de vinil, CDs e cassetes selecionados a mão: metal ' +
            'pesado, rock clássico, death metal, black metal, doom, grunge e toda a cultura ' +
            'underground que moldou gerações.',
        ),
        paragrafo(
          'Cada disco no catálogo é avaliado e descrito com honestidade. Se tem riscos, ' +
            'você sabe. Se é lacrado, você sabe.',
        ),
    ]),
  }

  await payload.updateGlobal({
    slug: 'pagina-sobre-nos',
    data: textoDoSobre,
    overrideAccess: true,
  })
  registrar('texto da página (os três parágrafos que estavam no site)')
} else pular('texto da página')

// ── Fim ──────────────────────────────────────────────────────────────────────

console.log(
  mudancas === 0
    ? '\n✅ Nada a fazer: tudo já estava preenchido no painel.\n'
    : `\n✅ ${mudancas} campo(s) preenchido(s). Abra o painel e ajuste o que quiser —\n` +
        '   daqui para frente é de lá que o site tira esse conteúdo.\n',
)

process.exit(0)
