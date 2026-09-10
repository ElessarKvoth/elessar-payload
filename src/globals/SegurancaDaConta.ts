import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * Ajustes do aviso de novo acesso.
 *
 * Existe como global, e não como constante no código, porque o ponto certo
 * entre "avisa demais" e "avisa de menos" só aparece com a loja rodando: se os
 * clientes começarem a reclamar de e-mail repetido, o gerente aumenta os dias
 * aqui e resolve na hora, sem deploy.
 */
export const SegurancaDaConta: GlobalConfig = {
  slug: 'seguranca-da-conta',
  label: 'Avisos de Segurança',
  admin: {
    group: 'Sistema',
    description:
      'Controla o e-mail que avisa o cliente quando alguém entra na conta dele. Serve para a pessoa perceber rápido se outra pessoa descobriu a senha.',
    hideAPIURL: true,
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    {
      name: 'avisarNovoAcesso',
      label: 'Avisar o cliente por e-mail quando entrarem na conta dele',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description:
          'Ligado, o cliente recebe um e-mail quando a conta é acessada de um aparelho ou lugar novo. É a forma mais simples de alguém descobrir que a conta foi invadida. Desligue apenas se estiver gerando reclamação.',
      },
    },
    {
      name: 'diasParaAvisarDeNovo',
      label: 'Dias até avisar de novo do mesmo aparelho',
      type: 'number',
      defaultValue: 30,
      min: 1,
      max: 365,
      admin: {
        condition: (data) => data.avisarNovoAcesso !== false,
        description:
          'O cliente NÃO recebe e-mail toda vez que entra: só quando o aparelho é novo, ou quando passou este número de dias desde o último aviso naquele aparelho. Com 30, quem entra todo dia do mesmo computador recebe no máximo um aviso por mês. Diminuir aumenta a vigilância e o número de e-mails; aumentar faz o contrário.',
      },
    },
    {
      name: 'quantosAcessosGuardar',
      label: 'Quantos acessos recentes guardar em cada conta',
      type: 'number',
      defaultValue: 10,
      min: 3,
      max: 50,
      admin: {
        description:
          'O histórico que aparece no cadastro do cliente, para você conseguir responder "de onde andaram entrando nesta conta?" quando alguém reclamar. Os mais antigos são descartados automaticamente.',
      },
    },
  ],
}
