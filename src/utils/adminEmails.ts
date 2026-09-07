// Fonte única da verdade sobre quem é administrador.
//
// O papel de admin NÃO é concedido pelo banco nem pelo painel — ele é derivado
// do e-mail estar na variável ADMIN_EMAILS do servidor. Consequência prática:
// mesmo quem invadir uma conta ou alterar o banco não vira admin, porque o hook
// de Users recalcula o papel a cada gravação a partir desta lista.
//
// .env:
//   ADMIN_EMAILS=dono@elessarrecords.com.br
//   ADMIN_EMAILS=dono@x.com,socio@x.com   (vários, separados por vírgula)

export function listaAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function emailEhAdmin(email?: string | null): boolean {
  const alvo = (email ?? '').trim().toLowerCase()
  if (!alvo) return false
  return listaAdminEmails().includes(alvo)
}
