import type { Payload } from 'payload'

/* ────────────────────────────────────────────────────────────────────────────
   Layout base dos e-mails transacionais.

   Escrito em TABELA com CSS embutido em cada elemento, e não em div com folha
   de estilo, porque é o que sobrevive ao Outlook — ele renderiza e-mail com o
   motor do Word, ignora <style> externo, descarta a maioria das classes e não
   entende flex nem grid. O que parece HTML de 2005 aqui é o que chega inteiro
   nas caixas de entrada reais.

   Modo escuro: o Gmail e o Outlook invertem cores por conta própria em tema
   escuro, e fundo claro com texto claro é o resultado mais comum do estrago.
   Este layout já é escuro de origem e declara `color-scheme`, então a inversão
   não tem o que fazer — a peça chega igual nos dois temas.
   ──────────────────────────────────────────────────────────────────────────── */

export interface ItemDoEmail {
  titulo: string
  /** Linhas menores sob o título (artista, formato, SKU…). */
  linhas?: string[]
  quantidade: number
  /** Valor já formatado (ex: "R$ 210,90"). */
  valor: string
  /** URL pública da foto (capa do disco). */
  imagem?: string | null
}

export interface SecaoDoEmail {
  titulo: string
  linhas: Array<{ rotulo: string; valor: string }>
}

export interface EmailBaseArgs {
  titulo: string
  saudacao?: string
  /** Parágrafos do corpo. Cada item vira um <p>. Aceita **negrito**. */
  corpo: string | string[]
  /** Caixa de atenção logo após o corpo (ex: etiqueta com erro). Aceita **negrito**. */
  aviso?: string
  /** Tabela de itens do pedido, com foto opcional. */
  itens?: ItemDoEmail[]
  /** Linhas de valores sob os itens (subtotal, frete, total). */
  totais?: Array<{ rotulo: string; valor: string; forte?: boolean }>
  /** Grupos de informação com título (Entrega, Pagamento, Cliente…). */
  secoes?: SecaoDoEmail[]
  botaoTexto?: string
  botaoUrl?: string
  /** Linhas de detalhe (data, dispositivo, local) exibidas em bloco destacado. */
  detalhes?: Array<{ rotulo: string; valor: string }>
  /** Aviso final dentro do cartão (ex: "se não foi você…"). Aceita **negrito**. */
  rodape?: string
  /** Identificação da empresa no pé do e-mail. */
  empresa?: DadosDaEmpresa
}

export interface DadosDaEmpresa {
  nome: string
  razaoSocial?: string
  cnpj?: string
  endereco?: string
}

// URL pública da loja (para onde os links do e-mail apontam). FRONTEND_URL
// aceita várias separadas por vírgula — usamos a primeira.
export function storefrontUrl(): string {
  const primeira = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)[0]
  return (primeira ?? 'http://localhost:3001').replace(/\/$/, '')
}

