import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

export const ConfiguracoesDeFrete: GlobalConfig = {
  slug: 'configuracoes-de-frete',
  label: 'Configurações de Frete',
  admin: {
    group: 'Configurações',
    description: 'Parâmetros usados no cálculo do frete (origem, caixa padrão e acréscimo).',
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
