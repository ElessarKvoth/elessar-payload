import type { CollectionConfig, CollectionSlug } from 'payload'

import { isAdmin } from '../access/isAdmin'
import {
  BANNER_DESKTOP,
  BANNER_MOBILE,
  avisoDeProporcao,
  descricaoDaArte,
} from '../utils/proporcaoDeBanner'

/**
 * O banner inteiro é clicável, e este campo diz para onde ele leva.
 *
 * Os atalhos de página ("Catálogo", "Raridades"…) são opções DESTA lista, e não
 * um segundo campo: quem cadastra responde uma pergunta só — "para onde leva?" —
 * em vez de escolher um tipo e depois descobrir que existe outro campo escondido
 * embaixo. De quebra, o banco ganha uma coluna a menos.
 *
 * A ordem das opções vai do mais específico (um disco) ao mais genérico (um
 * endereço digitado à mão), porque é essa a ordem em que se pensa no destino.
 */
const DESTINO = {
  nada: 'nada',
  disco: 'disco',
  artista: 'artista',
  vestuario: 'vestuario',
  paginaCatalogo: 'pagina_catalogo',
  paginaRaridades: 'pagina_raridades',
  paginaVestuario: 'pagina_vestuario',
  paginaArtistas: 'pagina_artistas',
  link: 'link',
} as const

/** Mostra o campo só quando o destino escolhido for exatamente este. */
const quandoDestinoFor =
  (valor: string) =>
  (data: Record<string, unknown> | undefined): boolean =>
    data?.tipoDeDestino === valor

