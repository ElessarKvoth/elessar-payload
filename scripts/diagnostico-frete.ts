import 'dotenv/config'

// Diagnóstico: descobre quais serviços a SuperFrete devolve para a sua conta e
// com quais IDs. Use quando uma transportadora ativada no painel não aparecer
// na loja. Não grava nada — só consulta e imprime.
//
//   npm run frete:diag            (usa CEP padrão)
//   npm run frete:diag 01310100   (CEP de destino específico)

const token = process.env.SUPERFRETE_TOKEN
if (!token) {
  console.error('❌ SUPERFRETE_TOKEN não encontrado no .env')
  process.exit(1)
}

const base =
  process.env.SUPERFRETE_ENV === 'production'
    ? 'https://api.superfrete.com'
    : 'https://sandbox.superfrete.com'

const cepOrigem = (process.env.CEP_ORIGEM_DIAG ?? '13084551').replace(/\D/g, '')
const cepDestino = (process.argv[2] ?? '01310100').replace(/\D/g, '')

// Pacote típico de 1 disco de vinil.
const pacote = { height: 3, width: 33, length: 33, weight: 0.35 }

interface Opcao {
  id?: number
  name?: string
  price?: number | string
  error?: string
  delivery_time?: number
  company?: { name?: string }
}

async function consultar(rotulo: string, services?: string): Promise<void> {
  const body: Record<string, unknown> = {
    from: { postal_code: cepOrigem },
    to: { postal_code: cepDestino },
    package: pacote,
  }
  if (services) body.services = services

  console.log(`\n━━━ ${rotulo} ━━━`)
  try {
    const resp = await fetch(`${base}/api/v0/calculator`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': `Elessar Records (${process.env.SUPERFRETE_USER_AGENT_EMAIL ?? ''})`,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      console.log(`  ❌ HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`)
      return
    }

    const dados = (await resp.json()) as Opcao[]
    if (!Array.isArray(dados) || dados.length === 0) {
      console.log('  (resposta vazia)')
      return
    }

    for (const o of dados) {
      const transportadora = o.company?.name ?? '?'
      if (o.error) {
        console.log(`  ⛔ id=${String(o.id).padEnd(3)} ${transportadora} / ${o.name} → ${o.error}`)
      } else {
        console.log(
          `  ✅ id=${String(o.id).padEnd(3)} ${transportadora} / ${o.name} → R$ ${o.price} (${o.delivery_time ?? '?'} dias)`,
        )
      }
    }
  } catch (err) {
    console.log(`  ❌ Falha: ${(err as Error).message}`)
  }
}

console.log(`Origem ${cepOrigem} → Destino ${cepDestino}  |  ambiente: ${base}`)

// 1) Sem filtro: o que a conta devolve por padrão.
await consultar('SEM o parâmetro "services"')
// 2) Com uma lista ampla: força a API a avaliar cada serviço e revela os IDs
//    válidos (os inválidos/desabilitados voltam com erro).
await consultar('COM services=1,2,3,4,5,17,31,32,33', '1,2,3,4,5,17,31,32,33')

console.log('\n👉 Anote os IDs marcados com ✅ — são os serviços ativos na sua conta.\n')
process.exit(0)
