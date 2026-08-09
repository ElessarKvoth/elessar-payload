import type { CollectionConfig, CollectionSlug, NumberField } from 'payload'
import { APIError } from 'payload'

import { isAdmin, isAdminOrCustomer } from '../access/isAdmin'
import { cpfValido } from '../utils/validarCpf'
import { criarEtiquetaSuperFrete } from '../utils/criarEtiquetaSuperFrete'
import { construirPacoteDoPedido } from '../utils/construirPacoteDoPedido'
import { cotarSuperFrete } from '../utils/cotarSuperFrete'
import type { Order } from '../payload-types'

// Forma dos itens recebidos no create (antes da validação do Payload).
type ItemPedidoEntrada = {
  product?: {
    relationTo?: 'records' | 'apparel'
    value?: number | string | { id: number | string }
  }
  quantity?: number
  variantSize?: string | null
  variantColor?: string | null
  unitPrice?: number
}

const idDoValue = (v: number | string | { id: number | string } | undefined): number | string =>
  typeof v === 'object' && v !== null ? v.id : (v as number | string)

// TODO: Integrar gateway de pagamento (Mercado Pago) — guardar ID em idPagamentoMercadoPago.
// TODO: Implementar sistema de cupons — validar código e aplicar desconto aqui.

// CollectionSlug casts required until `payload generate:types` is run with all collections registered.
const RECORDS_SLUG = 'records' as CollectionSlug
const APPAREL_SLUG = 'apparel' as CollectionSlug
const USERS_SLUG = 'users' as CollectionSlug

const ORDER_STATUSES = [
  { label: 'Aguardando pagamento', value: 'aguardando_pagamento' },
  { label: 'Pago', value: 'pago' },
  { label: 'Etiqueta criada', value: 'etiqueta_criada' },
  { label: 'Enviado', value: 'enviado' },
  { label: 'Entregue', value: 'entregue' },
  { label: 'Cancelado', value: 'cancelado' },
  { label: 'Reembolsado', value: 'reembolsado' },
]

const PAYMENT_METHODS = [
  { label: 'PIX', value: 'pix' },
  { label: 'Cartão de Crédito', value: 'credit_card' },
  { label: 'Boleto', value: 'boleto' },
  { label: 'Outro', value: 'other' },
]

const PAYMENT_STATUSES = [
  { label: 'Não Pago', value: 'unpaid' },
  { label: 'Pago', value: 'paid' },
  { label: 'Reembolsado', value: 'refunded' },
  { label: 'Chargeback', value: 'chargeback' },
]

type OrderItem = {
  // Polymorphic: product can be a record or an apparel item
  product: { value: string | { id: string }; relationTo: 'records' | 'apparel' }
  quantity: number
  // Apparel variant info — required when product is apparel
  variantSize?: string | null
  variantColor?: string | null
  productTitle: string
  productSku: string
  unitPrice: number
}

type RecordSnapshot = { stock: number; title: string; sku: string }

type ApparelVariant = { size: string; color?: string | null; stock: number }
type ApparelSnapshot = { title: string; sku: string; variants: ApparelVariant[] }

