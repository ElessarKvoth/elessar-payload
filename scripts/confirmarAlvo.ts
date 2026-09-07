import 'dotenv/config'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

/**
 * Trava de segurança para os scripts que destroem dados.
 *
 * O `DATABASE_URI` deste projeto aponta para o Neon — o MESMO banco que a
 * Vercel usa em produção. Ou seja: `npm run reset:db` e `npm run clear` rodam
 * contra o acervo real, não contra um banco de brincadeira. Antes disso não
 * havia confirmação nenhuma: um comando errado no terminal apagava tudo.
 *
 * Quando o alvo é remoto, exige digitar o nome do banco por extenso. Em
 * localhost passa direto, porque lá não há nada a perder.
 */

export interface AlvoDoBanco {
  url: string
  host: string
  banco: string
  local: boolean
}

export function alvoDoBanco(): AlvoDoBanco {
  const url =
    process.env.DATABASE_URI || process.env.DATABASE_URL || process.env.POSTGRES_URL || ''

  if (!url) {
    console.error('✗ DATABASE_URI não encontrada no .env.')
    process.exit(1)
  }

  try {
    const u = new URL(url)
    const host = u.hostname
    return {
      url,
      host,
      banco: u.pathname.replace(/^\//, '') || '(padrão)',
      local: /^(localhost|127\.0\.0\.1|::1)$/.test(host),
    }
  } catch {
    // URL ilegível: trata como remoto, que é o lado seguro do erro.
    return { url, host: '(desconhecido)', banco: '(desconhecido)', local: false }
  }
}

/**
 * Interrompe o processo a menos que a pessoa digite o nome do banco.
 * `acao` descreve o estrago em uma linha, para aparecer no aviso.
 */
export async function exigirConfirmacao(acao: string): Promise<AlvoDoBanco> {
  const alvo = alvoDoBanco()

  if (alvo.local) {
    console.log(`→ Banco local (${alvo.host}). Seguindo sem confirmação.`)
    return alvo
  }

  console.log('')
  console.log('  ┌─────────────────────────────────────────────────────────┐')
  console.log('  │  ATENÇÃO: o alvo é um banco REMOTO                      │')
  console.log('  └─────────────────────────────────────────────────────────┘')
  console.log(`     host:  ${alvo.host}`)
  console.log(`     banco: ${alvo.banco}`)
  console.log('')
  console.log(`     Ação: ${acao}`)
  console.log('')
  console.log('     Este é o mesmo banco que o site em produção usa.')
  console.log('     Se houver acervo cadastrado, ele será perdido.')
  console.log('')

  if (!stdin.isTTY) {
    console.error('✗ Sem terminal interativo para confirmar. Abortado por segurança.')
    process.exit(1)
  }

  const rl = createInterface({ input: stdin, output: stdout })
  const resposta = await rl.question(`     Digite o nome do banco (${alvo.banco}) para continuar: `)
  rl.close()

  if (resposta.trim() !== alvo.banco) {
    console.log('\n✓ Cancelado. Nada foi alterado.\n')
    process.exit(0)
  }

  console.log('')
  return alvo
}