// URL do painel admin. O painel roda no BACKEND, não na loja: os avisos de
// pedido apontavam para `${storefrontUrl()}/admin`, que dá 404 no storefront.
export function painelUrl(): string {
  return (process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000').replace(/\/$/, '') + '/admin'
}

const escapar = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * Escapa e só DEPOIS converte `**texto**` em negrito. Os avisos de pedido
 * escreviam `<strong>` direto no corpo, que é escapado — e o gerente lia as
 * tags como texto. Assim o negrito existe sem abrir brecha para HTML vindo de
 * dado de cliente (nome, observação), que continua escapado.
 */
const formatar = (s: string): string =>
  escapar(s).replace(/\*\*(.+?)\*\*/g, `<strong style="color:#e8e0d0;">$1</strong>`)

/** R$ a partir de centavos, no formato brasileiro. */
export const reais = (centavos: number): string =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ── Dados da empresa, lidos do painel ────────────────────────────────────────
// Nome, CNPJ e endereço no rodapé não são enfeite: identificam o remetente,
// é o que a boa prática antisspam espera de e-mail comercial, e evita que a
// mensagem pareça golpe. Cache curto para não consultar o banco a cada envio.

let cacheEmpresa: { dados: DadosDaEmpresa; expiraEm: number } | null = null
const CACHE_MS = 10 * 60_000

export async function dadosDaEmpresa(payload: Payload): Promise<DadosDaEmpresa> {
  const agora = Date.now()
  if (cacheEmpresa && cacheEmpresa.expiraEm > agora) return cacheEmpresa.dados

  let dados: DadosDaEmpresa = { nome: 'Elessar Records' }
  try {
    const g = (await payload.findGlobal({ slug: 'configuracoes-gerais', depth: 0 })) as {
      nomeDaLoja?: string | null
      razaoSocial?: string | null
      cnpj?: string | null
      endereco?: string | null
    }
    dados = {
      nome: g.nomeDaLoja?.trim() || 'Elessar Records',
      razaoSocial: g.razaoSocial?.trim() || undefined,
      cnpj: g.cnpj?.trim() || undefined,
      endereco: g.endereco?.trim().replace(/\s*\n\s*/g, ', ') || undefined,
    }
  } catch {
    // Banco indisponível não pode impedir o envio: segue com o nome padrão.
  }

  cacheEmpresa = { dados, expiraEm: agora + CACHE_MS }
  return dados
}

export function esquecerDadosDaEmpresa(): void {
  cacheEmpresa = null
}

// ── Paleta ───────────────────────────────────────────────────────────────────
const COR = {
  fundo: '#0c0a08',
  cartao: '#14110d',
  borda: '#2a241b',
  // Verde musgo da marca — o mesmo `accent` do site. O dourado anterior não
  // era cor da Elessar.
  destaque: '#93a559',
  titulo: '#e8e0d0',
  texto: '#a89e88',
  textoForte: '#c9bfa8',
  apagado: '#6b5f45',
  rodape: '#5a5040',
} as const

const FONTE =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

function blocoDetalhes(detalhes: NonNullable<EmailBaseArgs['detalhes']>): string {
  const linhas = detalhes
    .map(
      ({ rotulo, valor }) => `
              <tr>
                <td style="padding:4px 12px 4px 0;font-size:12px;color:${COR.apagado};white-space:nowrap;">${escapar(rotulo)}</td>
                <td style="padding:4px 0;font-size:13px;color:${COR.textoForte};">${escapar(valor)}</td>
              </tr>`,
    )
    .join('')

  return `
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px 0;border-left:2px solid ${COR.destaque};padding-left:16px;">
              ${linhas}
            </table>`
}

function blocoAviso(texto: string): string {
  return `
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px 0;">
              <tr>
                <td style="padding:14px 16px;border:1px solid #8a6a1f;background-color:#221b0c;font-size:13px;line-height:1.6;color:#e0c27a;">${formatar(texto)}</td>
              </tr>
            </table>`
}

function blocoItens(itens: ItemDoEmail[], totais?: EmailBaseArgs['totais']): string {
  const linhas = itens
    .map((it) => {
      const foto = it.imagem
        ? `<img src="${escapar(it.imagem)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;object-fit:cover;border:1px solid ${COR.borda};" />`
        : `<div style="width:56px;height:56px;background-color:${COR.borda};"></div>`
      const extras = (it.linhas ?? [])
        .filter(Boolean)
        .map((l) => `<div style="font-size:12px;line-height:1.5;color:${COR.apagado};">${escapar(l)}</div>`)
        .join('')
      return `
              <tr>
                <td width="68" valign="top" style="padding:12px 12px 12px 0;border-bottom:1px solid ${COR.borda};">${foto}</td>
                <td valign="top" style="padding:12px 0;border-bottom:1px solid ${COR.borda};">
                  <div style="font-size:14px;line-height:1.4;font-weight:bold;color:${COR.titulo};">${escapar(it.titulo)}</div>
                  ${extras}
                </td>
                <td valign="top" align="right" style="padding:12px 0 12px 12px;border-bottom:1px solid ${COR.borda};white-space:nowrap;">
                  <div style="font-size:13px;color:${COR.textoForte};">${escapar(it.valor)}</div>
                  <div style="font-size:12px;color:${COR.apagado};">qtd. ${it.quantidade}</div>
                </td>
              </tr>`
    })
    .join('')

  const valores = (totais ?? [])
    .map(
      (t) => `
              <tr>
                <td colspan="2" align="right" style="padding:${t.forte ? '10px' : '4px'} 12px 0 0;font-size:${t.forte ? '14px' : '12px'};color:${t.forte ? COR.titulo : COR.apagado};${t.forte ? 'font-weight:bold;' : ''}">${escapar(t.rotulo)}</td>
                <td align="right" style="padding:${t.forte ? '10px' : '4px'} 0 0 0;font-size:${t.forte ? '15px' : '13px'};color:${t.forte ? COR.titulo : COR.textoForte};white-space:nowrap;${t.forte ? 'font-weight:bold;' : ''}">${escapar(t.valor)}</td>
              </tr>`,
    )
    .join('')

  return `
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px 0;border-top:1px solid ${COR.borda};">
              ${linhas}
              ${valores}
            </table>`
}

function blocoSecoes(secoes: SecaoDoEmail[]): string {
  return secoes
    .filter((s) => s.linhas.length > 0)
    .map(
      (s) => `
            <p style="margin:0 0 8px 0;font-size:10px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:${COR.destaque};">${escapar(s.titulo)}</p>
            ${blocoDetalhes(s.linhas)}`,
    )
    .join('')
}

function pePagina(empresa?: DadosDaEmpresa): string {
  const nome = empresa?.nome ?? 'Elessar Records'
  const identificacao = [empresa?.razaoSocial, empresa?.cnpj ? `CNPJ ${empresa.cnpj}` : null]
    .filter(Boolean)
    .join(' · ')

  return `
          <p style="margin:24px 0 0 0;font-size:11px;line-height:1.6;color:#4a4234;text-align:center;">
            <strong style="color:${COR.rodape};">${escapar(nome)}</strong>${
              identificacao ? `<br />${escapar(identificacao)}` : ''
            }${empresa?.endereco ? `<br />${escapar(empresa.endereco)}` : ''}
            <br /><br />
            Este é um endereço automático — <strong>não responda a este e-mail</strong>.
          </p>`
}

export function emailBase({
  titulo,
  saudacao,
  corpo,
  aviso,
  itens,
  totais,
  secoes,
  botaoTexto,
  botaoUrl,
  detalhes,
  rodape,
  empresa,
}: EmailBaseArgs): string {
  const paragrafos = (Array.isArray(corpo) ? corpo : [corpo])
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0;font-size:14px;line-height:1.7;color:${COR.texto};">${formatar(p)}</p>`,
    )
    .join('')

  const botao =
    botaoTexto && botaoUrl
      ? `
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0 0 0;">
                  <tr>
                    <td style="background-color:${COR.destaque};">
                      <a href="${escapar(botaoUrl)}"
                         style="display:inline-block;padding:15px 34px;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${COR.fundo};text-decoration:none;">
                        ${escapar(botaoTexto)}
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0 0;font-size:12px;line-height:1.6;color:${COR.apagado};">
                  Se o botão não funcionar, copie e cole este endereço no navegador:<br />
                  <a href="${escapar(botaoUrl)}" style="color:${COR.destaque};word-break:break-all;">${escapar(botaoUrl)}</a>
                </p>`
      : ''

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${escapar(titulo)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${COR.fundo};font-family:${FONTE};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COR.fundo};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${COR.cartao};border:1px solid ${COR.borda};">
            <tr>
              <td style="height:3px;background:linear-gradient(to right,${COR.cartao},${COR.destaque},${COR.cartao});font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:36px 36px 30px 36px;">
                <p style="margin:0 0 20px 0;font-size:10px;font-weight:bold;letter-spacing:4px;text-transform:uppercase;color:${COR.apagado};">
                  ${escapar(empresa?.nome ?? 'Elessar Records')}
                </p>
                <h1 style="margin:0 0 20px 0;font-size:25px;line-height:1.2;font-weight:800;text-transform:uppercase;color:${COR.titulo};">
                  ${escapar(titulo)}
                </h1>
                ${
                  saudacao
                    ? `<p style="margin:0 0 14px 0;font-size:15px;color:${COR.textoForte};">${escapar(saudacao)},</p>`
                    : ''
                }
                ${paragrafos}
                ${aviso ? blocoAviso(aviso) : ''}
                ${itens && itens.length > 0 ? blocoItens(itens, totais) : ''}
                ${secoes && secoes.length > 0 ? blocoSecoes(secoes) : ''}
                ${detalhes && detalhes.length > 0 ? blocoDetalhes(detalhes) : ''}
                ${botao}
              </td>
            </tr>
            ${
              rodape
                ? `<tr>
              <td style="padding:0 36px 32px 36px;">
                <div style="border-top:1px solid ${COR.borda};">
                  <p style="margin:20px 0 0 0;font-size:12px;line-height:1.6;color:${COR.rodape};">
                    ${formatar(rodape)}
                  </p>
                </div>
              </td>
            </tr>`
                : ''
            }
          </table>
          ${pePagina(empresa)}
        </td>
      </tr>
    </table>
  </body>
</html>`
}

// ── Data e hora em português ─────────────────────────────────────────────────

/**
 * `07/09/2026 às 19:42` no fuso de São Paulo.
 *
 * O fuso é fixado de propósito: o servidor roda em UTC na Vercel, e um aviso de
 * acesso com hora errada é pior que nenhum — o cliente olha, não reconhece o
 * horário, e ou ignora um acesso real ou se assusta com o próprio login.
 */
export function dataHoraBr(quando: Date = new Date()): string {
  const f = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const partes = Object.fromEntries(f.formatToParts(quando).map((p) => [p.type, p.value]))
  return `${partes.day}/${partes.month}/${partes.year} às ${partes.hour}:${partes.minute}`
}
