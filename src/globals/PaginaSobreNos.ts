import type { CollectionSlug, GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { editorDeTexto } from '../fields/editorDeTexto'

export const PaginaSobreNos: GlobalConfig = {
  slug: 'pagina-sobre-nos',
  label: 'Página "Sobre a Loja"',
  admin: {
    group: 'Conteúdo do site',
    description:
      'O conteúdo da página que conta a história da Elessar. É a página que abre quando o cliente clica em "Sobre a Loja" no rodapé do site. Tudo que você escrever aqui aparece lá assim que salvar.',
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
      defaultValue: 'Sobre a Loja',
      admin: {
        description:
          'O texto grande no topo da página. Exemplo: "Sobre a Loja" ou "Nossa história".',
      },
    },
    {
      name: 'chamada',
      label: 'Frase de abertura',
      type: 'textarea',
      admin: {
        description:
          'Uma ou duas linhas logo abaixo do título, em letra maior que o resto. Serve para resumir a loja em uma frase. Exemplo: "Discos selecionados a mão desde 2024." Pode deixar vazio — nesse caso a página começa direto no texto.',
      },
    },
    {
      name: 'texto',
      label: 'Texto da página',
      type: 'richText',
      editor: editorDeTexto,
      admin: {
        description:
          'A história da loja, escrita normalmente. Use os botões no topo da caixa para deixar em negrito, criar títulos de seção ou fazer listas. Escreva em parágrafos curtos: fica mais fácil de ler no celular. Pode salvar pela metade e voltar depois.',
      },
    },
    {
      name: 'imagem',
      label: 'Foto principal',
      type: 'upload',
      relationTo: 'media' as CollectionSlug,
      admin: {
        description:
          'Uma foto da loja, do acervo ou de você, exibida junto do texto. Opcional. Prefira uma foto deitada (mais larga que alta), com no mínimo 1600 pixels de largura.',
      },
    },
    {
      name: 'secoes',
      label: 'Seções extras',
      type: 'array',
      labels: { singular: 'Seção', plural: 'Seções' },
      admin: {
        initCollapsed: true,
        description:
          'Blocos que aparecem embaixo do texto principal, na ordem em que estiverem aqui — arraste para reordenar. Use quando quiser separar assuntos, por exemplo "Como escolhemos os discos" ou "Onde nos encontrar". Se não precisar de nenhum, deixe vazio e a página mostra só o texto acima.',
      },
      fields: [
        {
          name: 'titulo',
          label: 'Título da seção',
          type: 'text',
          required: true,
          admin: {
            description: 'Aparece como um subtítulo. Exemplo: "Como escolhemos os discos".',
          },
        },
        {
          name: 'texto',
          label: 'Texto da seção',
          type: 'richText',
          editor: editorDeTexto,
          required: true,
        },
        {
          name: 'imagem',
          label: 'Foto da seção',
          type: 'upload',
          relationTo: 'media' as CollectionSlug,
          admin: { description: 'Opcional. Aparece ao lado do texto desta seção.' },
        },
      ],
    },
  ],
}
