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

export interface EmailBaseArgs {
  titulo: string
  saudacao?: string
  /** Parágrafos do corpo. Cada item vira um <p>. */
  corpo: string | string[]
  botaoTexto?: string
  botaoUrl?: string
  /** Linhas de detalhe (data, dispositivo, local) exibidas em bloco destacado. */
  detalhes?: Array<{ rotulo: string; valor: string }>
  /** Aviso final dentro do cartão (ex: "se não foi você…"). */
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

const escapar = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

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
  destaque: '#c9a227',
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
  botaoTexto,
  botaoUrl,
  detalhes,
  rodape,
  empresa,
}: EmailBaseArgs): string {
  const paragrafos = (Array.isArray(corpo) ? corpo : [corpo])
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0;font-size:14px;line-height:1.7;color:${COR.texto};">${escapar(p)}</p>`,
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
                    ${escapar(rodape)}
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
