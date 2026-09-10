import type { Payload } from 'payload'

import { dadosDaEmpresa, dataHoraBr, emailBase, storefrontUrl } from './emailTemplate'
import { enviarEmailTransacional } from './enviarEmail'

/* ────────────────────────────────────────────────────────────────────────────
   E-mails que falam sobre a segurança da conta.

   Todos seguem a mesma regra: NUNCA carregam senha, token, código nem o IP
   completo. Um e-mail é encaminhado, fica na caixa de entrada por anos e pode
   vazar num vazamento de provedor — o que estiver escrito nele é o que o
   atacante ganha de graça.
   ──────────────────────────────────────────────────────────────────────────── */

const linkTrocarSenha = (): string => `${storefrontUrl()}/?recuperar=1`

// ── Novo acesso ──────────────────────────────────────────────────────────────

export interface AvisoDeAcesso {
  payload: Payload
  para: string
  nome?: string | null
  quando: Date
  dispositivo: string
  local: string | null
  ipExibicao: string
}

export async function enviarAvisoDeNovoAcesso(args: AvisoDeAcesso): Promise<void> {
  const { payload, para, nome, quando, dispositivo, local, ipExibicao } = args
  const empresa = await dadosDaEmpresa(payload)

  const detalhes = [
    { rotulo: 'Quando', valor: dataHoraBr(quando) },
    { rotulo: 'Aparelho', valor: dispositivo },
    ...(local ? [{ rotulo: 'Local aproximado', valor: local }] : []),
    { rotulo: 'Origem', valor: ipExibicao },
  ]

  const html = emailBase({
    empresa,
    titulo: 'Novo acesso à sua conta',
    saudacao: nome ? `Olá, ${nome}` : undefined,
    corpo: [
      'Alguém entrou na sua conta agora. Se foi você, pode ignorar este e-mail — ele existe só para você ficar sabendo.',
      'O horário abaixo está no fuso de Brasília.',
    ],
    detalhes,
    botaoTexto: 'Não foi você? Troque sua senha',
    botaoUrl: linkTrocarSenha(),
    rodape:
      'Trocar a senha desconecta todos os aparelhos, inclusive o de quem entrou sem sua permissão. ' +
      'Nunca pedimos sua senha por e-mail ou mensagem.',
  })

  await enviarEmailTransacional({
    payload,
    tipo: 'aviso-novo-acesso',
    para,
    assunto: 'Novo acesso à sua conta — Elessar Records',
    html,
  })
}

// ── Senha alterada ───────────────────────────────────────────────────────────

/**
 * Aviso OBRIGATÓRIO após qualquer troca de senha.
 *
 * É a última linha de defesa contra a tomada silenciosa de conta: quem invadiu
 * e trocou a senha tranca o dono para fora, e sem este e-mail o dono só
 * descobre quando tenta entrar — que pode ser semanas depois, com pedidos já
 * feitos no cartão dele.
 */
export async function enviarAvisoDeSenhaAlterada(args: {
  payload: Payload
  para: string
  nome?: string | null
  quando: Date
  dispositivo?: string
  local?: string | null
}): Promise<void> {
  const { payload, para, nome, quando, dispositivo, local } = args
  const empresa = await dadosDaEmpresa(payload)

  const html = emailBase({
    empresa,
    titulo: 'Sua senha foi alterada',
    saudacao: nome ? `Olá, ${nome}` : undefined,
    corpo: [
      'A senha da sua conta acabou de ser alterada. Todos os aparelhos conectados foram desconectados, e é preciso entrar de novo com a senha nova.',
      'Se foi você quem trocou, está tudo certo e não é preciso fazer mais nada.',
    ],
    detalhes: [
      { rotulo: 'Quando', valor: dataHoraBr(quando) },
      ...(dispositivo ? [{ rotulo: 'Aparelho', valor: dispositivo }] : []),
      ...(local ? [{ rotulo: 'Local aproximado', valor: local }] : []),
    ],
    botaoTexto: 'Não foi você? Recupere sua conta',
    botaoUrl: linkTrocarSenha(),
    rodape:
      'Se você NÃO trocou a senha, use o botão acima imediatamente para definir uma nova e retomar o acesso. ' +
      'Nunca pedimos sua senha por e-mail ou mensagem.',
  })

  await enviarEmailTransacional({
    payload,
    tipo: 'senha-alterada',
    para,
    assunto: 'Sua senha foi alterada — Elessar Records',
    html,
  })
}

// ── Boas-vindas ──────────────────────────────────────────────────────────────

export async function enviarBoasVindas(args: {
  payload: Payload
  para: string
  nome?: string | null
}): Promise<void> {
  const { payload, para, nome } = args
  const empresa = await dadosDaEmpresa(payload)

  const html = emailBase({
    empresa,
    titulo: 'Conta confirmada',
    saudacao: nome ? `Olá, ${nome}` : undefined,
    corpo: [
      'Seu e-mail foi confirmado e sua conta está liberada para comprar.',
      'A partir de agora você acompanha seus pedidos, salva endereços de entrega e recebe o código de rastreio assim que o disco for postado.',
    ],
    botaoTexto: 'Ver o catálogo',
    botaoUrl: `${storefrontUrl()}/catalogo`,
    rodape: 'Bom garimpo.',
  })

  await enviarEmailTransacional({
    payload,
    tipo: 'boas-vindas',
    para,
    assunto: 'Bem-vindo à Elessar Records',
    html,
  })
}