export const Orders: CollectionConfig = {
  slug: 'orders',
  labels: {
    singular: 'Pedido',
    plural: 'Pedidos',
  },
  admin: {
    useAsTitle: 'orderNumber',
    group: 'Vendas',
    description: 'Acompanhe e gerencie todos os pedidos da loja.',
    defaultColumns: ['orderNumber', 'customer', 'total', 'status', 'statusEtiqueta', 'createdAt'],
  },
  access: {
    read: isAdminOrCustomer,
    create: ({ req: { user } }) => Boolean(user),
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [
      async ({ data, req, operation, context }) => {
        if (!data) return data

        // Gera número do pedido automaticamente
        if (operation === 'create' && !data.orderNumber) {
          data.orderNumber = `ER-${Date.now()}`
        }

        // Força customer = usuário logado em create (evita impersonação)
        if (operation === 'create' && req.user && !data.customer) {
          data.customer = req.user.id
        }

        // Valida o destinatário na criação (Correios exigem CPF e endereço na etiqueta)
        if (operation === 'create') {
          const dest = (data.destinatario ?? {}) as Record<string, unknown>
          const obrigatorios: Array<[string, string]> = [
            ['nome', 'Nome do destinatário'],
            ['cpf', 'CPF'],
            ['email', 'E-mail'],
            ['telefone', 'Telefone'],
            ['cep', 'CEP'],
            ['rua', 'Rua'],
            ['numero', 'Número'],
            ['bairro', 'Bairro'],
            ['cidade', 'Cidade'],
            ['uf', 'UF'],
          ]
          for (const [campo, rotulo] of obrigatorios) {
            const v = dest[campo]
            if (typeof v !== 'string' || v.trim() === '') {
              throw new APIError(`${rotulo} é obrigatório.`, 400)
            }
          }
          if (!cpfValido(dest.cpf as string)) {
            throw new APIError('CPF inválido.', 400)
          }
          if ((dest.cep as string).replace(/\D/g, '').length !== 8) {
            throw new APIError('CEP inválido. Informe 8 dígitos.', 400)
          }
        }

        // ── SEGURANÇA: reprecifica itens no servidor (create) ─────────────────
        // O cliente envia unitPrice apenas por conveniência; o valor que vale é
        // SEMPRE o preço atual do banco. Também valida disponibilidade/estoque.
        if (operation === 'create' && Array.isArray(data.items)) {
          for (const item of data.items as ItemPedidoEntrada[]) {
            const relacao = item.product?.relationTo
            const produtoId = idDoValue(item.product?.value)
            const qtd = item.quantity ?? 0
            if (!relacao || produtoId == null || qtd < 1) {
              throw new APIError('Item do pedido inválido.', 400)
            }

            if (relacao === 'apparel') {
              const ap = await req.payload
                .findByID({ collection: APPAREL_SLUG, id: produtoId, depth: 0, req })
                .catch(() => null)
              const apparel = ap as unknown as (ApparelSnapshot & { price: number; salePrice?: number | null; active?: boolean }) | null
              if (!apparel || apparel.active === false) {
                throw new APIError('Um dos produtos do pedido não está mais disponível.', 400)
              }
              const variant = apparel.variants.find(
                (v) => v.size === item.variantSize && (!item.variantColor || v.color === item.variantColor),
              )
              if (!variant) throw new APIError(`Variante indisponível para "${apparel.title}".`, 400)
              if (variant.stock < qtd) {
                throw new APIError(`Estoque insuficiente para "${apparel.title}" (tam. ${item.variantSize}).`, 400)
              }
              const precoReais =
                apparel.salePrice != null && apparel.salePrice < apparel.price ? apparel.salePrice : apparel.price
              item.unitPrice = Math.round(precoReais * 100)
            } else {
              const rec = await req.payload
                .findByID({ collection: RECORDS_SLUG, id: produtoId, depth: 0, req })
                .catch(() => null)
              const record = rec as unknown as (RecordSnapshot & { price: number; salePrice?: number | null; active?: boolean }) | null
              if (!record || record.active === false) {
                throw new APIError('Um dos discos do pedido não está mais disponível.', 400)
              }
              if (record.stock < qtd) {
                throw new APIError(`Estoque insuficiente para "${record.title}".`, 400)
              }
              const precoReais =
                record.salePrice != null && record.salePrice < record.price ? record.salePrice : record.price
              item.unitPrice = Math.round(precoReais * 100)
            }
          }
        }

        // O frete escolhido define o valor do frete (centavos) usado no total
        const frete = data.freteEscolhido as { preco?: number; servicoId?: number | null } | undefined
        if (frete && typeof frete.preco === 'number') {
          data.shipping = frete.preco
        }

        // ── SEGURANÇA: revalida o preço do frete na SuperFrete (create) ───────
        // Recalcula o pacote e cota de novo no servidor; se a cotação responder,
        // o preço do serviço escolhido SOBRESCREVE o valor enviado pelo cliente.
        // Se a SuperFrete estiver fora, mantém o valor do cliente (checkout não
        // trava por indisponibilidade externa) e registra alerta no log.
        // O seed pula esta etapa via context.skipValidacaoFrete.
        if (
          operation === 'create' &&
          !context?.skipValidacaoFrete &&
          frete?.servicoId != null &&
          Array.isArray(data.items) &&
          process.env.SUPERFRETE_TOKEN
        ) {
          const destCep = String((data.destinatario as { cep?: string } | undefined)?.cep ?? '').replace(/\D/g, '')
          if (destCep.length === 8) {
            const config = await req.payload.findGlobal({ slug: 'configuracoes-de-frete' })
            const caixa = {
              comprimento: config.caixaPadrao?.comprimento ?? 33,
              largura: config.caixaPadrao?.largura ?? 33,
              altura: config.caixaPadrao?.altura ?? 3,
            }
            const pacote = await construirPacoteDoPedido(
              req.payload,
              data.items as Order['items'],
              caixa,
              config.pesoPadraoItem ?? 350,
              req,
            )
            const cotacao = await cotarSuperFrete(
              (config.cepOrigem ?? '').replace(/\D/g, ''),
              destCep,
              pacote,
            )
            if (cotacao.ok) {
              const opcao = cotacao.opcoes.find(
                (o) => o.id === frete.servicoId && o.error == null && Number.isFinite(Number(o.price)),
              )
              if (!opcao) {
                throw new APIError('O frete escolhido não está mais disponível. Recalcule o frete.', 400)
              }
              const precoServidor = Math.round((Number(opcao.price) + (config.acrescimoFrete ?? 8)) * 100)
              ;(data.freteEscolhido as { preco?: number }).preco = precoServidor
              data.shipping = precoServidor
            } else {
              req.payload.logger.warn(`[pedido] Frete não revalidado (${cotacao.erro}); usando valor enviado.`)
            }
          }
        }

        // ── SEGURANÇA: valida faixa do frete quando não foi possível revalidar ──
        // (servicoId nulo, SUPERFRETE_TOKEN ausente ou cotação fora do ar). Sem
        // isso, um cliente malicioso poderia mandar `preco` negativo para abater
        // o total do pedido.
        if (operation === 'create' && typeof data.shipping === 'number') {
          if (!Number.isFinite(data.shipping) || data.shipping < 0) {
            throw new APIError('Valor de frete inválido.', 400)
          }
        }

        // Recalcula subtotal e total no servidor — nunca confia no cliente
        if (Array.isArray(data.items)) {
          const subtotal = (data.items as Array<{ unitPrice?: number; quantity?: number }>).reduce(
            (sum, item) => sum + (item.unitPrice ?? 0) * (item.quantity ?? 0),
            0,
          )
          data.subtotal = subtotal
          data.total = subtotal + (data.shipping ?? 0) - (data.discount ?? 0)
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req, operation, context }) => {
        if (context.skipStockDecrement) return

        const becamePago =
          (operation === 'create' && doc.status === 'pago') ||
          (operation === 'update' && previousDoc?.status !== 'pago' && doc.status === 'pago')

        if (!becamePago) return

        for (const item of doc.items as OrderItem[]) {
          const productRef = item.product
          const productId =
            typeof productRef.value === 'object' && productRef.value !== null
              ? productRef.value.id
              : productRef.value
          const productCollection = productRef.relationTo

          if (productCollection === 'records') {
            // ── Disco: decrementa estoque direto ──────────────────────────
            const record = (await req.payload.findByID({
              collection: RECORDS_SLUG,
              id: productId,
              req,
            })) as unknown as RecordSnapshot

            const newStock = record.stock - item.quantity
            if (newStock < 0) {
              throw new Error(
                `Estoque insuficiente para o disco "${record.title}" (SKU: ${record.sku}). ` +
                  `Disponível: ${record.stock}, solicitado: ${item.quantity}.`,
              )
            }
            await req.payload.update({
              collection: RECORDS_SLUG,
              id: productId,
              data: { stock: newStock } as Record<string, unknown>,
              req,
              context: { skipStockDecrement: true },
            })
          } else if (productCollection === 'apparel') {
            // ── Vestuário: decrementa estoque da variante específica ───────
            const apparel = (await req.payload.findByID({
              collection: APPAREL_SLUG,
              id: productId,
              req,
            })) as unknown as ApparelSnapshot

            const variantIdx = apparel.variants.findIndex(
              (v) =>
                v.size === item.variantSize &&
                (!item.variantColor || v.color === item.variantColor),
            )

            if (variantIdx === -1) {
              throw new Error(
                `Variante "${item.variantSize}${item.variantColor ? `/${item.variantColor}` : ''}" ` +
                  `não encontrada em "${apparel.title}" (SKU: ${apparel.sku}).`,
              )
            }

            const variant = apparel.variants[variantIdx]
            const newVariantStock = variant.stock - item.quantity

            if (newVariantStock < 0) {
              throw new Error(
                `Estoque insuficiente para "${apparel.title}" tam. ${item.variantSize}. ` +
                  `Disponível: ${variant.stock}, solicitado: ${item.quantity}.`,
              )
            }

            const updatedVariants = apparel.variants.map((v, i) =>
              i === variantIdx ? { ...v, stock: newVariantStock } : v,
            )

            await req.payload.update({
              collection: APPAREL_SLUG,
              id: productId,
              data: { variants: updatedVariants } as Record<string, unknown>,
              req,
              context: { skipStockDecrement: true },
            })
          }
        }
      },
      // ── Cria a etiqueta na SuperFrete quando o pedido vira "pago" ──────────
      // O gatilho é a MUDANÇA DE STATUS para "pago" (não o botão de checkout).
      // Assim, quando o Mercado Pago for integrado, basta marcar como "pago".
      async ({ doc, previousDoc, req, operation, context }) => {
        if (context.skipEtiqueta) return

        const order = doc as unknown as Order
        const previa = previousDoc as unknown as Order | undefined

        const becamePago =
          (operation === 'create' && order.status === 'pago') ||
          (operation === 'update' && previa?.status !== 'pago' && order.status === 'pago')
        if (!becamePago) return

        // Idempotência: se já tem etiqueta, não cria de novo.
        if (order.idEtiquetaSuperFrete) return

        const config = await req.payload.findGlobal({ slug: 'configuracoes-de-frete', req })
        const resultado = await criarEtiquetaSuperFrete(req.payload, order, config, req)

        if (resultado.id) {
          await req.payload.update({
            collection: 'orders',
            id: order.id,
            data: {
              idEtiquetaSuperFrete: resultado.id,
              statusEtiqueta: 'a_emitir',
              status: 'etiqueta_criada',
            },
            req,
            context: { skipEtiqueta: true, skipStockDecrement: true },
          })
        } else {
          // Falha não quebra o fluxo: registra o erro no pedido e loga (sem token).
          req.payload.logger.error(
            `[Etiqueta] Falha ao criar etiqueta do pedido ${order.orderNumber}: ${resultado.erro}`,
          )
          await req.payload.update({
            collection: 'orders',
            id: order.id,
            data: {
              statusEtiqueta: 'erro',
              erroEtiqueta: resultado.erro ?? 'Erro desconhecido ao criar a etiqueta.',
            },
            req,
            context: { skipEtiqueta: true, skipStockDecrement: true },
          })
        }
      },
    ],
  },
  fields: [
    {
      name: 'orderNumber',
      label: 'Número do Pedido',
      type: 'text',
      unique: true,
      required: true,
      index: true,
      admin: { description: 'Gerado automaticamente. Formato: ER-<timestamp>.', readOnly: true },
    },
    {
      name: 'customer',
      label: 'Cliente',
      type: 'relationship',
      relationTo: USERS_SLUG,
      required: true,
    },
    {
      name: 'items',
      label: 'Itens do Pedido',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        {
          name: 'product',
          label: 'Produto',
          type: 'relationship',
          // Aceita discos e vestuário no mesmo pedido
          relationTo: [RECORDS_SLUG, APPAREL_SLUG],
          required: true,
        },
        {
          name: 'variantSize',
          label: 'Tamanho',
          type: 'text',
          admin: { description: 'Obrigatório para vestuário. Ex: M, G, Tamanho Único.' },
        },
        {
          name: 'variantColor',
          label: 'Cor',
          type: 'text',
          admin: { description: 'Obrigatório se o vestuário tiver opções de cor.' },
        },
        {
          name: 'quantity',
          label: 'Quantidade',
          type: 'number',
          required: true,
          min: 1,
        },
        {
          // Snapshot do preço no momento da compra
          name: 'unitPrice',
          label: 'Preço Unitário (centavos)',
          type: 'number',
          required: true,
          admin: { description: 'Preço no momento da compra. Não muda com o produto.' },
        },
        {
          // Snapshot para preservar histórico mesmo que o produto seja renomeado
          name: 'productTitle',
          label: 'Nome do Produto',
          type: 'text',
          required: true,
        },
        {
          name: 'productSku',
          label: 'SKU',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'subtotal',
      label: 'Subtotal (centavos)',
      type: 'number',
      required: true,
      admin: { description: 'Calculado automaticamente a partir dos itens.', readOnly: true },
    },
    {
      name: 'shipping',
      label: 'Frete (centavos)',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Definido automaticamente pela opção de frete escolhida.', readOnly: true },
    },
    {
      name: 'freteEscolhido',
      label: 'Frete Escolhido',
      type: 'group',
      admin: { description: 'Opção de frete selecionada pelo cliente no checkout.' },
      fields: [
        {
          name: 'servicoId',
          label: 'ID do Serviço (SuperFrete)',
          type: 'number',
          admin: { description: 'Usado para emitir a etiqueta. Ex: 1=PAC, 2=SEDEX, 17=Mini Envios.' },
        },
        { name: 'transportadora', label: 'Transportadora', type: 'text' },
        { name: 'nome', label: 'Serviço', type: 'text', admin: { description: 'Ex: PAC, SEDEX.' } },
        { name: 'prazo', label: 'Prazo (dias)', type: 'number' },
        { name: 'preco', label: 'Preço do Frete (centavos)', type: 'number', admin: { description: 'Já com o acréscimo embutido.' } },
      ],
    },
    {
      // TODO: Aplicar desconto do sistema de cupons quando implementado
      name: 'discount',
      label: 'Desconto (centavos)',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'total',
      label: 'Total (centavos)',
      type: 'number',
      required: true,
      admin: { description: 'Calculado: subtotal + frete − desconto.', readOnly: true },
      validate: ((
        value: number | null | undefined,
        { data }: { data: Record<string, unknown> },
      ) => {
        if (value == null) return true
        const expected =
          ((data.subtotal as number) ?? 0) +
          ((data.shipping as number) ?? 0) -
          ((data.discount as number) ?? 0)
        if (value !== expected) {
          return `Total (${value}) deve ser igual a subtotal + frete − desconto (esperado: ${expected}).`
        }
        return true
      }) satisfies NonNullable<NumberField['validate']>,
    },
    {
      name: 'status',
      label: 'Status do Pedido',
      type: 'select',
      required: true,
      defaultValue: 'aguardando_pagamento',
      options: ORDER_STATUSES,
    },
    {
      // TODO: Preencher automaticamente via webhook do gateway de pagamento
      name: 'paymentMethod',
      label: 'Forma de Pagamento',
      type: 'select',
      options: PAYMENT_METHODS,
    },
    {
      name: 'paymentStatus',
      label: 'Status do Pagamento',
      type: 'select',
      defaultValue: 'unpaid',
      options: PAYMENT_STATUSES,
    },
    {
      name: 'paymentId',
      label: 'ID do Pagamento (Gateway)',
      type: 'text',
      admin: { description: 'ID externo do gateway de pagamento (legado).' },
    },
    {
      name: 'idPagamentoMercadoPago',
      label: 'ID do Pagamento (Mercado Pago)',
      type: 'text',
      admin: {
        description: 'Preenchido automaticamente quando o pagamento for integrado (fase futura).',
        readOnly: true,
      },
    },
    {
      name: 'destinatario',
      label: 'Destinatário',
      type: 'group',
      admin: { description: 'Dados de quem recebe o pedido. Usados na etiqueta dos Correios.' },
      fields: [
        { name: 'nome', label: 'Nome', type: 'text' },
        { name: 'cpf', label: 'CPF', type: 'text', admin: { description: 'Obrigatório para emissão da etiqueta.' } },
        { name: 'email', label: 'E-mail', type: 'text' },
        { name: 'telefone', label: 'Telefone', type: 'text' },
        { name: 'cep', label: 'CEP', type: 'text' },
        { name: 'rua', label: 'Rua', type: 'text' },
        { name: 'numero', label: 'Número', type: 'text' },
        { name: 'complemento', label: 'Complemento', type: 'text' },
        { name: 'bairro', label: 'Bairro', type: 'text' },
        { name: 'cidade', label: 'Cidade', type: 'text' },
        { name: 'uf', label: 'UF', type: 'text' },
      ],
    },
    {
      name: 'shippingAddress',
      label: 'Endereço de Entrega (legado)',
      type: 'group',
      admin: {
        description: 'Snapshot antigo do endereço. Pedidos novos usam o grupo "Destinatário".',
        hidden: true,
      },
      fields: [
        { name: 'street', label: 'Rua', type: 'text' },
        { name: 'number', label: 'Número', type: 'text' },
        { name: 'complement', label: 'Complemento', type: 'text' },
        { name: 'neighborhood', label: 'Bairro', type: 'text' },
        { name: 'city', label: 'Cidade', type: 'text' },
        { name: 'state', label: 'Estado', type: 'text' },
        { name: 'zipCode', label: 'CEP', type: 'text' },
      ],
    },
    {
      name: 'idEtiquetaSuperFrete',
      label: 'ID da Etiqueta (SuperFrete)',
      type: 'text',
      admin: { description: 'Preenchido automaticamente quando a etiqueta é criada.', readOnly: true },
    },
    {
      name: 'statusEtiqueta',
      label: 'Status da Etiqueta',
      type: 'select',
      options: [
        { label: 'A emitir', value: 'a_emitir' },
        { label: 'Emitida', value: 'emitida' },
        { label: 'Erro', value: 'erro' },
      ],
      admin: { description: 'Acompanhamento da etiqueta na SuperFrete.', readOnly: true },
    },
    {
      name: 'erroEtiqueta',
      label: 'Erro da Etiqueta',
      type: 'textarea',
      admin: {
        description: 'Mensagem de erro caso a criação da etiqueta falhe.',
        readOnly: true,
        condition: (data) => data.statusEtiqueta === 'erro',
      },
    },
    {
      name: 'codigoRastreio',
      label: 'Código de Rastreio',
      type: 'text',
      admin: { description: 'Preenchido quando disponível.', readOnly: true },
    },
    {
      name: 'notes',
      label: 'Observações Internas',
      type: 'textarea',
      admin: { description: 'Notas internas do admin. Não visível ao cliente.' },
    },
    {
      name: 'customerNotes',
      label: 'Observações do Cliente',
      type: 'textarea',
      admin: { description: 'Mensagem enviada pelo cliente no checkout.' },
    },
  ],
  timestamps: true,
}
