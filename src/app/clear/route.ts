import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { runClear } from '@/utils/seedHelpers'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export const GET = async () => {
  // Esta rota apaga discos, vestuário, pedidos, imagens, artistas e todos os
  // usuários que não são admin — sem pedir login. Por ser GET, dispara sozinha:
  // basta um prefetch do navegador, um crawler ou alguém abrindo o link.
  // Enquanto o banco só tinha dados de teste isso era aceitável; com o acervo
  // real cadastrado, é a única falha do projeto com perda total e irreversível.
  // Continua liberada em desenvolvimento; para limpar produção, use o script
  // local `npm run clear`, que exige acesso ao terminal.
  if (process.env.NODE_ENV === 'production') {
    return new Response(null, { status: 404 })
  }

  try {
    const payload = await getPayload({ config: configPromise })
    const counts = await runClear(payload)
    return Response.json({ ok: true, cleared: counts })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
