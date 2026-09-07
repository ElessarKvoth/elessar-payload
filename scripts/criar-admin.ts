import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { listaAdminEmails } from '../src/utils/adminEmails'
import { cpfValido } from '../src/utils/validarCpf'

// Cria (ou atualiza a senha d)o usuário administrador a partir do .env.
// Idempotente: rodar de novo apenas redefine a senha.
//
//   npm run admin:create
//
// .env necessário:
//   ADMIN_EMAILS=dono@elessarrecords.com.br
//   ADMIN_PASSWORD=umaSenhaForte
//   ADMIN_NAME=Nome do Dono        (opcional)
//   ADMIN_CPF=00000000000          (obrigatório: CPF é required na collection)

const emails = listaAdminEmails()
const senha = process.env.ADMIN_PASSWORD
const nome = process.env.ADMIN_NAME ?? 'Administrador'
const cpf = (process.env.ADMIN_CPF ?? '').replace(/\D/g, '')

if (emails.length === 0) {
  console.error('\n❌ ADMIN_EMAILS não definido no .env.')
  console.error('   Ex: ADMIN_EMAILS=dono@elessarrecords.com.br\n')
  process.exit(1)
}
if (!senha || senha.length < 8) {
  console.error('\n❌ ADMIN_PASSWORD ausente ou com menos de 8 caracteres.\n')
  process.exit(1)
}
if (!cpfValido(cpf)) {
  console.error('\n❌ ADMIN_CPF ausente ou inválido (precisa ser um CPF real, com dígitos verificadores corretos).\n')
  process.exit(1)
}

const payload = await getPayload({ config })

// Só o primeiro e-mail da lista vira conta de login; os demais viram admin
// automaticamente assim que se cadastrarem pela loja.
const email = emails[0]!

const existente = await payload.find({
  collection: 'users',
  where: { email: { equals: email } },
  limit: 1,
  overrideAccess: true,
})

if (existente.docs.length > 0) {
  await payload.update({
    collection: 'users',
    id: existente.docs[0]!.id,
    data: { password: senha },
    overrideAccess: true,
  })
  console.log(`\n✅ Senha do administrador redefinida: ${email}\n`)
} else {
  await payload.create({
    collection: 'users',
    data: {
      name: nome,
      email,
      password: senha,
      cpf,
      _verified: true,
    },
    overrideAccess: true,
  })
  console.log(`\n✅ Administrador criado: ${email}`)
  console.log('   Entre em /admin com esse e-mail e a senha do .env.\n')
}

if (emails.length > 1) {
  console.log(`ℹ️  Outros e-mails em ADMIN_EMAILS (${emails.slice(1).join(', ')}) viram admin`)
  console.log('   automaticamente assim que criarem conta pela loja.\n')
}

process.exit(0)