export const Banners: CollectionConfig = {
  slug: 'banners',
  labels: {
    singular: 'Banner',
    plural: 'Banners',
  },
  admin: {
    useAsTitle: 'title',
    group: 'Marketing',
    description: `Crie os banners do carrossel da home. O formulário tem três blocos, na ordem em que se monta um banner:

① A ARTE — a imagem. É a única parte obrigatória.

② PARA ONDE LEVA — o banner inteiro fica clicável. Escolha um disco, uma banda, uma peça de vestuário, uma página da loja ou digite um endereço.

③ TEXTO POR CIMA — só para quem NÃO tem o texto desenhado na arte. Nasce fechado; se a sua arte já vem pronta com o texto, nem abra.

TAMANHO DAS ARTES: computador 2560 x 960 px · celular 1080 x 1350 px. O guia completo para quem desenha é o arquivo BANNERS.md.

Após criar, vá em "Página Inicial" para escolher quais banners aparecem e em que ordem.`,
    defaultColumns: ['title', 'tipoDeDestino', 'active', 'startsAt', 'endsAt'],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    // ── ① A arte ───────────────────────────────────────────────────────────
    {
      type: 'collapsible',
      label: '1 · A arte do banner',
      admin: {
        initCollapsed: false,
        description: 'A imagem que aparece no carrossel. É a única parte obrigatória.',
      },
      fields: [
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
          // O recorte fica no BANNER, não na imagem: a coleção de Imagens é
          // compartilhada (a mesma foto pode ser card de produto), e um recorte
          // 8:3 gravado nela valeria para todos os usos.
          //
          // `json` de propósito, e não `group`: é uma coordenada só, lida e escrita
          // inteira, e cabe numa coluna em vez de quatro.
          name: 'recorteDesktop',
          label: 'Recorte do computador',
          type: 'json',
          admin: {
            components: { Field: '/components/RecorteDeBanner#RecorteDesktop' },
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
          name: 'recorteMobile',
          label: 'Recorte do celular',
          type: 'json',
          admin: {
            components: { Field: '/components/RecorteDeBanner#RecorteMobile' },
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
                const midia = (v: unknown) =>
                  v && typeof v === 'object' ? (v as { width?: number; height?: number }) : null

                const avisos = [
                  avisoDeProporcao(midia(doc.image), BANNER_DESKTOP),
                  avisoDeProporcao(midia(doc.imageMobile), BANNER_MOBILE),
                ].filter((a): a is string => a !== null)

                return avisos.length > 0 ? avisos.join(' • ') : null
              },
            ],
          },
        },
      ],
    },

    // ── ② Destino do clique ────────────────────────────────────────────────
    {
      type: 'collapsible',
      label: '2 · Para onde o banner leva',
      admin: {
        initCollapsed: false,
        description:
          'O banner inteiro vira um link: o visitante clica em qualquer ponto da arte e vai para cá.',
      },
      fields: [
        {
          name: 'tipoDeDestino',
          label: 'Para onde leva quando clicar?',
          type: 'select',
          required: true,
          defaultValue: DESTINO.nada,
          options: [
            { label: 'Não leva a lugar nenhum (banner só decorativo)', value: DESTINO.nada },
            { label: 'Um disco do catálogo', value: DESTINO.disco },
            { label: 'Uma banda / artista', value: DESTINO.artista },
            { label: 'Uma peça de vestuário', value: DESTINO.vestuario },
            { label: 'Página da loja: catálogo completo', value: DESTINO.paginaCatalogo },
            { label: 'Página da loja: raridades', value: DESTINO.paginaRaridades },
            { label: 'Página da loja: vestuário', value: DESTINO.paginaVestuario },
            { label: 'Página da loja: bandas e artistas', value: DESTINO.paginaArtistas },
            { label: 'Outro endereço (eu digito o link)', value: DESTINO.link },
          ],
          admin: {
            description:
              'Escolha uma opção e o campo certo aparece logo abaixo. As opções "Página da loja" ' +
              'não pedem mais nada — já sabem para onde ir.',
          },
        },
        {
          name: 'destinoDisco',
          label: 'Qual disco?',
          type: 'relationship',
          relationTo: 'records' as CollectionSlug,
          required: true,
          admin: {
            allowCreate: false,
            condition: quandoDestinoFor(DESTINO.disco),
            description: 'Comece a digitar o nome do disco. O clique abre a página dele.',
          },
        },
        {
          name: 'destinoArtista',
          label: 'Qual banda / artista?',
          type: 'relationship',
          relationTo: 'artists' as CollectionSlug,
          required: true,
          admin: {
            allowCreate: false,
            condition: quandoDestinoFor(DESTINO.artista),
            description: 'O clique abre a página do artista, com a bio e os discos dele.',
          },
        },
        {
          name: 'destinoVestuario',
          label: 'Qual peça de vestuário?',
          type: 'relationship',
          relationTo: 'apparel' as CollectionSlug,
          required: true,
          admin: {
            allowCreate: false,
            condition: quandoDestinoFor(DESTINO.vestuario),
            description: 'Camiseta, moletom, boné… O clique abre a página da peça.',
          },
        },
        {
          name: 'link',
          label: 'Endereço',
          type: 'text',
          required: true,
          admin: {
            condition: quandoDestinoFor(DESTINO.link),
            description:
              'Uma página da própria loja começa com barra — ex: /como-comprar, /perguntas-frequentes. ' +
              'Um site de fora começa com https:// e abre em aba nova — ex: https://instagram.com/...',
          },
        },
      ],
    },

    // ── ③ Texto por cima da arte ───────────────────────────────────────────
    {
      type: 'collapsible',
      label: '3 · Texto por cima da arte (opcional)',
      admin: {
        // Fechado de propósito: quem sobe arte pronta — o caso mais comum aqui —
        // não deve preencher nada disto, e um bloco aberto e vazio parece campo
        // esquecido. Fechado, fica claro que é um extra.
        initCollapsed: true,
        description:
          'Se a sua arte JÁ TEM o texto desenhado nela, não abra este bloco — deixe tudo em branco. ' +
          'Preencha só quando quiser que o site escreva por cima da imagem.',
      },
      fields: [
        {
          name: 'title',
          label: 'Título',
          type: 'text',
          admin: {
            description: 'Texto principal, escrito pelo site por cima da arte.',
          },
        },
        {
          name: 'subtitle',
          label: 'Subtítulo',
          type: 'text',
          admin: {
            description: 'Texto secundário abaixo do título.',
          },
        },
        {
          name: 'linkLabel',
          label: 'Texto do botão',
          type: 'text',
          admin: {
            // O botão não tem destino próprio: ele leva ao mesmo lugar que o
            // banner. Ter dois destinos num banner só confundiria mais do que
            // ajudaria — e o visitante não sabe que são links diferentes.
            description:
              'Ex: "Ver promoções", "Comprar agora". Padrão: "Explorar". O botão leva ao mesmo ' +
              'destino escolhido no bloco 2, e só aparece se houver título e destino.',
          },
        },
      ],
    },

    // ── Quando o banner fica no ar ─────────────────────────────────────────
    // Estes campos existiam desde o começo, mas ocultos e SEM EFEITO: a home
    // montava o carrossel pela lista de "Página Inicial" e não olhava nenhum
    // deles. Agendar um banner simplesmente não funcionava, e não havia como
    // descobrir isso a não ser esperando a data passar.
    //
    // Agora o site respeita os três. Ficam visíveis para poder serem usados.
    // Continuam no primeiro nível: `position: 'sidebar'` só vale fora de
    // collapsible.
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
