import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

// Temporário: cria/inspeciona/apaga a conta usada para testar as Etapas 3 e 4.

const EMAIL = 'teste-etapas34@exemplo.invalido'
const payload = await getPayload({ config })
const acao = process.argv[2]

if (acao === 'criar') {
  const doc = await payload.create({
    collection: 'users',
    data: {
      name: 'Teste Acessos',
      email: EMAIL,
      password: 'senhaDeTeste123',
      cpf: '52998224725',
      aceitouTermos: true,
      _verified: true,
    },
    overrideAccess: true,
    disableVerificationEmail: true,
    context: { pularAceiteDeTermos: true },
  })
  console.log(`criada id=${(doc as { id: unknown }).id}`)
} else if (acao === 'ver') {
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: EMAIL } },
    overrideAccess: true,
    showHiddenFields: true,
    depth: 0,
  })
  const u = docs[0] as unknown as {
    acessosRecentes?: Array<Record<string, unknown>>
    dispositivosConhecidos?: Array<Record<string, unknown>>
    sessions?: unknown[]
  }
  console.log(`sessões ativas: ${u?.sessions?.length ?? 0}`)
  console.log(`aparelhos reconhecidos: ${u?.dispositivosConhecidos?.length ?? 0}`)
  console.log(`acessos no histórico: ${u?.acessosRecentes?.length ?? 0}`)
  for (const a of u?.acessosRecentes ?? []) {
    console.log(`  · ${a.dispositivo} | origem ${a.origem} | avisou=${a.avisoEnviado}`)
  }
} else {
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: EMAIL } },
    overrideAccess: true,
  })
  for (const d of docs) await payload.delete({ collection: 'users', id: d.id, overrideAccess: true })
  console.log(`apagadas: ${docs.length}`)
}

process.exit(0)
