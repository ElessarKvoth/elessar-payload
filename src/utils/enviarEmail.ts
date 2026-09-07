import type { Payload } from 'payload'

/**
 * PONTO ÚNICO DE SAÍDA DE E-MAIL DO PROJETO.
 *
 * Todo e-mail transacional passa por aqui — nada de `fetch` direto na API do
 * Resend espalhado pelo código. O transporte de verdade é o adapter declarado
 * no `payload.config.ts`; esta função só o alimenta e cuida do que o adapter
 * não faz: versão em texto puro, Reply-To, retry, log sem segredo e — o mais
 * importante — NUNCA lançar exceção.
 *
 * O "nunca lança" é regra de negócio, não preguiça: um cadastro não pode
 * falhar porque o Resend estava fora do ar. Quem chama recebe
 * `{ enviado: false }` e decide o que fazer (avisar o cliente que o e-mail
 * pode demorar, marcar para reenvio, etc.).
 */

/**
 * Remetente padrão — só entra em cena quando EMAIL_FROM não está definido.
 *
 * COM hífen de propósito: é este o endereço verificado no Resend hoje, o que
 * os e-mails de confirmação de conta já usam e que comprovadamente entrega.
 * Um fallback apontando para endereço inexistente falharia calado.
 *
 * Para migrar para `naoresponda@` (sem hífen): crie o endereço no domínio
 * verificado do Resend, troque EMAIL_FROM, teste com `npm run email:diag`, e
 * só então mude esta constante.
 */
export const REMETENTE_PADRAO = 'nao-responda@elessarrecords.com.br'
export const NOME_REMETENTE = 'Elessar Records'

/** Uma tentativa original + uma repetição. Mais que isso segura a request. */
const TENTATIVAS = 2
const ESPERA_ENTRE_TENTATIVAS_MS = 700

/** Tempo que o Reply-To lido do painel fica em memória antes de reler. */
const CACHE_REPLY_TO_MS = 5 * 60_000

export interface EmailTransacional {
  payload: Payload
  /** Destinatário. Um por envio: e-mail transacional nunca vai em lote. */
  para: string
  assunto: string
  html: string
  /** Versão texto puro. Se ausente, é derivada do HTML. */
  texto?: string
  /**
   * Rótulo curto que identifica o e-mail no log. Ex: 'verificacao-conta'.
   * É o que permite responder "o e-mail de senha alterada saiu?" olhando o log.
   */
  tipo: string
}

export interface ResultadoEnvio {
  enviado: boolean
  /** Motivo legível da falha. Nunca contém token, senha nem o corpo do e-mail. */
  erro?: string
  /**
   * `true` quando o e-mail não saiu de verdade: o adapter em uso é o console
   * do Payload (desenvolvimento sem RESEND_API_KEY). O envio "deu certo",
   * mas ninguém recebeu nada.
   */
  simulado: boolean
}

// ── Reply-To ────────────────────────────────────────────────────────────────
// De propósito NÃO é constante no código: quem atende mudou de e-mail não
// deveria precisar de deploy. Ordem: variável de ambiente → e-mail de contato
// do painel → nenhum (o Resend então usa o próprio remetente).

let cacheReplyTo: { valor: string | undefined; expiraEm: number } | null = null

async function enderecoDeResposta(payload: Payload): Promise<string | undefined> {
  const daEnv = process.env.EMAIL_REPLY_TO?.trim()
  if (daEnv) return daEnv

  const agora = Date.now()
  if (cacheReplyTo && cacheReplyTo.expiraEm > agora) return cacheReplyTo.valor

  let valor: string | undefined
  try {
    const config = await payload.findGlobal({ slug: 'configuracoes-gerais', depth: 0 })
    const contato = (config as { emailContato?: string | null }).emailContato?.trim()
    valor = contato || undefined
  } catch {
    // Global ainda não preenchido ou banco indisponível: segue sem Reply-To.
    valor = undefined
  }

  cacheReplyTo = { valor, expiraEm: agora + CACHE_REPLY_TO_MS }
  return valor
}

/** Zera o cache do Reply-To. Usado nos scripts e nos testes. */
export function esquecerReplyTo(): void {
  cacheReplyTo = null
}

// ── Higiene de log ──────────────────────────────────────────────────────────

const REGEX_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

/** `rhaziel@gmail.com` → `rh***@gmail.com`. Log não é lugar de e-mail inteiro. */
export function mascararEmail(email: string): string {
  const [usuario = '', dominio = ''] = email.split('@')
  if (!dominio) return '***'
  const visivel = usuario.slice(0, 2)
  return `${visivel}***@${dominio}`
}

