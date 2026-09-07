import { emailBase, storefrontUrl } from './emailTemplate'

/**
 * Assunto e corpo do e-mail de confirmação de conta, em um lugar só.
 *
 * Usado nos DOIS caminhos: o e-mail automático que o Payload dispara no
 * cadastro (`auth.verify.generateEmailHTML`) e o reenvio pelo endpoint
 * próprio. Enquanto eram dois textos separados, dava para o reenvio apontar
 * para uma URL antiga sem ninguém notar.
 *
 * Sem `crypto` aqui de propósito: este arquivo é importado pela collection, e
 * a collection é lida também na montagem do painel.
 */

/**
 * Validade do link de confirmação.
 *
 * O Payload não expira token de verificação — `verifyEmailOperation` só
 * compara `_verificationToken`, sem olhar data nenhuma. Na prática o link do
 * e-mail de cadastro valia para sempre, o que é ruim: um e-mail antigo,
 * encaminhado ou vazado, ativa a conta anos depois.
 *
 * 24 horas é folgado para quem confirma no mesmo dia e curto para um link
 * esquecido na caixa de entrada. Quem perder o prazo pede outro pelo endpoint
 * de reenvio — é justamente por existir essa saída que dá para ser rígido aqui.
 */
export const PRAZO_VERIFICACAO_HORAS = 24
export const PRAZO_VERIFICACAO_MS = PRAZO_VERIFICACAO_HORAS * 60 * 60 * 1000

/** URL que o cliente abre para confirmar. O front trata os estados da resposta. */
export const linkDeVerificacao = (token: string): string =>
  `${storefrontUrl()}/verificar-email?token=${encodeURIComponent(token)}`

export interface ArgsEmailVerificacao {
  nome?: string | null
  token: string
  /** `true` quando é reenvio pedido pelo cliente, não o e-mail do cadastro. */
  reenvio?: boolean
}

export function emailDeVerificacao({ nome, token, reenvio }: ArgsEmailVerificacao): {
  assunto: string
  html: string
} {
  const saudacao = `Olá, ${nome ?? ''}`.trim()

  return {
    assunto: reenvio
      ? 'Seu novo link de confirmação — Elessar Records'
      : 'Confirme sua conta — Elessar Records',
    html: emailBase({
      titulo: reenvio ? 'Novo link de confirmação' : 'Bem-vindo à Elessar Records',
      saudacao: saudacao === 'Olá,' ? undefined : saudacao,
      corpo: reenvio
        ? `Você pediu um novo link para confirmar seu e-mail. O botão abaixo vale por ${PRAZO_VERIFICACAO_HORAS} horas. ` +
          'Links enviados antes deste deixaram de funcionar.'
        : `Sua conta foi criada. Para começar a comprar, confirme seu e-mail no botão abaixo — ele vale por ${PRAZO_VERIFICACAO_HORAS} horas.`,
      botaoTexto: 'Confirmar meu e-mail',
      botaoUrl: linkDeVerificacao(token),
      rodape: reenvio
        ? 'Se não foi você que pediu, ignore este e-mail: sem clicar no botão, nada muda na conta.'
        : 'Se você não criou esta conta, pode ignorar este e-mail.',
    }),
  }
}
