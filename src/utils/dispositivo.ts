import type { PayloadRequest } from 'payload'

import { hashDeConteudo } from './tokens'
import { ipDoRequest } from './rateLimit'

/* ────────────────────────────────────────────────────────────────────────────
   Reconhecimento aproximado de dispositivo, para o aviso de novo acesso.

   Duas coisas moram aqui: a DESCRIÇÃO que o cliente lê ("Chrome no Windows") e
   a IMPRESSÃO DIGITAL que decide se o aviso deve sair.

   Nada disso é identificação forte — user agent é texto que o navegador diz de
   si mesmo e pode ser trocado. Serve para o propósito real: evitar avisar dez
   vezes por dia quem entra do mesmo lugar, e avisar quando algo muda.
   ──────────────────────────────────────────────────────────────────────────── */

// ── Descrição legível ────────────────────────────────────────────────────────

const NAVEGADORES: Array<[RegExp, string]> = [
  [/\bEdg\//i, 'Edge'],
  [/\bOPR\/|\bOpera\b/i, 'Opera'],
  [/\bFirefox\//i, 'Firefox'],
  [/\bSamsungBrowser\//i, 'Samsung Internet'],
  // Chrome precisa vir depois de Edge/Opera: os dois se anunciam como Chrome.
  [/\bChrome\//i, 'Chrome'],
  [/\bSafari\//i, 'Safari'],
]

const SISTEMAS: Array<[RegExp, string]> = [
  [/\biPhone\b/i, 'iPhone'],
  [/\biPad\b/i, 'iPad'],
  [/\bAndroid\b/i, 'Android'],
  [/\bWindows\b/i, 'Windows'],
  [/\bMac OS X\b|\bMacintosh\b/i, 'Mac'],
  [/\bLinux\b/i, 'Linux'],
]

/**
 * "Chrome no Windows", "Safari no iPhone", ou "dispositivo não identificado".
 *
 * Sem versão, sem número de build, sem a string crua: o cliente precisa
 * reconhecer o próprio aparelho, e `Mozilla/5.0 (Windows NT 10.0; Win64; x64)`
 * não ajuda ninguém a decidir se foi ele ou não.
 */
export function descreverDispositivo(userAgent: string | null | undefined): string {
  const ua = userAgent ?? ''
  if (!ua) return 'dispositivo não identificado'

  const navegador = NAVEGADORES.find(([re]) => re.test(ua))?.[1]
  const sistema = SISTEMAS.find(([re]) => re.test(ua))?.[1]

  if (navegador && sistema) return `${navegador} no ${sistema}`
  if (navegador) return navegador
  if (sistema) return sistema
  return 'dispositivo não identificado'
}

// ── Local aproximado ─────────────────────────────────────────────────────────

/**
 * Cidade e estado a partir dos cabeçalhos que a Vercel injeta.
 *
 * Não faz consulta a serviço externo de propósito: seria mais uma chamada de
 * rede dentro do login, mais um terceiro recebendo o IP dos clientes, e mais
 * uma coisa para declarar na política de privacidade. Quando a informação não
 * está no cabeçalho, o aviso simplesmente sai sem o local.
 */
export function localAproximado(req: PayloadRequest): string | null {
  const cidade = req.headers.get('x-vercel-ip-city')
  const regiao = req.headers.get('x-vercel-ip-country-region')
  const pais = req.headers.get('x-vercel-ip-country')

  const decodificado = cidade ? decodeURIComponent(cidade) : null
  const partes = [decodificado, regiao, pais].filter(Boolean)
  return partes.length > 0 ? partes.join(', ') : null
}

/**
 * IP encurtado para exibição: `189.45.12.x`.
 *
 * O IP completo não vai no e-mail. Ele identifica a conexão de quem lê, e um
 * e-mail é copiado, encaminhado e fica na caixa de entrada para sempre — não é
 * lugar de guardar o endereço exato de ninguém. Os três primeiros blocos já
 * dizem ao cliente se o acesso veio de perto ou de outro lugar, que é a única
 * pergunta que ele precisa responder.
 */
export function ipParaExibir(ip: string): string {
  if (ip === 'desconhecido') return 'origem desconhecida'
  if (ip.includes(':')) {
    // IPv6: mantém o prefixo de rede e descarta o resto.
    const blocos = ip.split(':').filter(Boolean)
    return blocos.length > 2 ? `${blocos.slice(0, 2).join(':')}:…` : 'origem desconhecida'
  }
  const partes = ip.split('.')
  return partes.length === 4 ? `${partes.slice(0, 3).join('.')}.x` : 'origem desconhecida'
}

// ── Impressão digital ────────────────────────────────────────────────────────

/**
 * Identificador estável do par navegador + rede aproximada.
 *
 * Usa apenas os três primeiros blocos do IPv4 (a "vizinhança", /24) em vez do
 * endereço exato. Sem isso, quem usa celular na rua trocaria de IP a cada
 * quarteirão e receberia aviso de novo acesso o dia inteiro — o excesso de
 * alerta treina a pessoa a ignorar todos, inclusive o que importa.
 *
 * Guardamos o HASH, nunca o user agent e o IP em si: o objetivo é comparar
 * "é o mesmo de antes?", e para isso o hash basta.
 */
export function impressaoDoDispositivo(userAgent: string | null | undefined, ip: string): string {
  const rede = ip.includes(':')
    ? ip.split(':').filter(Boolean).slice(0, 2).join(':')
    : ip.split('.').slice(0, 3).join('.')
  return hashDeConteudo(`${descreverDispositivo(userAgent)}|${rede}`)
}

export interface AcessoAtual {
  impressao: string
  descricao: string
  local: string | null
  ipExibicao: string
}

/** Reúne tudo o que o aviso de acesso precisa saber sobre a requisição. */
export function lerAcesso(req: PayloadRequest): AcessoAtual {
  const userAgent = req.headers.get('user-agent')
  const ip = ipDoRequest(req)
  return {
    impressao: impressaoDoDispositivo(userAgent, ip),
    descricao: descreverDispositivo(userAgent),
    local: localAproximado(req),
    ipExibicao: ipParaExibir(ip),
  }
}
