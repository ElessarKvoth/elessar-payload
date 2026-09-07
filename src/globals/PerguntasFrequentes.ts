import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { editorDeTexto } from '../fields/editorDeTexto'

export const PerguntasFrequentes: GlobalConfig = {
  slug: 'perguntas-frequentes',
  label: 'Perguntas Frequentes',
  admin: {
    group: 'Conteúdo do site',
    description:
      'A lista de perguntas e respostas do site. Toda vez que um cliente perguntar a mesma coisa pela terceira vez, a resposta merece entrar aqui — cada pergunta bem respondida é uma mensagem a menos para você responder à mão. Esta página ainda está sendo montada no site; pode preencher desde já, que ela aparece assim que entrar no ar.',
    hideAPIURL: true,
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    {
      name: 'titulo',
      label: 'Título da página',
      type: 'text',
      required: true,
      defaultValue: 'Perguntas Frequentes',
      admin: {
        description: 'O texto grande no topo da página. Exemplo: "Perguntas Frequentes".',
      },
    },
    {
      name: 'introducao',
      label: 'Texto de abertura',
      type: 'textarea',
      admin: {
        description:
          'Uma ou duas linhas antes da lista. Bom lugar para dizer o que fazer quando a dúvida não estiver na lista. Exemplo: "Não achou sua dúvida? Chame a gente no WhatsApp." Pode deixar vazio.',
      },
    },
    {
      name: 'perguntas',
      label: 'Perguntas',
      type: 'array',
      labels: { singular: 'Pergunta', plural: 'Perguntas' },
      admin: {
        initCollapsed: true,
        description:
          'Aparecem no site na mesma ordem que estiverem aqui — arraste pela alça à esquerda para reordenar. Deixe as dúvidas mais comuns em cima. Para tirar uma pergunta do ar, apague a linha inteira.',
      },
      fields: [
        {
          name: 'pergunta',
          label: 'Pergunta',
          type: 'text',
          required: true,
          admin: {
            description:
              'Escreva do jeito que o cliente perguntaria, não do jeito técnico. "Em quanto tempo chega?" funciona melhor que "Prazo de entrega".',
          },
        },
        {
          name: 'resposta',
          label: 'Resposta',
          type: 'richText',
          editor: editorDeTexto,
          required: true,
          admin: {
            description:
              'Responda direto na primeira frase e só depois explique. Se a resposta completa estiver em outra página, use o botão de link para mandar o cliente para lá.',
          },
        },
      ],
    },
  ],
}
