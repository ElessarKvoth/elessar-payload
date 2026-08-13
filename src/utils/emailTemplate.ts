// Template HTML compartilhado pelos e-mails transacionais (verificação de conta,
// redefinição de senha). Estilo inline porque clientes de e-mail ignoram <style>
// externo e a maioria descarta classes CSS.

export interface EmailBaseArgs {
  titulo: string
  saudacao?: string
  corpo: string
  botaoTexto: string
  botaoUrl: string
  rodape?: string
}

// URL pública da loja (para onde os links do e-mail apontam). FRONTEND_URL aceita
// várias separadas por vírgula — usamos a primeira.
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

export function emailBase({
  titulo,
  saudacao,
  corpo,
  botaoTexto,
  botaoUrl,
  rodape,
}: EmailBaseArgs): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapar(titulo)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0c0a08;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0c0a08;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#14110d;border:1px solid #2a241b;">
            <tr>
              <td style="height:3px;background:linear-gradient(to right,#14110d,#c9a227,#14110d);font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:36px 36px 28px 36px;">
                <p style="margin:0 0 20px 0;font-size:10px;font-weight:bold;letter-spacing:4px;text-transform:uppercase;color:#6b5f45;">
                  Elessar Records
                </p>
                <h1 style="margin:0 0 20px 0;font-size:26px;line-height:1.2;font-weight:800;text-transform:uppercase;color:#e8e0d0;">
                  ${escapar(titulo)}
                </h1>
                ${
                  saudacao
                    ? `<p style="margin:0 0 12px 0;font-size:15px;color:#c9bfa8;">${escapar(saudacao)},</p>`
                    : ''
                }
                <p style="margin:0 0 28px 0;font-size:14px;line-height:1.7;color:#a89e88;">
                  ${escapar(corpo)}
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background-color:#c9a227;">
                      <a href="${escapar(botaoUrl)}"
                         style="display:inline-block;padding:14px 32px;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#0c0a08;text-decoration:none;">
                        ${escapar(botaoTexto)}
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:28px 0 0 0;font-size:12px;line-height:1.6;color:#6b5f45;">
                  Se o botão não funcionar, copie e cole este endereço no navegador:<br />
                  <a href="${escapar(botaoUrl)}" style="color:#c9a227;word-break:break-all;">${escapar(botaoUrl)}</a>
                </p>
              </td>
            </tr>
            ${
              rodape
                ? `<tr>
              <td style="padding:0 36px 32px 36px;border-top:1px solid #2a241b;">
                <p style="margin:20px 0 0 0;font-size:12px;line-height:1.6;color:#5a5040;">
                  ${escapar(rodape)}
                </p>
              </td>
            </tr>`
                : ''
            }
          </table>
          <p style="margin:24px 0 0 0;font-size:11px;color:#4a4234;">
            Elessar Records — Vinil, Metal &amp; Underground
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
