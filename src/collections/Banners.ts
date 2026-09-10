import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import {
  BANNER_DESKTOP,
  BANNER_MOBILE,
  avisoDeProporcao,
  descricaoDaArte,
} from '../utils/proporcaoDeBanner'

export const Banners: CollectionConfig = {
  slug: 'banners',
  labels: {
    singular: 'Banner',
    plural: 'Banners',
  },
  admin: {
    useAsTitle: 'title',
    group: 'Marketing',
    description: `Crie os banners do carrossel da home. Existem dois modos:

① BANNER DE DESIGN PRÓPRIO — Suba só a imagem (já com o texto desenhado nela). Deixe título e todos os outros campos em branco.

② BANNER COM TEXTO — Preencha título, subtítulo e link; o site escreve por cima da arte. A imagem é opcional: sem imagem o banner exibe fundo verde escuro com a logo da Elessar.

TAMANHO DAS ARTES: computador 2560 x 960 px · celular 1080 x 1350 px. O detalhamento está na descrição de cada campo, e o guia completo para quem desenha é o arquivo BANNERS.md.

Após criar, vá em "Página Inicial" para escolher quais banners aparecem e em que ordem.`,
    defaultColumns: ['title', 'active', 'startsAt', 'endsAt'],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    // ── Imagem ─────────────────────────────────────────────────────────────
    {
      name: 'image',
      label: 'Arte do computador',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description:
          descricaoDaArte(BANNER_DESKTOP) +
          '\n\nSem imagem, o banner exibe fundo escuro com a logo da Elessar.\n\n' +
          'Depois de escolher, clique em "Editar imagem" e posicione o PONTO DE FOCO no que ' +
          'não pode ser cortado — é ele que o site respeita ao ajustar a arte a cada tela.',
      },
    },
    {
      name: 'imageMobile',
      label: 'Arte do celular (opcional)',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description:
          descricaoDaArte(BANNER_MOBILE) +
          '\n\nDeixando vazio, o site recorta a arte do computador no formato do celular, ' +
          'respeitando o ponto de foco. Isso resolve na maioria dos casos — mas se a arte ' +
          'tiver TEXTO desenhado, mande a versão de celular, senão o texto é cortado.',
      },
    },
    {
      // Virtual: calculado na leitura, sem coluna no banco e sem migration.
      // Avisa DEPOIS de salvar, como o "Aviso de qualidade" das Imagens — o
      // painel não tem como conferir dimensão antes do arquivo subir.
      name: 'avisoProporcao',
      label: '⚠️ Conferência das artes',
      type: 'text',
      virtual: true,
      admin: {
        readOnly: true,
        description:
          'Preenchido sozinho quando alguma arte está fora do formato pedido. ' +
          'É só um aviso: o banner funciona mesmo assim, mas pode sair cortado diferente do que você desenhou.',
        condition: (data) => Boolean(data?.avisoProporcao),
      },
      hooks: {
        afterRead: [
          ({ data }) => {
            const doc = (data ?? {}) as Record<string, unknown>

            // Com depth 0 vem só o id, e aí não há dimensão para conferir.
            const midia = (v: unknown) => (v && typeof v === 'object' ? (v as { width?: number; height?: number }) : null)

            const avisos = [
              avisoDeProporcao(midia(doc.image), BANNER_DESKTOP),
              avisoDeProporcao(midia(doc.imageMobile), BANNER_MOBILE),
            ].filter((a): a is string => a !== null)

            return avisos.length > 0 ? avisos.join(' • ') : null
          },
        ],
      },
    },

    // ── Conteúdo (só para banners com texto) ──────────────────────────────
    {
      name: 'title',
      label: 'Título',
      type: 'text',
      admin: {
        description: 'Texto principal. Deixe em branco se a imagem já tiver o texto desenhado.',
      },
    },
    {
      name: 'subtitle',
      label: 'Subtítulo',
      type: 'text',
      admin: {
        description: 'Texto secundário abaixo do título. Opcional.',
      },
    },
    {
      name: 'link',
      label: 'Link do Botão',
      type: 'text',
      admin: {
        description: 'Caminho interno (ex: /catalogo) ou URL externa. Deixe vazio para não exibir botão.',
      },
    },
    {
      name: 'linkLabel',
      label: 'Texto do Botão',
      type: 'text',
      admin: {
        description: 'Ex: "Ver Promoções", "Comprar Agora". Padrão: "Explorar".',
      },
    },

    // ── Quando o banner fica no ar ─────────────────────────────────────────
    // Estes campos existiam desde o começo, mas ocultos e SEM EFEITO: a home
    // monta o carrossel pela lista de "Página Inicial" e não olhava nenhum
    // deles. Agendar um banner simplesmente não funcionava, e não havia como
    // descobrir isso a não ser esperando a data passar.
    //
    // Agora o site respeita os três. Ficam visíveis para poder serem usados.
    {
      name: 'active',
      label: 'Banner ligado',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description:
          'Desmarque para tirar do ar sem apagar o banner — ele some da home e continua salvo aqui ' +
          'para você ligar de novo quando quiser. Melhor que apagar e ter que cadastrar tudo outra vez.',
      },
    },
    {
      name: 'startsAt',
      label: 'Começa a aparecer em',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime', displayFormat: "dd/MM/yyyy 'às' HH:mm" },
        description:
          'Deixe vazio para o banner entrar no ar assim que for ligado. Preencha para deixar uma ' +
          'promoção pronta com antecedência — ela aparece sozinha na hora marcada.',
      },
    },
    {
      name: 'endsAt',
      label: 'Sai do ar em',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime', displayFormat: "dd/MM/yyyy 'às' HH:mm" },
        description:
          'Deixe vazio para o banner ficar até você desligar. Preencha em promoção com prazo: ' +
          'o banner some sozinho e você não corre o risco de anunciar oferta que já acabou.',
      },
    },
    // A ordem do carrossel é a da lista em "Página Inicial" — arrastar lá é
    // mais claro que digitar número aqui. Fica oculto para não haver dois
    // lugares dizendo coisas diferentes sobre a mesma ordem.
    { name: 'order', type: 'number', defaultValue: 0, admin: { hidden: true } },
  ],
}