/** Mascara qualquer e-mail que apareça dentro de uma mensagem de erro alheia. */
const mascararEmailsNoTexto = (texto: string): string =>
  texto.replace(REGEX_EMAIL, (achado) => mascararEmail(achado))

// ── HTML → texto puro ───────────────────────────────────────────────────────

const ENTIDADES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
}

/**
 * Versão em texto puro do e-mail.
 *
 * Existe por dois motivos práticos: filtro de spam pontua melhor mensagem com
 * as duas versões, e cliente de e-mail em modo texto (ou leitor de tela mal
 * configurado) mostraria a tag crua sem isso. Os links viram `texto (url)`
 * para que o destinatário consiga clicar/copiar mesmo sem HTML.
 */
export function htmlParaTexto(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, url: string, texto: string) => {
      const rotulo = texto.replace(/<[^>]+>/g, '').trim()
      return rotulo && rotulo !== url ? `${rotulo} (${url})` : url
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h1|h2|h3|li|table)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTIDADES[e.toLowerCase()] ?? e)
    .split('\n')
    .map((linha) => linha.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ── Classificação de falha ──────────────────────────────────────────────────

interface Falha {
  mensagem: string
  /** Vale a pena tentar de novo? Chave inválida, não. Resend fora do ar, sim. */
  transitorio: boolean
}

function descreverFalha(err: unknown): Falha {
  const e = err as { message?: string; status?: number; cause?: unknown }
  const status = typeof e?.status === 'number' ? e.status : undefined
  const bruta = e?.message ?? String(err)
  const mensagem = mascararEmailsNoTexto(bruta).slice(0, 300)

  // Sem status = erro de rede/DNS/timeout: quase sempre passageiro.
  // 429 = estouro de cota por segundo do Resend. 5xx = problema deles.
  // 4xx restante (401 chave errada, 403 domínio não verificado, 422 endereço
  // inválido) não melhora tentando de novo — só atrasa a resposta ao cliente.
  const transitorio = status === undefined || status === 429 || status >= 500

  return { mensagem, transitorio }
}

const esperar = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// ── Envio ───────────────────────────────────────────────────────────────────

/**
 * Envia um e-mail transacional. Não lança: devolve o resultado.
 *
 * @example
 * const r = await enviarEmailTransacional({
 *   payload, tipo: 'senha-alterada', para: user.email,
 *   assunto: 'Sua senha foi alterada', html,
 * })
 * if (!r.enviado) payload.logger.warn('avisar o cliente depois')
 */
export async function enviarEmailTransacional(args: EmailTransacional): Promise<ResultadoEnvio> {
  const { payload, para, assunto, html, tipo } = args
  const texto = args.texto ?? htmlParaTexto(html)
  const simulado = payload.email?.name === 'console'
  const destino = mascararEmail(para)

  if (!para || !REGEX_EMAIL.test(para)) {
    REGEX_EMAIL.lastIndex = 0
    payload.logger.error(`[email] endereço inválido tipo=${tipo} para=${destino}`)
    return { enviado: false, erro: 'Endereço de e-mail inválido.', simulado }
  }
  REGEX_EMAIL.lastIndex = 0

  const replyTo = await enderecoDeResposta(payload)

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      await payload.sendEmail({
        to: para,
        subject: assunto,
        html,
        text: texto,
        ...(replyTo ? { replyTo } : {}),
      })

      payload.logger.info(
        `[email] enviado tipo=${tipo} para=${destino} tentativa=${tentativa}` +
          (simulado ? ' ATENÇÃO=SIMULADO (adapter de console — nada saiu de verdade)' : ''),
      )
      return { enviado: true, simulado }
    } catch (err) {
      const { mensagem, transitorio } = descreverFalha(err)
      const desistir = !transitorio || tentativa === TENTATIVAS

      const linha =
        `[email] falha tipo=${tipo} para=${destino} ` +
        `tentativa=${tentativa}/${TENTATIVAS} transitorio=${transitorio}: ${mensagem}`

      if (desistir) {
        payload.logger.error(linha)
        return { enviado: false, erro: mensagem, simulado }
      }

      payload.logger.warn(linha)
      await esperar(ESPERA_ENTRE_TENTATIVAS_MS * tentativa)
    }
  }

  return { enviado: false, erro: 'Falha desconhecida ao enviar o e-mail.', simulado }
}
