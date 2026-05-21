import type { CollectionConfig, CollectionSlug, NumberField } from 'payload'

import { isAdmin, isAdminOrCustomer } from '../access/isAdmin'

// TODO: Integrar gateway de pagamento (Stripe / MercadoPago) — guardar ID externo em paymentId.
// TODO: Integrar transportadora — usar shippingAddress + peso dos produtos para calcular frete.
// TODO: Implementar sistema de cupons — validar código e aplicar desconto aqui.

// CollectionSlug casts required until `payload generate:types` is run with all collections registered.
const RECORDS_SLUG = 'records' as CollectionSlug
const APPAREL_SLUG = 'apparel' as CollectionSlug
const USERS_SLUG = 'users' as CollectionSlug

const ORDER_STATUSES = [
  { label: 'Pendente', value: 'pending' },
  { label: 'Confirmado', value: 'confirmed' },
  { label: 'Pago', value: 'paid' },
  { label: 'Em Preparação', value: 'processing' },
  { label: 'Enviado', value: 'shipped' },
  { label: 'Entregue', value: 'delivered' },
  { label: 'Cancelado', value: 'cancelled' },
  { label: 'Reembolsado', value: 'refunded' },
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
    defaultColumns: ['orderNumber', 'customer', 'total', 'status', 'paymentStatus', 'createdAt'],
  },
  access: {
    read: isAdminOrCustomer,
    create: ({ req: { user } }) => Boolean(user),
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [
      async ({ data, req, operation }) => {
        // Gera número do pedido automaticamente
        if (operation === 'create' && data && !data.orderNumber) {
          data.orderNumber = `ER-${Date.now()}`
        }

        // Força customer = usuário logado em create (evita impersonação)
        if (operation === 'create' && req.user && !data?.customer) {
          if (data) data.customer = req.user.id
        }

        // Recalcula subtotal e total no servidor — nunca confia no cliente
        if (data && Array.isArray(data.items)) {
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

        const becamePaid =
          (operation === 'create' && doc.status === 'paid') ||
          (operation === 'update' && previousDoc?.status !== 'paid' && doc.status === 'paid')

        if (!becamePaid) return

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
      // TODO: Substituir por cálculo real de frete quando transportadora for integrada
      name: 'shipping',
      label: 'Frete (centavos)',
      type: 'number',
      defaultValue: 0,
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
      defaultValue: 'pending',
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
      // TODO: Guardar o ID retornado pelo Stripe / MercadoPago após confirmação do pagamento
      name: 'paymentId',
      label: 'ID do Pagamento (Gateway)',
      type: 'text',
      admin: { description: 'ID externo do gateway de pagamento.' },
    },
    {
      name: 'shippingAddress',
      label: 'Endereço de Entrega',
      type: 'group',
      admin: { description: 'Snapshot do endereço no momento do pedido.' },
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
