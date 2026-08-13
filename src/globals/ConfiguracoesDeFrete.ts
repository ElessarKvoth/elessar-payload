import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

export const ConfiguracoesDeFrete: GlobalConfig = {
  slug: 'configuracoes-de-frete',
  label: 'Configurações de Frete',
  admin: {
    group: 'Configurações',
    description:
      'Parâmetros do cálculo de frete (origem, caixa padrão e acréscimo). As transportadoras exibidas ao cliente — PAC, SEDEX, Jadlog, Loggi — são as que estiverem ATIVAS no painel da SuperFrete (Integrações → Configurações da integração). Ligue ou desligue por lá; aqui não há nada a configurar sobre isso.',
    hideAPIURL: true,
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    {
      name: 'cepOrigem',
      label: 'CEP de origem',
      type: 'text',
      required: true,
      defaultValue: '13084551',
      admin: {
        description: 'CEP de onde os pedidos são enviados.',
      },
    },
    {
      name: 'remetente',
      label: 'Remetente (dados da etiqueta)',
      type: 'group',
      admin: {
        description:
          'Dados de quem envia — aparecem na etiqueta dos Correios. TODOS são obrigatórios: sem eles a etiqueta não é gerada automaticamente quando um pedido é pago. (O CEP é o "CEP de origem" acima.)',
      },
      fields: [
        { name: 'nome', label: 'Nome / Razão social', type: 'text', required: true },
        {
          name: 'documento',
          label: 'CPF ou CNPJ',
          type: 'text',
          required: true,
          admin: { description: 'Somente números, 11 (CPF) ou 14 (CNPJ) dígitos.' },
        },
        { name: 'telefone', label: 'Telefone', type: 'text', required: true },
        { name: 'email', label: 'E-mail', type: 'text', required: true },
        { name: 'rua', label: 'Rua', type: 'text', required: true },
        { name: 'numero', label: 'Número', type: 'text', required: true },
        { name: 'complemento', label: 'Complemento', type: 'text' },
        { name: 'bairro', label: 'Bairro', type: 'text', required: true },
        { name: 'cidade', label: 'Cidade', type: 'text', required: true },
        { name: 'uf', label: 'UF', type: 'text', required: true, maxLength: 2 },
      ],
    },
    {
      name: 'acrescimoFrete',
      label: 'Acréscimo no frete (R$)',
      type: 'number',
      required: true,
      defaultValue: 8,
      admin: {
        description:
          'Valor somado a cada opção de frete, já embutido. Não aparece separado para o cliente.',
      },
    },
    {
      name: 'caixaPadrao',
      label: 'Caixa padrão (mínimo)',
      type: 'group',
      admin: {
        description: 'Usada como tamanho mínimo do pacote.',
      },
      fields: [
        {
          name: 'comprimento',
          label: 'Comprimento (cm)',
          type: 'number',
          defaultValue: 33,
        },
        {
          name: 'largura',
          label: 'Largura (cm)',
          type: 'number',
          defaultValue: 33,
        },
        {
          name: 'altura',
          label: 'Altura (cm)',
          type: 'number',
          defaultValue: 3,
        },
      ],
    },
    {
      name: 'pesoPadraoItem',
      label: 'Peso padrão por item (g)',
      type: 'number',
      defaultValue: 350,
      admin: {
        description: 'Usado quando um disco não tem peso cadastrado.',
      },
    },
  ],
}
