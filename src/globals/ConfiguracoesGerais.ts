import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

export const ConfiguracoesGerais: GlobalConfig = {
  slug: 'configuracoes-gerais',
  label: 'Dados da Loja',
  admin: {
    group: 'Conteúdo do site',
    description:
      'Os dados da Elessar que aparecem espalhados pelo site inteiro: nome, contato, redes sociais e CNPJ. São preenchidos uma vez e mudam raramente. Como tudo vem daqui, corrigir o telefone neste lugar corrige em todas as páginas de uma vez.',
    hideAPIURL: true,
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Identidade',
          description: 'Como a loja se apresenta.',
          fields: [
            {
              name: 'nomeDaLoja',
              label: 'Nome da loja',
              type: 'text',
              required: true,
              defaultValue: 'Elessar Records',
              admin: {
                description:
                  'Usado no topo do site, na aba do navegador e quando alguém compartilha um link da loja.',
              },
            },
            {
              name: 'tagline',
              label: 'Frase que descreve a loja',
              type: 'textarea',
              admin: {
                description:
                  'Uma ou duas linhas que resumem a Elessar. Aparece no rodapé e é o texto que o Google mostra embaixo do nome do site nos resultados de busca. Exemplo: "Discos selecionados a mão. Metal pesado, rock, underground e cultura alternativa."',
              },
            },
          ],
        },
        {
          label: 'Contato',
          description:
            'Como o cliente fala com você. O WhatsApp tem tela própria, em "Botão de WhatsApp".',
          fields: [
            {
              name: 'emailContato',
              label: 'E-mail de contato',
              type: 'email',
              admin: {
                description:
                  'O endereço que o cliente usa para falar com a loja. Aparece no rodapé e nas páginas de trocas e entrega. Use um e-mail que você realmente acompanhe.',
              },
            },
            {
              name: 'telefone',
              label: 'Telefone',
              type: 'text',
              admin: {
                placeholder: '(19) 99123-4567',
                description:
                  'Escreva do jeito que se lê: (19) 99123-4567. Este campo é só para mostrar na tela — o número que o botão de WhatsApp usa fica na tela "Botão de WhatsApp" e tem outro formato.',
              },
            },
            {
              name: 'endereco',
              label: 'Endereço',
              type: 'textarea',
              admin: {
                description:
                  'O endereço físico da loja, se tiver atendimento presencial. Aparece no rodapé. Deixe vazio se a loja for só online.',
              },
            },
            {
              name: 'horarioAtendimento',
              label: 'Horário de atendimento',
              type: 'text',
              admin: {
                description: 'Exemplo: "Segunda a sexta, das 9h às 18h". Aparece no rodapé.',
              },
            },
          ],
        },
        {
          label: 'Redes sociais',
          description: 'Deixe vazio o que a loja não usa — link vazio não aparece no site.',
          fields: [
            {
              name: 'instagram',
              label: 'Instagram',
              type: 'text',
              admin: {
                placeholder: '@elessarrecords',
                description:
                  'O nome de usuário com @ ou o endereço completo do perfil. Os dois funcionam.',
              },
            },
            {
              name: 'youtube',
              label: 'YouTube',
              type: 'text',
              admin: { description: 'Endereço completo do canal. Opcional.' },
            },
            {
              name: 'facebook',
              label: 'Facebook',
              type: 'text',
              admin: { description: 'Endereço completo da página. Opcional.' },
            },
          ],
        },
        {
          label: 'Dados da empresa',
          description: 'Informação legal que precisa aparecer no rodapé.',
          fields: [
            {
              name: 'razaoSocial',
              label: 'Razão social',
              type: 'text',
              admin: {
                description:
                  'O nome registrado da empresa, que costuma ser diferente do nome da loja. Opcional.',
              },
            },
            {
              name: 'cnpj',
              label: 'CNPJ',
              type: 'text',
              admin: {
                placeholder: '66.012.563/0001-08',
                description:
                  'Aparece no rodapé de todas as páginas. Mostrar o CNPJ passa confiança para quem está comprando pela primeira vez e é exigido na venda online.',
              },
            },
          ],
        },
        {
          label: 'Aviso no topo',
          description:
            'A tarja que atravessa o topo do site. Use para recado curto e temporário: férias coletivas, promoção, atraso nos Correios.',
          fields: [
            {
              name: 'avisoAtivo',
              label: 'Mostrar a tarja de aviso',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description:
                  'Desmarcado, nada aparece. Marque só enquanto o recado valer — tarja que fica meses no ar todo mundo aprende a ignorar.',
              },
            },
            {
              name: 'avisoTexto',
              label: 'Texto do aviso',
              type: 'text',
              admin: {
                description:
                  'Uma frase só, curta. Exemplo: "Pedidos feitos a partir de 20/12 serão postados em janeiro."',
                condition: (data) => Boolean(data?.avisoAtivo),
              },
            },
            {
              name: 'avisoLink',
              label: 'Link do aviso',
              type: 'text',
              admin: {
                description:
                  'Para onde o cliente vai se clicar na tarja. Opcional — sem link, a tarja é só um recado.',
                condition: (data) => Boolean(data?.avisoAtivo),
              },
            },
            {
              name: 'avisoValidoAte',
              label: 'Esconder automaticamente em',
              type: 'date',
              admin: {
                date: { pickerAppearance: 'dayOnly', displayFormat: 'dd/MM/yyyy' },
                description:
                  'A partir desta data a tarja some sozinha, sem você precisar lembrar de voltar aqui. Deixe vazio para o aviso ficar até você desmarcar na mão.',
                condition: (data) => Boolean(data?.avisoAtivo),
              },
            },
          ],
        },
      ],
    },
  ],
}
